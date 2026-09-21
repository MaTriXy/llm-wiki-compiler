/**
 * Source compatibility export; implementation belongs to the optional engine.
 * Standard callers and the extracted runtime share the same module identities.
 */
export { runWriter, terminalRunWriter, projectWithHost } from "llmwiki-local-workflows";
export type { WorkflowExecutionContext, RunWriter, TerminalRunWriter } from "llmwiki-local-workflows";
