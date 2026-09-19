/**
 * @file Core-owned public human approval entry point. Couples the displayed
 * subject and process TTY token proof to the internal, under-lock approval.
 */
import { approveGate, resolveGateChallenge } from "./gate.js";
import { confirmHumanGateInteractively } from "./human-gate-confirm.js";
import { processTerminalLineIo } from "../utils/terminal-line.js";
import { currentActorIdentity } from "./actor-identity.js";

/** Approve only the exact subject confirmed through this process's terminal. */
export async function approveHumanGateInteractively(root: string, runId: string, gateId: string) {
  const io = processTerminalLineIo();
  if (!io.stdinIsTty || !io.stdoutIsTty) throw new Error("human approval requires an interactive TTY");
  const challenge = await resolveGateChallenge(root, runId, gateId);
  if (challenge.kind !== "human") throw new Error("gate is not a human gate");
  if (!await confirmHumanGateInteractively(gateId, io, challenge.subjectDigest)) {
    throw new Error("human gate was not interactively confirmed");
  }
  return approveGate(root, runId, gateId, {
    actorKind: "human", actorLabel: currentActorIdentity(), expectedSubjectDigest: challenge.subjectDigest,
  });
}
