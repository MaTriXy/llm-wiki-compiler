/**
 * @file src/workflows/store.ts
 * @description Execution-side run persistence. Passive reads retain their original exports.
 */
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { MAX_WORKFLOW_RUN_BYTES } from "../utils/constants.js";
import { atomicWrite } from "../utils/markdown.js";
import { safeRealpath, isInsideDir } from "../utils/path-confine.js";
import { isSlugSafe } from "../profile/identity.js";
import { appendTerminalEvent } from "./events.js";
import { loadOrCreateRunKey, runIntegrity } from "./integrity.js";
import { resolveConfinedPrivateDir } from "../utils/private-dir.js";
import { type WorkflowEvent, type WorkflowRun } from "./types.js";
import { isValidRunId, runsDirFor } from "../workflow-history/paths.js";
export { readRun, listRuns, resolveRunId, runExists } from "../workflow-history/store.js";
export type { WorkflowRunRead, WorkflowRunList, RunIdResolution } from "../workflow-history/store.js";
/**
 * Number of random bytes whose hex suffixes a minted run id. 8 bytes → a 16-hex
 * suffix (64 bits of entropy), so a same-day birthday collision is negligible
 * even at very high run volumes. (A prior value of 2 → 16 bits made a collision —
 * which, without the no-clobber start, would OVERWRITE prior run history —
 * realistic at hundreds of runs/day.)
 */
const RUN_ID_RANDOM_BYTES = 8;


/**
 * Raised when a run id that should already be slug-safe is not, on the WRITE
 * path. A typed error (not a generic `Error`) so callers can catch it distinctly.
 * The profile validator already rejects non-slug-safe workflow ids, so this is a
 * defensive last line.
 */
export class WorkflowRunIdError extends Error {
  constructor(message: string) {
    super(`workflow run id rejected: ${message}`);
    this.name = "WorkflowRunIdError";
  }
}


/**
 * Raised when a serialized run record would exceed {@link MAX_WORKFLOW_RUN_BYTES}
 * on the WRITE path. `readRun` rejects an oversize file, so writing one would
 * brick the run (unreadable forever); this fails the write CLOSED instead, with a
 * typed error callers can branch on. Thrown by {@link serializeRunWithinCap}
 * (used by `writeRun` and the stage-output preflight).
 */
export class WorkflowRunTooLargeError extends Error {
  constructor(
    /** The serialized record's byte length that breached the cap. */
    readonly bytes: number,
  ) {
    super(`workflow run record is too large: ${bytes} bytes exceeds the cap of ${MAX_WORKFLOW_RUN_BYTES}`);
    this.name = "WorkflowRunTooLargeError";
  }
}


/**
 * Raised when {@link startWorkflow}'s no-clobber create keeps colliding with an
 * existing run id past {@link MAX_MINT_ATTEMPTS}. Astronomically unlikely with the
 * minted entropy; a typed error so a pathological environment surfaces rather than
 * looping or silently overwriting prior run history.
 */
export class WorkflowRunIdCollisionError extends Error {
  constructor(attempts: number) {
    super(`could not mint a non-colliding workflow run id after ${attempts} attempts`);
    this.name = "WorkflowRunIdCollisionError";
  }
}


/**
 * Serialize a run record to its on-disk JSON, FAILING CLOSED with
 * {@link WorkflowRunTooLargeError} when the result exceeds
 * {@link MAX_WORKFLOW_RUN_BYTES}. This is the SINGLE place run bytes are sized, so
 * the writer and the reader agree on the same ceiling — a record that serializes
 * within the cap here is guaranteed readable by {@link readRun} (which rejects an
 * oversize leaf), closing the asymmetric-cap (write-unbounded / read-capped) gap.
 *
 * @param run - The run record to serialize.
 * @returns The serialized JSON, guaranteed within the byte cap.
 * @throws {WorkflowRunTooLargeError} When the serialized record exceeds the cap.
 */
export function serializeRunWithinCap(run: WorkflowRun): string {
  const json = JSON.stringify(run);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_WORKFLOW_RUN_BYTES) throw new WorkflowRunTooLargeError(bytes);
  return json;
}


/**
 * The realpath'd project root that `atomicWrite`'s `confineRoot` must use. The
 * resolvers return the REALPATH'd `.llmwiki`, so its parent IS the realpath'd root.
 */
function realRootOf(privateDir: string): string {
  return path.dirname(privateDir);
}


/**
 * Mint an opaque, slug-safe run id of the form `<workflowId>-<YYYY-MM-DD>-<rand>`.
 *
 * The date is today's `toISOString().slice(0,10)` and `rand` is the hex of
 * {@link RUN_ID_RANDOM_BYTES} random bytes from `node:crypto` (a 16-hex suffix).
 * Date/randomness are fine here — this is product code, not a workflow script. The
 * result is asserted slug-safe before returning; a non-slug-safe `workflowId`
 * cannot legitimately reach here (the profile validator rejects it) but the
 * assertion is a defensive floor.
 *
 * @param workflowId - The slug-safe id of the workflow being run.
 * @returns A slug-safe run id prefixed with `workflowId`.
 * @throws {WorkflowRunIdError} If the composed id is not slug-safe.
 */
export function mintRunId(workflowId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const rand = randomBytes(RUN_ID_RANDOM_BYTES).toString("hex");
  const runId = `${workflowId}-${date}-${rand}`;
  if (!isSlugSafe(runId)) {
    throw new WorkflowRunIdError(`composed id is not slug-safe: ${JSON.stringify(runId)}`);
  }
  return runId;
}


/**
 * Build and confine the `workflows/runs` dir under an already-confined private
 * dir: mkdir recursive, then re-confine via the WRITE resolver's recheck so a
 * swapped-in symlink escaping the private dir fails closed.
 */
async function ensureRunsDir(privateDir: string): Promise<string> {
  const runsDir = runsDirFor(privateDir);
  await mkdir(runsDir, { recursive: true });
  const realRuns = await safeRealpath(runsDir);
  if (realRuns === null || !isInsideDir(realRuns, privateDir)) {
    throw new WorkflowRunIdError("runs dir escapes the private dir");
  }
  return runsDir;
}


/**
 * Persist a run record to `.llmwiki/workflows/runs/<runId>.json`.
 *
 * Re-asserts the run id is slug-safe (the only interpolated path component),
 * resolves and confines the private dir + runs subdir, then atomic-writes the
 * serialized record through {@link atomicWrite} with `confineRoot` so a symlinked
 * leaf is never written through.
 *
 * The serialized record is SIZE-CHECKED via {@link serializeRunWithinCap} BEFORE
 * any fs call, so a record that would breach {@link MAX_WORKFLOW_RUN_BYTES} (and
 * thus be rejected forever by {@link readRun}) fails the write CLOSED rather than
 * bricking the run.
 *
 * @param root - Absolute project root.
 * @param run - The run record to persist (its `runId` is the filename stem).
 * @throws {WorkflowRunIdError} If `run.runId` is not slug-safe.
 * @throws {WorkflowRunTooLargeError} If the serialized record exceeds the byte cap.
 */
export async function writeRun(root: string, run: WorkflowRun): Promise<void> {
  if (!isValidRunId(run.runId)) {
    throw new WorkflowRunIdError(`not slug-safe or too long: ${JSON.stringify(run.runId.slice(0, 64))}`);
  }
  const stamped = await stampRunIntegrity(root, run);
  const json = serializeRunWithinCap(stamped);
  await persistRunJson(root, stamped.runId, json);
}


/**
 * Return a copy of `run` carrying a fresh `integrity` HMAC over its content (the
 * record with `integrity` itself omitted), computed under the per-project
 * {@link loadOrCreateRunKey}. STAMPED on every write so {@link readRun} can re-verify
 * it; a record not produced by THIS project's key cannot match. The key is
 * created-if-absent under the project lock the writer already holds.
 */
async function stampRunIntegrity(root: string, run: WorkflowRun): Promise<WorkflowRun> {
  const key = await loadOrCreateRunKey(root);
  return { ...run, integrity: runIntegrity(key, run) };
}


/**
 * Persist already-serialized run JSON to the confined `<runId>.json` leaf.
 *
 * Factored out so the normal {@link writeRun} and the terminal-escape
 * {@link writeTerminalRun} share the identical confinement (private dir + runs
 * subdir recheck + `atomicWrite` with `confineRoot`). `runId` is slug-safe-gated by
 * each caller, so it is the sole, safe interpolated path component.
 *
 * DURABLE: the run record is the SOURCE OF TRUTH for a run (and tracks the external
 * wiki writes its stage outputs land), so every run-record write goes through
 * `atomicWrite` with `durable: true` — fsync'd file + parent dir, surviving a power
 * loss. The hot wiki/compile path keeps the fast default elsewhere.
 */
async function persistRunJson(root: string, runId: string, json: string): Promise<void> {
  const privateDir = await resolveConfinedPrivateDir(root);
  const runsDir = await ensureRunsDir(privateDir);
  const leaf = path.join(runsDir, `${runId}.json`);
  await atomicWrite(leaf, json, { confineRoot: realRootOf(privateDir), durable: true });
}


/**
 * Return a minimized copy of a TERMINAL run that drops the large caller-controlled
 * `inputs`/`outputs`/verifier-receipt blobs (terminal evidence is historical),
 * keeping status/runId/digests/stageLog/events. A `fields-truncated` marker is
 * appended via {@link appendTerminalEvent} so the loss is auditable, never silent.
 * The marker append also compacts the event trail if needed, so the result is
 * smaller on both axes. NOTE: this does NOT shrink a record dominated by a
 * NON-clearable field (`stageLog`/`knownStageIds`/`events`); {@link terminalTombstone}
 * is the guaranteed-minimal last resort for that case.
 */
function minimizeTerminalRun(run: WorkflowRun): WorkflowRun {
  const at = new Date().toISOString();
  const { verifierReceipts: _receipts, ...withoutReceipts } = run;
  const cleared: WorkflowRun = { ...withoutReceipts, inputs: {}, outputs: {} };
  return appendTerminalEvent(cleared, {
    type: "fields-truncated", at, actorKind: "system",
    detail: _receipts === undefined
      ? "inputs/outputs cleared to fit the run byte cap on termination"
      : "inputs/outputs/verifier receipts cleared to fit the run byte cap on termination",
  });
}


/** The marker detail recorded when a terminal run is reduced to a tombstone. */
const TOMBSTONE_DETAIL =
  "stageLog/knownStageIds/satisfiedGates/inputs/outputs and prior events dropped to fit the byte cap on termination";


/**
 * Return a GUARANTEED-minimal terminal TOMBSTONE for `run` — the last-resort that
 * cannot breach the byte cap. Keeps only the bounded identity/lifecycle fields
 * (`runId` ≤ 128 chars, the 64-hex digests, the short status/timestamps) and
 * EMPTIES every unbounded array (`stageLog`/`knownStageIds`/`satisfiedGates`) and
 * blob (`inputs`/`outputs`). The `events` trail is reduced to the genesis
 * `workflow-start` (kept if present, else a synthetic minimal one) plus ONE
 * `fields-truncated` marker noting the drop, so the audit degrades gracefully and
 * never silently. Every retained field has a bounded size, so the serialized
 * tombstone is a few hundred bytes << {@link MAX_WORKFLOW_RUN_BYTES} — the terminal
 * write provably fits. The run stays terminal, so it re-reads `ok` and classifies
 * `historical`.
 */
function terminalTombstone(run: WorkflowRun): WorkflowRun {
  const at = new Date().toISOString();
  const genesis = run.events.find((e) => e.type === "workflow-start")
    ?? { type: "workflow-start" as const, at: run.startedAt, actorKind: "system" as const, stateVersionBefore: 0, stateVersionAfter: 0 };
  const marker: WorkflowEvent = {
    type: "fields-truncated", at, actorKind: "system", detail: TOMBSTONE_DETAIL,
    stateVersionBefore: run.stateVersion, stateVersionAfter: run.stateVersion + 1,
  };
  const tombstone: WorkflowRun = {
    schemaVersion: run.schemaVersion, runId: run.runId, workflowId: run.workflowId,
    workflowDigest: run.workflowDigest, profileDigest: run.profileDigest,
    status: run.status, currentStage: null, stateVersion: run.stateVersion + 1,
    startedAt: run.startedAt, updatedAt: at,
    stageLog: [], knownStageIds: [], satisfiedGates: [], inputs: {}, outputs: {},
    events: [genesis, marker],
  };
  return {
    ...tombstone,
    ...(run.processAuthority === undefined ? {} : { processAuthority: run.processAuthority }),
    ...(run.refusal === undefined ? {} : { refusal: run.refusal }),
  };
}


/**
 * Persist a TERMINAL run, ALWAYS succeeding within the byte cap. Tries the run as
 * given; if it would breach {@link MAX_WORKFLOW_RUN_BYTES}, retries with a
 * {@link minimizeTerminalRun} record (large `inputs`/`outputs` dropped + a
 * `fields-truncated` marker); if it STILL would breach (a record dominated by a
 * non-clearable field like a many-stage `stageLog`), falls back to a
 * {@link terminalTombstone} that is provably within the cap. A run is never an
 * un-retireable zombie at the byte cap. Returns the run as actually persisted.
 * Non-terminal writes keep failing closed over the cap via {@link writeRun} (correct
 * back-pressure).
 *
 * @param root - Absolute project root.
 * @param run - The terminal run to persist (its `runId` is the filename stem).
 * @returns The run as persisted (possibly minimized or tombstoned).
 * @throws {WorkflowRunIdError} If `run.runId` is not slug-safe.
 */
export async function writeTerminalRun(root: string, run: WorkflowRun): Promise<WorkflowRun> {
  if (!isValidRunId(run.runId)) {
    throw new WorkflowRunIdError(`not slug-safe or too long: ${JSON.stringify(run.runId.slice(0, 64))}`);
  }
  const key = await loadOrCreateRunKey(root);
  const stamp = (r: WorkflowRun): WorkflowRun => ({ ...r, integrity: runIntegrity(key, r) });
  const persisted = fitTerminalRun(run, stamp);
  await persistRunJson(root, persisted.run.runId, persisted.json);
  return persisted.run;
}


/** Stamp+serialize `run` if it fits the byte cap, else `null` (so the caller can degrade). */
function serializeIfFits(run: WorkflowRun, stamp: (r: WorkflowRun) => WorkflowRun): { run: WorkflowRun; json: string } | null {
  const stamped = stamp(run);
  try {
    return { run: stamped, json: serializeRunWithinCap(stamped) };
  } catch (err) {
    if (err instanceof WorkflowRunTooLargeError) return null;
    throw err;
  }
}


/**
 * Resolve a terminal run to the LARGEST representation that fits the byte cap, in
 * three tiers: the run as-is → {@link minimizeTerminalRun} → {@link terminalTombstone}
 * (provably within the cap, so the final serialize cannot throw). Each tier is
 * `stamp`ed with its integrity HMAC BEFORE the byte-cap check, so the persisted bytes
 * (which INCLUDE `integrity`) are what the cap is measured against — the tamper stamp
 * never tips an at-cap record over after the fact.
 */
function fitTerminalRun(run: WorkflowRun, stamp: (r: WorkflowRun) => WorkflowRun): { run: WorkflowRun; json: string } {
  const asIs = serializeIfFits(run, stamp);
  if (asIs !== null) return asIs;
  const minJson = serializeIfFits(minimizeTerminalRun(run), stamp);
  if (minJson !== null) return minJson;
  const tombstone = stamp(terminalTombstone(run));
  return { run: tombstone, json: serializeRunWithinCap(tombstone) };
}
