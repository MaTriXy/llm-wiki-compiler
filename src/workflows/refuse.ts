/**
 * @file src/workflows/refuse.ts
 * @description Irreversibly settles an active product workflow as refused from
 * a terminal disposition declared by its digest-bound process definition. The
 * caller supplies evidence and a verifier result; core derives the reason.
 */

import { loadProfile } from "../profile/load.js";
import { parseArtifactRef, formatArtifactRef, type ArtifactRef } from "../artifacts/ref.js";
import { resolveArtifactRef } from "../artifacts/resolve.js";
import { RunNotActiveError } from "./errors.js";
import { resolveTerminalDisposition } from "./process-definition.js";
import { commitTerminalEvent, isTerminalStatus, withRunLock } from "./with-lock.js";
import { maybeAutoProject } from "./projection.js";
import type { WorkflowRun } from "./types.js";

/** Inputs that select a declared disposition and its retained evidence. */
export interface RefuseWorkflowOptionsV1 {
  verifierResult: string;
  evidenceRef: ArtifactRef | string;
}

/** A refusal whose evidence is malformed, unhealthy, or out of authority. */
export class WorkflowRefusalError extends Error {
  constructor(readonly reason: string) {
    super(`workflow refusal is ${reason}`);
    this.name = "WorkflowRefusalError";
  }
}

/** Parse and verify the exact evidence artifact under the active profile. */
async function verifiedEvidenceRef(
  root: string, supplied: ArtifactRef | string,
): Promise<string> {
  const ref = typeof supplied === "string" ? parseArtifactRef(supplied) : supplied;
  if (ref === null) throw new WorkflowRefusalError("malformed-evidence-ref");
  const compact = formatArtifactRef(ref);
  if (parseArtifactRef(compact) === null) throw new WorkflowRefusalError("malformed-evidence-ref");
  const { profile } = await loadProfile(root);
  if ((await resolveArtifactRef(root, profile, ref)).health !== "ok") {
    throw new WorkflowRefusalError("evidence-not-verified");
  }
  return compact;
}

/** Mark the current stage completed without disturbing earlier stage history. */
function completeCurrentStage(run: WorkflowRun): WorkflowRun {
  return {
    ...run,
    stageLog: run.stageLog.map((entry) =>
      entry.stageId === run.currentStage ? { ...entry, status: "completed" } : entry),
  };
}

/** Irreversibly refuse a run using its process-declared terminal disposition. */
export async function refuseWorkflow(
  root: string, runId: string, options: RefuseWorkflowOptionsV1,
): Promise<WorkflowRun> {
  const run = await withRunLock(root, runId, async (locked) => {
    if (isTerminalStatus(locked.status)) throw new RunNotActiveError(runId, locked.status);
    if (locked.processAuthority === undefined) throw new WorkflowRefusalError("process-authority-required");
    const disposition = await resolveTerminalDisposition(root, locked, options.verifierResult);
    const evidenceRef = await verifiedEvidenceRef(root, options.evidenceRef);
    const refusedAt = new Date().toISOString();
    const refusal = {
      reasonCode: disposition.reasonCode,
      evidenceRef,
      refusedAt,
      predecessorStateVersion: locked.stateVersion,
      processDefinitionDigest: locked.processAuthority.processDefinitionDigest,
    };
    return commitTerminalEvent(root, completeCurrentStage(locked), {
      type: "run-refused", at: refusedAt, actorKind: "system",
      stageId: locked.currentStage ?? undefined, decision: disposition.reasonCode,
    }, { status: "refused", currentStage: null, refusal });
  });
  await maybeAutoProject(root, run);
  return run;
}
