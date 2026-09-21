/**
 * Standard compatibility entry points for refuse.
 * The engine receives services; this facade constructs the compiler host.
 */
export { refuseWorkflowWithHost, WorkflowRefusalError } from "llmwiki-local-workflows";
export type { RefuseWorkflowOptionsV1 } from "llmwiki-local-workflows";
import { refuseWorkflowWithHost } from "llmwiki-local-workflows";
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";
import type { RefuseWorkflowOptionsV1 } from "llmwiki-local-workflows";
import type { WorkflowRun } from "./types.js";


/** Irreversibly refuse a run using its process-declared terminal disposition. */
export async function refuseWorkflow(
  root: string, runId: string, options: RefuseWorkflowOptionsV1,
): Promise<WorkflowRun> {
  return refuseWorkflowWithHost(createLocalWorkflowHost(), root, runId, options);
}
