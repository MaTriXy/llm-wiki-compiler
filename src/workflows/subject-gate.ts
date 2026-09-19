/**
 * @file src/workflows/subject-gate.ts
 * @description Small adapter between an optional stage subject-gate declaration
 * and approval-subject verification. Ordinary gates remain byte-compatible and
 * return no subject digest; declared subject gates always fail closed on drift.
 */

import { SubjectGateVerificationError, verifyApprovalSubject } from "./approval-subject.js";
import { parseGate } from "./gates.js";
import type { WorkflowStageDef } from "../profile/types.js";
import type { WorkflowRun } from "./types.js";

/** Resolve an optional verified subject digest for one current-stage gate. */
export async function subjectDigestForGate(
  root: string, run: WorkflowRun, stage: WorkflowStageDef, gateId: string,
): Promise<string | undefined> {
  if (stage.subjectGate === undefined) return undefined;
  return verifyApprovalSubject(root, run, stage.id, gateId, stage.subjectGate);
}

/** Reverify that the recorded approval still covers the live subject. */
export async function assertApprovedSubjectCurrent(
  root: string, run: WorkflowRun, stage: WorkflowStageDef,
): Promise<void> {
  if (stage.subjectGate === undefined) return;
  const gate = parseGate(stage.gate ?? "");
  if (gate === null) throw new SubjectGateVerificationError("subject-gate-missing");
  const current = await verifyApprovalSubject(root, run, stage.id, gate.id, stage.subjectGate);
  const approval = [...run.events].reverse().find((event) =>
    event.type === "gate-approved" && event.stageId === stage.id && event.gateId === gate.id);
  if (approval?.subjectDigest !== current) {
    throw new SubjectGateVerificationError("approval-subject-drift");
  }
}
