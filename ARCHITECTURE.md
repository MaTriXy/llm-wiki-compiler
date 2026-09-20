# Compiler, integrations, and products

llmwiki is a knowledge compiler and an authoritative domain-record substrate.
An application can use it without adopting a particular product ontology or
an external workflow engine. The default CLI and default profile remain the
base product, not a hidden installation of AutoSci, Newsroom, or llmflow.

## Ownership

| Layer | Responsibility | Source boundary |
| --- | --- | --- |
| Base compiler | Ingest sources, compile and query knowledge, link pages, search, lint, export, and view | Commands and their shared services under `src/` |
| Configurable domain capabilities | Profiles and typed records, relations, retained artifacts, provenance, reviewed mutations, receipts and authority checks | `src/profile`, `artifacts`, `relations`, `trust`, `operation-bundles`, and supporting services |
| Compiler-local execution | Execute declared actions and durable preparations; preserve existing experimental workflow commands and SDK methods | `src/products`, `preparations`, `workflows`, and their SDK facades |
| External orchestration | Coordinate a product's overall process, human decisions, revisions, repeated occurrences, and operator workbench | llmflow, outside this repository |
| Product implementation | Domain policy, providers, editorial/scientific decisions, product-specific UI and export assembly | Product packages or modules outside compiler core |

The word `product` in a compiler service denotes a generic declarative package
and action contract. It does not mean that the service implements Newsroom or
AutoSci. Likewise, accepting a workflow parent reference associates a compiler
effect with an external run; it does not delegate compiler mutation authority
to the workflow engine.

## Integration direction and authority

Applications call the SDK. SDK facades call compiler services. Those services
enforce the active profile, path confinement, grants, reviewed changes, and
artifact verification. Core must not import product implementations or an
external orchestration engine. `test/product-boundary-genericity.test.ts` checks
that direction for statically resolvable TypeScript source imports and instance
identities, plus direct manifest dependencies on known product and engine
packages. The named-package guard is a maintained list, not proof against
computed imports or every possible future package name.

An external coordinator owns the decision to request work. The compiler owns
whether that work is authorized and what was retained or applied. An SDK
preparation grant is not an operation-approval grant. In particular, preparing
a record or invoking a product action does not implicitly approve its bundle;
the separately authorized operator apply path remains necessary.

## Configuration is not a bundled product application

The built-in `autosci` and `newsroom` profile templates remain available for
compatibility. They describe domain schemas and declarations. They are not the
standalone research/editorial applications and do not install their providers
or orchestrators. Removing the templates would unnecessarily break public
configuration and installation behavior.

Existing experimental compiler-local workflow APIs also remain supported on
their existing terms. They predate the external orchestration split. This
separation does not silently remove them, route them through llmflow, or declare
all workflow-related compiler code obsolete. New llmflow product coordination
belongs in llmflow; reusable record and authority mechanisms belong here.

### Passive history versus local execution

`src/workflow-history` owns the persisted local-run schema, validation, HMAC
verification, definition lookup, and read-only status projection. It does not
depend on `src/workflows`. Template audits, export checks, parent-reference
verification, linting, and viewer history read this passive layer directly.
The shared trusted-write predicate lives in `src/trust/trusted-write.ts`.

Run mutations and secret-key creation remain in `src/workflows`. Existing
module paths forward to the shared implementations, preserving function and
error-class identity, stored bytes, public SDK names, and CLI behavior. This is
the first extraction step, not yet an independently installable package: the
host-service interface and package manifests still need to be separated before
the local engine becomes optional for a core-only consumer.

## Viewer extension boundary

The generic viewer consumes a bounded, verified projection. New providers use
the product-neutral `factPanel` contract; labels and values remain text, with
closed presentation tones. A provider contributes facts, not markup or mutation
authority. Verification failures degrade the display to recorded-only.

The older `experimentState` wire field and `VerifiedExperimentStateV1` type are
retained for existing consumers. Their scientific validation lives in
`src/viewer/compat/experiment-state.ts`, and their presentation lives in
`src/viewer/assets/viewer-experiment-compat.js`. The generic stage-fact renderer
does not interpret hypotheses or scientific verdicts. This is a bounded
compatibility exception, not a pattern for adding product-specific fields.

## Deciding where a new feature belongs

- Keep mechanisms that work across ontologies in the compiler: record contracts,
  retained bytes, evidence references, confinement, verification, and authorized
  mutation.
- Put process sequencing, revision strategy, and human interaction in the
  external coordinator when building an llmflow product.
- Put domain judgments and provider implementations in product or reusable
  external modules. A compiler profile may declare their data contracts without
  importing their implementation.
- Preserve existing public behavior and API names during structural cleanup.
  Removing a compatibility surface or moving its authority is a separate,
  explicitly reviewed compatibility decision.
