/**
 * @file src/connectors/stage-candidate.ts
 * @description Stages one connector replacement and performs bounded,
 * observable in-process candidate restoration when staging throws. This is a
 * compensation boundary, not a journal or a power-loss transaction.
 */

import { stageEntityPage } from "../trust/staging.js";
import {
  restoreArchivedCandidates,
  type CandidateMovePort,
} from "./candidate-supersession.js";
import {
  ConnectorCandidateBatchOverflowError,
  MAX_CONNECTOR_CANDIDATE_BATCH,
} from "./candidate-batch.js";
import { captureCandidateCustodyReceipts } from "../compiler/candidate-custody-snapshot.js";
import type { CandidateCustodyReceipt } from "../compiler/candidate-custody.js";
import type { ProfilePack } from "../profile/types.js";
import type { StagedChange } from "../trust/staged-change.js";
import type { ConnectorProvenance } from "./types.js";

/** Draft fields required by the typed connector staging seam. */
export interface ConnectorCandidateDraft {
  entityType: string;
  slug: string;
  body: string;
  provenance: ConnectorProvenance;
}

/** Closed internal staging result, including incomplete compensation. */
export type ConnectorCandidateStageResult =
  | { kind: "staged"; change: StagedChange }
  | { kind: "recovery-required"; candidateIds: readonly string[] };

/** Stage one replacement, restoring every archived filename identity on error. */
export async function stageConnectorCandidate(
  root: string,
  draft: ConnectorCandidateDraft,
  profile: ProfilePack,
  archivedReceipts: readonly CandidateCustodyReceipt[],
  mover?: CandidateMovePort,
  now?: () => Date,
  beforeStageForTest?: () => Promise<void>,
): Promise<ConnectorCandidateStageResult> {
  const capturedReceipts = captureCandidateCustodyReceipts(
    archivedReceipts,
    MAX_CONNECTOR_CANDIDATE_BATCH,
    () => new ConnectorCandidateBatchOverflowError(),
  );
  try {
    await beforeStageForTest?.();
    const change = await stageEntityPage(root, {
      entityType: draft.entityType,
      slug: draft.slug,
      body: draft.body,
      profile,
      existingStagedCount: 0,
      now,
      reviewMode: "connector",
      heldReasons: [{ code: "connector-fetched" }],
      connectorProvenance: draft.provenance,
      freshCandidateId: true,
    });
    return { kind: "staged", change };
  } catch (error) {
    const restored = await restoreArchivedCandidates(root, capturedReceipts, mover);
    if (restored.kind === "recovery-required") return restored;
    throw error;
  }
}
