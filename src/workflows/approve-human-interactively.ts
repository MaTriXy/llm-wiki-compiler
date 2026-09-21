/**
 * Standard-distribution compatibility entry points for approve-human-interactively.
 * Host construction stays here; optional engine operations receive a host.
 */
export { approveHumanGateWithHost } from "llmwiki-local-workflows";
import { approveHumanGateWithHost } from "llmwiki-local-workflows";
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";



/** Approve only the exact subject confirmed through this process's terminal. */
export async function approveHumanGateInteractively(root: string, runId: string, gateId: string) {
  return approveHumanGateWithHost(createLocalWorkflowHost(), root, runId, gateId);
}
