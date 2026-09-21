/**
 * Standard failure entry point. The engine receives explicit persistence;
 * the public operation retains its original arguments and compiler host.
 */
export { markRunFailedLocked, failWorkflowWithHost } from "llmwiki-local-workflows";
import { failWorkflowWithHost } from "llmwiki-local-workflows";
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";
import type { WorkflowRun } from "./types.js";

/** Fail through the standard compiler host. */
export async function failWorkflow(root: string, runId: string, detail: string): Promise<WorkflowRun> {
  return failWorkflowWithHost(createLocalWorkflowHost(), root, runId, detail);
}
