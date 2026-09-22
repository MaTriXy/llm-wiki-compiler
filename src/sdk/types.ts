/**
 * Standard SDK contract combining knowledge and local workflows.
 * Core-only consumers use WikiCore without requiring the workflow engine.
 */
export type * from "llmwiki-core/compiler-sdk";
import type { WikiCore } from "llmwiki-core/compiler-sdk";
import type { WikiWorkflow } from "./workflow-types.js";

export interface Wiki extends WikiCore, WikiWorkflow {}
