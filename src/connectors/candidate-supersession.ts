/**
 * @file src/connectors/candidate-supersession.ts
 * @description Count-bounded connector candidate selection, exact-custody
 * archive, and closed in-process compensation. Callers retain store-owned file
 * identities and raw-byte receipts; the move seam accepts no path strings. A
 * move is successful only when the bounded digest/inode observer proves the
 * exact archived or restored state, and every post-attempt failure is reduced
 * to an ordered recovery-required result rather than a raw filesystem error.
 */

import {
  assertCandidateMutationAccess,
  assertCandidateNamespacesHealthy,
  CandidateCustodyUnavailableError,
  moveCandidateWithCustody,
  observeCandidateCustody,
  type CandidateCustodyMoveRequest,
  type CandidateCustodyReceipt,
} from "../compiler/candidate-custody.js";
import {
  CandidateCustodyBoundaryError,
  captureCandidateCustodyReceipt,
  captureCandidateCustodyReceipts,
} from "../compiler/candidate-custody-snapshot.js";
import { UnsafeCandidateDirError } from "../compiler/candidate-store-paths.js";
import {
  assertCandidateIdsWritable,
  CandidateIdentityMismatchError,
  CandidateMutationScanCapacityError,
  selectCandidateEntriesForMutation,
  selectCandidateEntriesForMutationWithTotal,
  type CandidateMutationSelectionHooks,
} from "../compiler/candidate-selection.js";
import { DEFAULT_STAGED_WRITE_PER_SESSION } from "../trust/staged-change.js";
import { UnsafeCandidateIdError } from "../compiler/candidate-paths.js";
import {
  ConnectorCandidateBatchOverflowError,
  MAX_CONNECTOR_CANDIDATE_BATCH,
} from "./candidate-batch.js";
import { connectorBlockFromBody } from "./origin.js";
import {
  CandidateRecordMalformedError,
  type CandidateFileEntry,
} from "../compiler/candidate-read.js";
import { captureDenseArray, captureExactRecord, captureOwnDataRecord } from "../utils/runtime-capture.js";
import type { ReviewCandidate } from "../utils/types.js";

/** Host-owned move seam carrying root, exact file identity, direction, and receipt. */
export interface CandidateMovePort {
  move(request: CandidateCustodyMoveRequest): Promise<boolean>;
}

/** Closed outcome of one candidate supersession adapter operation. */
export type CandidateSupersessionResult =
  | { kind: "archived"; receipts: readonly CandidateCustodyReceipt[] }
  | { kind: "failed-and-restored" }
  | { kind: "recovery-required"; candidateIds: readonly string[] };

const DEFAULT_MOVE_PORT: CandidateMovePort = { move: moveCandidateWithCustody };
export const CONNECTOR_CANDIDATE_STORE_UNAVAILABLE =
  "connector candidate store unavailable";

/** Normal-run selection either returns exact entries or one fixed unavailable result. */
export interface ConnectorCandidateSelection {
  readonly totalPending: number;
  readonly entries: readonly CandidateFileEntry[];
}

/** True when selected predecessors make room for exactly one fresh intent. */
export function canStageFreshConnectorIntent(selection: ConnectorCandidateSelection): boolean {
  return selection.totalPending - selection.entries.length + 1 <=
    DEFAULT_STAGED_WRITE_PER_SESSION;
}

/** Closed normal-run selection snapshot or fixed unavailable result. */
export type ConnectorCandidateEntriesResult = ConnectorCandidateSelection | {
  kind: "unavailable";
  reason: string;
};

/** Idempotency identity from the body block first; sidecar only as legacy fallback. */
function durableProvenance(
  candidate: ReviewCandidate,
): { idempotencyKey: string; contentHash: string } | undefined {
  const block = connectorBlockFromBody(candidate.body);
  if (block) return { idempotencyKey: block.idempotencyKey, contentHash: block.contentHash };
  return candidate.connectorProvenance;
}

/** Re-enumerate a connector key, stopping before materializing selected entry 201. */
export function selectConnectorCandidateEntries(
  root: string,
  idempotencyKey: string,
): Promise<CandidateFileEntry[]> {
  return selectCandidateEntriesForMutation(
    root,
    (candidate) => durableProvenance(candidate)?.idempotencyKey === idempotencyKey,
    {
      maxSelected: MAX_CONNECTOR_CANDIDATE_BATCH,
      overflowError: () => new ConnectorCandidateBatchOverflowError(),
    },
  );
}

/** Map bounded store-authority failures into normal connector unavailable results. */
export async function selectConnectorCandidateEntriesForRun(
  root: string,
  idempotencyKey: string,
  hooks: CandidateMutationSelectionHooks = {},
): Promise<ConnectorCandidateEntriesResult> {
  try {
    await assertCandidateNamespacesHealthy(root);
    const selection = await selectCandidateEntriesForMutationWithTotal(
      root,
      (candidate) => durableProvenance(candidate)?.idempotencyKey === idempotencyKey,
      {
        maxSelected: MAX_CONNECTOR_CANDIDATE_BATCH,
        overflowError: () => new ConnectorCandidateBatchOverflowError(),
      },
      hooks,
    );
    await assertCandidateMutationAccess(root, selection.entries.length > 0);
    return selection;
  } catch (error) {
    if (error instanceof ConnectorCandidateBatchOverflowError ||
      error instanceof CandidateCustodyUnavailableError ||
      error instanceof CandidateRecordMalformedError ||
      error instanceof CandidateIdentityMismatchError ||
      error instanceof CandidateMutationScanCapacityError ||
      error instanceof UnsafeCandidateDirError ||
      error instanceof UnsafeCandidateIdError) {
      return { kind: "unavailable", reason: CONNECTOR_CANDIDATE_STORE_UNAVAILABLE };
    }
    throw error;
  }
}

/** True when a selected entry already records the fetched content hash. */
export function includesConnectorContentHash(
  entries: readonly CandidateFileEntry[],
  contentHash: string,
): boolean {
  return entries.some(({ candidate }) => durableProvenance(candidate)?.contentHash === contentHash);
}

/** Capture one direct entry's only mutation-authority fields. */
function captureEntryReceipt(value: unknown): CandidateCustodyReceipt {
  const entry = captureExactRecord(value, ["fileId", "candidate", "custodyReceipt"]);
  const candidate = captureOwnDataRecord(entry.candidate);
  if (typeof entry.fileId !== "string" || candidate.id !== entry.fileId) {
    throw new CandidateCustodyBoundaryError();
  }
  assertCandidateIdsWritable([entry.fileId, typeof candidate.id === "string" ? candidate.id : null]);
  const receipt = captureCandidateCustodyReceipt(entry.custodyReceipt);
  if (receipt.fileId !== entry.fileId) throw new CandidateCustodyBoundaryError();
  return receipt;
}

/** Revalidate direct archive input and extract frozen receipts in input order. */
function receiptsForEntries(entries: unknown): readonly CandidateCustodyReceipt[] {
  try {
    return captureDenseArray(
      entries,
      MAX_CONNECTOR_CANDIDATE_BATCH,
      captureEntryReceipt,
      () => new ConnectorCandidateBatchOverflowError(),
    );
  } catch (error) {
    if (error instanceof ConnectorCandidateBatchOverflowError ||
      error instanceof CandidateCustodyBoundaryError) throw error;
    throw new CandidateCustodyBoundaryError();
  }
}

/** Revalidate direct restore input before any path or move work. */
function captureReceiptBatch(receipts: unknown): readonly CandidateCustodyReceipt[] {
  return captureCandidateCustodyReceipts(
    receipts,
    MAX_CONNECTOR_CANDIDATE_BATCH,
    () => new ConnectorCandidateBatchOverflowError(),
  );
}

/** Build one path-free request for the candidate-store-owned mover. */
function moveRequest(
  root: string,
  receipt: CandidateCustodyReceipt,
  direction: "archive" | "restore",
): CandidateCustodyMoveRequest {
  return Object.freeze({ root, fileId: receipt.fileId, direction, receipt });
}

/** True only when every receipt proves the pending-only exact pre-state. */
async function archivePreflight(root: string, receipts: readonly CandidateCustodyReceipt[]): Promise<boolean> {
  for (const receipt of receipts) {
    if (await observeCandidateCustody(root, receipt) !== "restored") return false;
  }
  return true;
}

/** Attempt one exact restoration and classify all faults as unresolved. */
async function restoreReceipt(
  root: string,
  receipt: CandidateCustodyReceipt,
  mover: CandidateMovePort,
): Promise<boolean> {
  try {
    const before = await observeCandidateCustody(root, receipt);
    if (before === "restored") return true;
    if (before !== "archived") return false;
    await mover.move(moveRequest(root, receipt, "restore")).catch(() => false);
    return await observeCandidateCustody(root, receipt) === "restored";
  } catch {
    return false;
  }
}

/** Attempt every compensation and preserve deterministic receipt order. */
async function compensateReceipts(
  root: string,
  receipts: readonly CandidateCustodyReceipt[],
  mover: CandidateMovePort,
): Promise<CandidateSupersessionResult> {
  const candidateIds: string[] = [];
  for (const receipt of receipts) {
    if (!(await restoreReceipt(root, receipt, mover))) candidateIds.push(receipt.fileId);
  }
  return candidateIds.length === 0
    ? Object.freeze({ kind: "failed-and-restored" })
    : Object.freeze({ kind: "recovery-required", candidateIds: Object.freeze(candidateIds) });
}

/** Attempt one archive and require both mover assent and exact post-observation. */
async function archiveReceipt(
  root: string,
  receipt: CandidateCustodyReceipt,
  mover: CandidateMovePort,
): Promise<boolean> {
  try {
    const moved = await mover.move(moveRequest(root, receipt, "archive"));
    return moved && await observeCandidateCustody(root, receipt) === "archived";
  } catch {
    return false;
  }
}

/** Archive a validated batch and report incomplete in-process compensation. */
export async function archiveCandidatesWithUndo(
  root: string,
  entries: readonly CandidateFileEntry[],
  mover: CandidateMovePort = DEFAULT_MOVE_PORT,
): Promise<CandidateSupersessionResult> {
  const receipts = receiptsForEntries(entries);
  if (!(await archivePreflight(root, receipts))) return compensateReceipts(root, receipts, mover);
  for (const receipt of receipts) {
    if (await archiveReceipt(root, receipt, mover)) continue;
    return compensateReceipts(root, receipts, mover);
  }
  return Object.freeze({ kind: "archived", receipts });
}

/** Restore exact archived receipts and surface every unresolved filename identity. */
export async function restoreArchivedCandidates(
  root: string,
  receipts: readonly CandidateCustodyReceipt[],
  mover: CandidateMovePort = DEFAULT_MOVE_PORT,
): Promise<CandidateSupersessionResult> {
  const captured = captureReceiptBatch(receipts);
  return compensateReceipts(root, captured, mover);
}
