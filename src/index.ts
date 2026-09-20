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
} from "./pages/list.js";

export type {
  JsonExportDocument,
  ExportJsonOptions,
  JsonExportProfileBlock,
  RelationView,
} from "./export/json-export.js";

export {
  ProviderUnavailableError,
  UnknownProviderError,
} from "./utils/provider-guard.js";

export { createWiki } from "./sdk/wiki.js";
export { startViewer, type StartViewerOptions } from "./viewer/server.js";
export type {
  ViewerDeps, LiveStageProjectionProvider, LiveStageProjectionResult,
  VerifiedStageFactsV1, VerifiedExperimentStateV1, RunProjectionAnchor,
  WorkflowRunProjectionEnvelope, WorkflowRunProblem, StageProjection,
  StageGateProjection, StageGateState, StageOutputRef,
  StageVerificationFailureV1, VerifiedFactPanelV1,
} from "./viewer/workflow-run-projection.js";
export type { RecordIntentV1 } from "./operation-bundles/record-intent.js";
export type { PreparedEffectRefV1 } from "./operation-bundles/prepare-record.js";
export type { SdkOperationOptions, WikiOperationSurface, RecordPreparationResultV1 } from "./sdk/operations-facade.js";
export type { Wiki, CreateWikiOptions, SdkCompileOptions, ContextPackOptions } from "./sdk/types.js";

// Result/input types for the Wiki facade methods, re-exported so typed
// consumers don't have to deep-import from internal module paths.
export type { IngestResult, CompileResult, QueryResult } from "./utils/types.js";
export type { IngestTextInput } from "./commands/ingest.js";
export type { LintSummary } from "./linter/types.js";
export type { ContextPack } from "./context/types.js";
export type { EvalReport } from "./eval/types.js";
export type { WikiStatus } from "./status/collect.js";
export type { PageRecord } from "./pages/read.js";
export type { SourceRecord, ListSourcesOptions, ListSourcesResult } from "./sources/store.js";
// WriteStatus is part of IngestResult — re-exported so callers needn't deep-import utils/types.
export type { WriteStatus } from "./utils/types.js";

// OKF export/import — report types and typed errors for SDK consumers.
export type { OkfExportReport } from "./export/okf/run.js";
export type { OkfImportReport, OkfImportSkip, OkfImportedPage } from "./import/run.js";
export { LockUnavailableError, QueueFullError } from "./import/run-errors.js";

// @experimental — artifact write/verify. `createWiki()` exposes `writeArtifact`/
// `verifyArtifact`; `SdkWriteArtifactInput` is the input `writeArtifact` takes,
// `ArtifactRef`/`ArtifactHealth` are the ref/health types both methods return,
// and `ArtifactVerifyUnavailableError` is the typed, catchable refusal
// `verifyArtifact` throws when no active profile declares artifact types.
export type { SdkWriteArtifactInput } from "./sdk/types.js";
export type { ArtifactRef } from "./artifacts/ref.js";
export type { ArtifactHealth } from "./artifacts/resolve.js";
export { ArtifactVerifyUnavailableError } from "./artifacts/resolve.js";
export type { VerifiedArtifactBodyV1 } from "./artifacts/read-verified.js";
export type { ArtifactSelectorV1, ArtifactDiscoveryV1 } from "./artifacts/discover.js";
export type { ArtifactMemberFileInput } from "./artifacts/members.js";

// @experimental — programmatic non-default entity-page staging loop. The
// `createWiki()` facade exposes `stageEntityPage`/`promoteStagedPage`; these are
// the input/return types consumers need. The lower-level `stageEntityPage(root,…)`
// and `promoteCandidateUnderLock` forms stay internal. API may change.
//
// Read-integration status: typed entity pages are surfaced in `status`, the JSON
// export, the wiki INDEX, the viewer graph, agent context packs (lexical ranking
// + relation-edge expansion), and semantic search (under their qualified EntityId).
export type { SdkStageEntityPageInput } from "./trust/staging.js";
export { StagingRequiresProfileError } from "./trust/staging.js";
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
} from "./trust/staged-change.js";

// @experimental — trust-gated relation writes + lifecycle transitions
// (planner-routed, shared SDK/CLI). `createWiki().createRelation` /
// `.transitionLifecycle` expose these; these are the input/return + typed-error
// types consumers need.
export type { AppendRelationInput } from "./relations/store.js";
export type { RelationRef, RelationId, CitationRef } from "./relations/types.js";
export { RelationEndpointError } from "./relations/types.js";
export { RelationWriteDeniedError, RelationsRequireProfileError } from "./trust/relation-write.js";
export type { SdkTransitionLifecycleInput } from "./sdk/types.js";
export { LifecycleTransitionUnavailableError } from "./trust/lifecycle-transition.js";
export { LifecycleTransitionError } from "./profile/lifecycle.js";
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
} from "./trust/planner.js";
export type { TrustDecision } from "./trust/decision.js";

// Experimental read-only domain contract. The unrestricted loader stays internal;
// the non-default projection preserves the existing compiler profile validation.
export { activeProfileDigest, readConfinedCappedBuffer } from "./sdk/domain-read.js";
export type { ConfinedCappedRead } from "./sdk/domain-read.js";
export { loadNonDefaultProfile } from "./profile/block.js";
// Profile pack types for callers interpreting the read-only projection.
export type {
  ProfilePack,
  EntityId,
  EntityPageRef,
  EntityPageView,
  EntityProblemView,
  LoadedProfile,
  SlugSafe,
} from "./profile/types.js";

// Experimental integration contracts retained from the internal implementation.
export { parseFrontmatter, slugify } from "./utils/markdown.js";
export { collectViewerPages, resolveBareSlug } from "./viewer/collect.js";
export type { ArtifactMemberEntry } from "./artifacts/members.js";
export { isTrustedWriteGranted } from "./workflows/trusted-write.js";
export { startProductWorkflow } from "./workflows/start.js";
export { captureVerifiedMemberArtifact } from "./artifacts/capture-member.js";
export { assertRunWorkspace, WorkflowProcessAuthorityError } from "./workflows/process-authority.js";
export { refuseWorkflow, WorkflowRefusalError } from "./workflows/refuse.js";
export { HumanInputValidationError } from "./workflows/human-input-schema.js";
export type { HumanInputStageOutput, HumanInputRefV1 } from "./workflows/human-input.js";
export type { WorkflowProcessAuthorityV1, WorkflowRefusalV1, WorkflowRun } from "./workflows/types.js";
export { atomicWrite, AtomicWriteCollisionError, AtomicWriteCommittedCleanupError, type AtomicWriteOptions, type AtomicWriteNoReplaceDurableOptions } from "./utils/atomic-write.js";
export type { SdkPreparationOptions, SdkStagePreparationInput } from "./sdk/types.js";
export type { CancelResultV1 as PreparationCancelResult, FailResultV1 as PreparationFailResult, ListResultV1 as PreparationListResult, PreparationGrant, PreparationLifecyclePendingState as PreparationLifecycleState, PreparationRunRowV1 as PreparationRunRow, PreparationRunState, PreviewResultV1 as PreparationPreviewResult, RecoveryResultV1 as PreparationRecoveryResult, StageResultV1 as PreparationStageResult } from "./preparations/service.js";
export { PrincipalAuthorityError } from "./preparations/service.js";
export type { SdkProductActionInput, SdkProductResumeInput, WikiProductSurface } from "./sdk/types.js";
export type { CompiledActionSummaryV1 as ProductActionSummary, ProductInvokeResultV1 as ProductInvokeResult, ProductPreviewResultV1 as ProductPreviewResult } from "./products/service.js";
export { locatePreparationManifest, readPreparationInitialInput, resolvePreparationRun, readPreparationRunForManifest } from "./preparations/service-run-lookup.js";
export { classifyExecutionOwnerLiveness } from "./preparations/attempts/lease.js";
export { scanPreparationInventory } from "./preparations/capacity.js";
export type { PreparationInitialInputLookupV1, PreparationManifestLookupV1, PreparationRunLookupV1 } from "./preparations/service-run-lookup.js";
export { readPreparationEvidenceBytes } from "./preparations/evidence-store.js";
export type { PreparationManifestV1 } from "./preparations/manifest-parse.js";
export { preparationManifestDigest } from "./preparations/manifest-parse.js";
export type { PhaseSummaryV1 as PreparationPhaseSummary } from "./preparations/run-types.js";
export { observeOperationBundle } from "./operation-bundles/observe.js";
export type { OperationBundleObservationV1, OperationBundleMutationV1, OperationPageObservationV1 } from "./operation-bundles/observe.js";
export type { EvidenceRefV1 as PreparationEvidenceRef } from "./preparations/types.js";
export { runPreparation } from "./preparations/runner.js";
export type { RunPreparationInputV1 as RunPreparationInput, RunPreparationResultV1 as RunPreparationResult, PreparationMaterializerV1 as PreparationMaterializer } from "./preparations/runner.js";
export { formatArtifactRef, parseArtifactRef } from "./artifacts/ref.js";
export { readVerifiedArtifactBody } from "./artifacts/read-verified.js";
export { resolveArtifactRef } from "./artifacts/resolve.js";
export { artifactPaths, memberLeafPath, readArtifactMemberBytes } from "./artifacts/store.js";
export { loadProfile } from "./profile/load.js";
export { isSlugSafe } from "./profile/identity.js";
export type { ProfileTemplatePackage } from "./profile/templates/types.js";
export { confineUnderRoot } from "./utils/path-confine.js";
export { resolveConfinedPrivateDir } from "./utils/private-dir.js";
export { releaseLock } from "./utils/lock.js";
export { acquireMutationLockBlocking } from "./operation-bundles/lock-gate.js";
export { recomputeCompositionLock } from "./operations-packs/composition-lock.js";
export { parseOperationsPack } from "./operations-packs/parse.js";
export type { PackRecipeV2 } from "./operations-packs/recipe-types.js";
export type { WorkspaceOperationsPackV2 } from "./operations-packs/types.js";
export { HOST_DECLARED_CONTRACT_SET, defaultHostCompatibility } from "./products/compatibility.js";
export { assertProductDigest } from "./products/ids.js";
export type { Sha256Digest } from "./products/ids.js";
export { recomputePackageDigest, recomputeRuntimeAuthorityDigest } from "./products/packages/verify.js";
export type { PackageMemberKind, PackageMemberRefV1, ProductPackageManifestV1 } from "./products/types.js";
export { transitionLifecycle } from "./trust/lifecycle-transition.js";
export { readRun } from "./workflows/store.js";
export { startWorkflowLocked } from "./workflows/start.js";
export { assertRunOwnership } from "./workflows/with-lock.js";
export { assertCurrentWorkflowProcessAuthority } from "./workflows/process-authority.js";
export { predecessorChainRoot, readLiveTargetDigest, mintVerifierReceipt } from "./workflows/verifier-receipt.js";
export { createVerifierRegistry, verifierImplementationDigest, type HostVerifierImplementationV1 } from "./workflows/verifier-registry.js";
export { resolveGateChallenge } from "./workflows/gate.js";
export { approveHumanGateInteractively } from "./workflows/approve-human-interactively.js";
export { currentActorIdentity } from "./workflows/actor-identity.js";
export { resolveCurrentStage } from "./workflows/advance.js";
export { assertProductOperationOutputCurrent, assertProductStageOutputCurrent } from "./workflows/product-operation-output.js";
export { DEV_PROVIDER_BOUNDS, derivePinForPayload, devEffectiveGrantRequest, devGrantScope, devModelInvokeAuthority, devProviderInvocation, devSourceReadAuthority, installDevProvider, issueDevProviderGrant } from "./capability-providers/host/index.js";
export type { DevGrantRequestContextV1, DevInvocationHostV1, InstallDevProviderRequestV1, InstalledDevProviderV1, IssueDevGrantRequestV1, IssuedDevGrantV1, ProviderBackendChannelV1, ProviderHostBackendV1, ProviderLaunchDescriptorV1 } from "./capability-providers/host/index.js";
export { resolveAuthorizedProviderPaths } from "./capability-providers/packages/paths.js";
export { canonicalBytes, canonicalDigest } from "./profile/templates/signing/canonical.js";
export { resolveProviderEntrypoint, providerLaunchEnv } from "./capability-providers/host/entrypoint.js";
export { hostModelQuoteDigest } from "./capability-providers/brokers/model.js";
export type { HostModelBrokerV1, HostModelQuoteObservationV1, HostModelQuoteRequestV1 } from "./capability-providers/brokers/model.js";
export { confinedFetch, confinedFetchRequest } from "./connectors/confined-fetch.js";
export type { FetchLimits, ConfinedFetchSeams, ConfinedFetchResult, ConfinedFetchRequest, ConfinedFetchMethod } from "./connectors/confined-fetch.js";
export { scaffoldConfinedDirectories, ensureConfinedDirectory, type ScaffoldDirectoriesResultV1 } from "./utils/confined-scaffold.js";
