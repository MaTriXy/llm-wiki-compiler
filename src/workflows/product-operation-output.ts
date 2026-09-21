/**
 * Source compatibility exports for host-bound workflow output contracts.
 * Execution helpers belong to the optional engine and require supplied services.
 */
export { productPreparationRef, recordProductOperationOutputLocked, replayProductOperationOutputLocked } from "llmwiki-local-workflows";
export type { ProductOperationStageOutput, ProductPreparationRefV1 } from "llmwiki-local-workflows";
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";
import type { LocalWorkflowHost } from "../local-workflow-host/host-contract.js";
import type { WorkflowRun } from "./types.js";
import type { WorkflowStageDef } from "../profile/types.js";
import { assertProductOperationOutputCurrent as verifyOperation, assertProductStageOutputCurrent as verifyStage } from "llmwiki-local-workflows";

type ProductObservations = Pick<LocalWorkflowHost["observations"], "locatePreparation" | "readPreparation" | "operationBundle">;

/** Preserve the public verification helper and its standard compiler observations. */
export async function assertProductOperationOutputCurrent(root: string, run: WorkflowRun, stage: WorkflowStageDef,
  observations: ProductObservations = createLocalWorkflowHost().observations): Promise<void> {
  return verifyOperation(root, run, stage, observations);
}

/** Preserve the public verification helper and its standard compiler observations. */
export async function assertProductStageOutputCurrent(root: string, run: WorkflowRun, stage: WorkflowStageDef,
  observations: ProductObservations = createLocalWorkflowHost().observations): Promise<void> {
  return verifyStage(root, run, stage, observations);
}
