/**
 * @file src/index.ts
 * @description Public SDK surface for llm-wiki-compiler.
 *
 * Re-exports consumer-facing types, errors, and opt-in integration surfaces.
 * Experimental APIs retain their individual stability annotations. Commander
 * setup and prompts remain CLI internals; the viewer has an explicit embedding
 * entry point. Product instances and external workflow engines are not bundled.
 *
 * Consumers can import types and errors directly:
 *   import type { Page, PageRef } from "llm-wiki-compiler";
 *   import { ProviderUnavailableError } from "llm-wiki-compiler";
 */

export type {
  Page,
  PageRef,
  PageDirectory,
  ListPagesOptions,
  ListPagesResult,
  ListPagesProfileBlock,
} from "llmwiki-core";

export type {
  JsonExportDocument,
  ExportJsonOptions,
  JsonExportProfileBlock,
  RelationView,
} from "llmwiki-core";

export {
  ProviderUnavailableError,
  UnknownProviderError,
} from "llmwiki-core";

export { createWiki } from "./sdk/wiki.js";
export { startViewer, type StartViewerOptions } from "llmwiki-core";
export type {
  ViewerDeps, LiveStageProjectionProvider, LiveStageProjectionResult,
  VerifiedStageFactsV1, VerifiedExperimentStateV1, RunProjectionAnchor,
  WorkflowRunProjectionEnvelope, WorkflowRunProblem, StageProjection,
  StageGateProjection, StageGateState, StageOutputRef,
  StageVerificationFailureV1, VerifiedFactPanelV1,
} from "llmwiki-core";
export type { RecordIntentV1 } from "llmwiki-core";
export type { PreparedEffectRefV1 } from "llmwiki-core";
export type { SdkOperationOptions, WikiOperationSurface, RecordPreparationResultV1 } from "llmwiki-core";
export type { Wiki } from "./sdk/types.js";
export type { CreateWikiOptions, SdkCompileOptions, ContextPackOptions } from "llmwiki-core";

// Result/input types for the Wiki facade methods, re-exported so typed
// consumers don't have to deep-import from internal module paths.
export type { IngestResult, CompileResult, QueryResult } from "llmwiki-core";
export type { IngestTextInput } from "llmwiki-core";
export type { LintSummary } from "llmwiki-core";
export type { ContextPack } from "llmwiki-core";
export type { EvalReport } from "llmwiki-core";
export type { WikiStatus } from "llmwiki-core";
export type { PageRecord } from "llmwiki-core";
export type { SourceRecord, ListSourcesOptions, ListSourcesResult } from "llmwiki-core";
// WriteStatus is part of IngestResult — re-exported so callers needn't deep-import utils/types.
export type { WriteStatus } from "llmwiki-core";

// OKF export/import — report types and typed errors for SDK consumers.
export type { OkfExportReport } from "llmwiki-core";
export type { OkfImportReport, OkfImportSkip, OkfImportedPage } from "llmwiki-core";
export { LockUnavailableError, QueueFullError } from "llmwiki-core";

// @experimental — artifact write/verify. `createWiki()` exposes `writeArtifact`/
// `verifyArtifact`; `SdkWriteArtifactInput` is the input `writeArtifact` takes,
// `ArtifactRef`/`ArtifactHealth` are the ref/health types both methods return,
// and `ArtifactVerifyUnavailableError` is the typed, catchable refusal
// `verifyArtifact` throws when no active profile declares artifact types.
export type { SdkWriteArtifactInput } from "llmwiki-core";
export type { ArtifactRef } from "llmwiki-core";
export type { ArtifactHealth } from "llmwiki-core";
export { ArtifactVerifyUnavailableError } from "llmwiki-core";
export type { VerifiedArtifactBodyV1 } from "llmwiki-core";
export type { ArtifactSelectorV1, ArtifactDiscoveryV1 } from "llmwiki-core";
export type { ArtifactMemberFileInput } from "llmwiki-core";

// @experimental — programmatic non-default entity-page staging loop. The
// `createWiki()` facade exposes `stageEntityPage`/`promoteStagedPage`; these are
// the input/return types consumers need. The lower-level `stageEntityPage(root,…)`
// and `promoteCandidateUnderLock` forms stay internal. API may change.
//
// Read-integration status: typed entity pages are surfaced in `status`, the JSON
// export, the wiki INDEX, the viewer graph, agent context packs (lexical ranking
// + relation-edge expansion), and semantic search (under their qualified EntityId).
export type { SdkStageEntityPageInput } from "llmwiki-core";
export { StagingRequiresProfileError } from "llmwiki-core";
// The staged-change RELATION/ARTIFACT targets are Phase-4 STUB shapes named
// `Staged…` so the canonical relation `RelationRef` (from `relations/types.ts`,
// below) owns the unprefixed name.
export type {
  StagedChange,
  CandidateKind,
  HeldReasonCode,
  WorkflowRunRef,
  StagedRelationRef,
  StagedArtifactRef,
} from "llmwiki-core";

// @experimental — trust-gated relation writes + lifecycle transitions
// (planner-routed, shared SDK/CLI). `createWiki().createRelation` /
// `.transitionLifecycle` expose these; these are the input/return + typed-error
// types consumers need.
export type { AppendRelationInput } from "llmwiki-core";
export type { RelationRef, RelationId, CitationRef } from "llmwiki-core";
export { RelationEndpointError } from "llmwiki-core";
export { RelationWriteDeniedError, RelationsRequireProfileError } from "llmwiki-core";
export type { SdkTransitionLifecycleInput } from "llmwiki-core";
export { LifecycleTransitionUnavailableError } from "llmwiki-core";
export { LifecycleTransitionError } from "llmwiki-core";
// Planner sub-types named by `StagedChange.target` / `.planned` so the staged
// surface is fully nameable by consumers (the typed `EntityRef` target especially).
export type {
  EntityRef,
  RawPageRef,
  MutationTarget,
  MutationOperation,
  MutationKind,
  PlannedMutation,
  MutationProvenance,
} from "llmwiki-core";
export type { TrustDecision } from "llmwiki-core";

// Experimental read-only domain contract. The unrestricted loader stays internal;
// the non-default projection preserves the existing compiler profile validation.
export { activeProfileDigest, readConfinedCappedBuffer } from "llmwiki-core";
export type { ConfinedCappedRead } from "llmwiki-core";
export { loadNonDefaultProfile } from "llmwiki-core";
// Profile pack types for callers interpreting the read-only projection.
export type {
  ProfilePack,
  EntityId,
  EntityPageRef,
  EntityPageView,
  EntityProblemView,
  LoadedProfile,
  SlugSafe,
} from "llmwiki-core";

// Experimental integration contracts retained from the internal implementation.
export { parseFrontmatter, slugify } from "llmwiki-core";
export { collectViewerPages, resolveBareSlug } from "llmwiki-core";
export type { ArtifactMemberEntry } from "llmwiki-core";
export { isTrustedWriteGranted } from "llmwiki-core";
export { startProductWorkflow } from "./workflows/start.js";
export { captureVerifiedMemberArtifact } from "llmwiki-core";
export { assertRunWorkspace, WorkflowProcessAuthorityError } from "llmwiki-core";
export { refuseWorkflow, WorkflowRefusalError } from "./workflows/refuse.js";
export { HumanInputValidationError } from "./workflows/human-input-schema.js";
export type { HumanInputStageOutput, HumanInputRefV1 } from "./workflows/human-input.js";
export type { WorkflowProcessAuthorityV1, WorkflowRefusalV1, WorkflowRun } from "llmwiki-core";
export { atomicWrite, AtomicWriteCollisionError, AtomicWriteCommittedCleanupError, type AtomicWriteOptions, type AtomicWriteNoReplaceDurableOptions } from "llmwiki-core";
export type { SdkPreparationOptions, SdkStagePreparationInput } from "llmwiki-core";
export type { PreparationCancelResult, PreparationFailResult, PreparationListResult, PreparationGrant, PreparationLifecycleState, PreparationRunRow, PreparationRunState, PreparationPreviewResult, PreparationRecoveryResult, PreparationStageResult } from "llmwiki-core";
export { PrincipalAuthorityError } from "llmwiki-core";
export type { SdkProductActionInput, SdkProductResumeInput, WikiProductSurface } from "llmwiki-core";
export type { ProductActionSummary, ProductInvokeResult, ProductPreviewResult } from "llmwiki-core";
export { locatePreparationManifest, readPreparationInitialInput, resolvePreparationRun, readPreparationRunForManifest } from "llmwiki-core";
export { classifyExecutionOwnerLiveness } from "llmwiki-core";
export { scanPreparationInventory } from "llmwiki-core";
export type { PreparationInitialInputLookupV1, PreparationManifestLookupV1, PreparationRunLookupV1 } from "llmwiki-core";
export { readPreparationEvidenceBytes } from "llmwiki-core";
export type { PreparationManifestV1 } from "llmwiki-core";
export { preparationManifestDigest } from "llmwiki-core";
export type { PreparationPhaseSummary } from "llmwiki-core";
export { observeOperationBundle } from "llmwiki-core";
export type { OperationBundleObservationV1, OperationBundleMutationV1, OperationPageObservationV1 } from "llmwiki-core";
export type { PreparationEvidenceRef } from "llmwiki-core";
export { runPreparation } from "llmwiki-core";
export type { RunPreparationInput, RunPreparationResult, PreparationMaterializer } from "llmwiki-core";
export { formatArtifactRef, parseArtifactRef } from "llmwiki-core";
export { readVerifiedArtifactBody } from "llmwiki-core";
export { resolveArtifactRef } from "llmwiki-core";
export { artifactPaths, memberLeafPath, readArtifactMemberBytes } from "llmwiki-core";
export { loadProfile } from "llmwiki-core";
export { isSlugSafe } from "llmwiki-core";
export type { ProfileTemplatePackage } from "llmwiki-core";
export { confineUnderRoot } from "llmwiki-core";
export { resolveConfinedPrivateDir } from "llmwiki-core";
export { releaseLock } from "llmwiki-core";
export { acquireMutationLockBlocking } from "llmwiki-core";
export { recomputeCompositionLock } from "llmwiki-core";
export { parseOperationsPack } from "llmwiki-core";
export type { PackRecipeV2 } from "llmwiki-core";
export type { WorkspaceOperationsPackV2 } from "llmwiki-core";
export { HOST_DECLARED_CONTRACT_SET, defaultHostCompatibility } from "llmwiki-core";
export { assertProductDigest } from "llmwiki-core";
export type { Sha256Digest } from "llmwiki-core";
export { recomputePackageDigest, recomputeRuntimeAuthorityDigest } from "llmwiki-core";
export type { PackageMemberKind, PackageMemberRefV1, ProductPackageManifestV1 } from "llmwiki-core";
export { transitionLifecycle } from "llmwiki-core";
export { readRun } from "llmwiki-core";
export { startWorkflowLocked } from "./workflows/start.js";
export { assertRunOwnership } from "./workflows/with-lock.js";
export { assertCurrentWorkflowProcessAuthority } from "llmwiki-core";
export { predecessorChainRoot, readLiveTargetDigest, mintVerifierReceipt } from "./workflows/verifier-receipt.js";
export { createVerifierRegistry, verifierImplementationDigest, type HostVerifierImplementationV1 } from "./workflows/verifier-registry.js";
export { resolveGateChallenge } from "./workflows/gate.js";
export { approveHumanGateInteractively } from "./workflows/approve-human-interactively.js";
export { currentActorIdentity } from "./workflows/actor-identity.js";
export { resolveCurrentStage } from "./workflows/advance.js";
export { assertProductOperationOutputCurrent, assertProductStageOutputCurrent } from "./workflows/product-operation-output.js";
export { DEV_PROVIDER_BOUNDS, derivePinForPayload, devEffectiveGrantRequest, devGrantScope, devModelInvokeAuthority, devProviderInvocation, devSourceReadAuthority, installDevProvider, issueDevProviderGrant } from "llmwiki-core";
export type { DevGrantRequestContextV1, DevInvocationHostV1, InstallDevProviderRequestV1, InstalledDevProviderV1, IssueDevGrantRequestV1, IssuedDevGrantV1, ProviderBackendChannelV1, ProviderHostBackendV1, ProviderLaunchDescriptorV1 } from "llmwiki-core";
export { resolveAuthorizedProviderPaths } from "llmwiki-core";
export { canonicalBytes, canonicalDigest } from "llmwiki-core";
export { resolveProviderEntrypoint, providerLaunchEnv } from "llmwiki-core";
export { hostModelQuoteDigest } from "llmwiki-core";
export type { HostModelBrokerV1, HostModelQuoteObservationV1, HostModelQuoteRequestV1 } from "llmwiki-core";
export { confinedFetch, confinedFetchRequest } from "llmwiki-core";
export type { FetchLimits, ConfinedFetchSeams, ConfinedFetchResult, ConfinedFetchRequest, ConfinedFetchMethod } from "llmwiki-core";
export { scaffoldConfinedDirectories, ensureConfinedDirectory, type ScaffoldDirectoriesResultV1 } from "llmwiki-core";
