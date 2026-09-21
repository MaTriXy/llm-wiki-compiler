/**
 * Standard stage-output composition. Existing callers keep the same output and
 * option contracts; the optional engine receives compiler services explicitly.
 */
export { submitStageOutputWithHost } from "llmwiki-local-workflows";
export type { PageStageOutput, RelationStageOutput, LifecycleStageOutput, StageOutput, SubmitResult } from "llmwiki-local-workflows";
import { submitStageOutputWithHost, type StageOutput, type SubmitResult } from "llmwiki-local-workflows";
import type { SubmitStageOutputOptions } from "./artifact-output.js";
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";

const legacyHost = createLocalWorkflowHost();

/** Submit through the standard host, preserving synchronous input capture. */
export function submitStageOutput(
  root: string, runId: string, output: StageOutput, opts: SubmitStageOutputOptions = {},
): Promise<SubmitResult> {
  return submitStageOutputWithHost(legacyHost, root, runId, output, opts);
}
