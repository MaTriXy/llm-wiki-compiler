# llmwiki-local-workflows

The optional compiler-local workflow engine. This preserves llmwiki's existing
workflow semantics; it is not llmflow or an alternative external orchestrator.

```js
import { createLocalWorkflowHost } from "llmwiki-core/local-workflow-host";
import { createLocalWorkflowRuntime } from "llmwiki-local-workflows";
const runtime = createLocalWorkflowRuntime(createLocalWorkflowHost());
```

Install the exact matching `llmwiki-core` peer. The engine requires an explicit
host and rejects a host from another core instance. Core retains persistence,
locking and mutation authority; the engine requests effects through that host.
Constructing the engine does not grant approval or trusted-write permission.

These low-level integration exports assume trusted in-process callers; they are
not a sandbox for plugins. In particular, a caller can supply a human actor to a
low-level gate operation. Use the standard interactive CLI for terminal-confirmed
human approval; the standard SDK refuses programmatic human approval as before.

Most users should continue using `llm-wiki-compiler`, whose CLI and `createWiki`
SDK compose both packages automatically. Applications needing only knowledge and
domain services can instead install `llmwiki-core`.

Build from the repository root with `npm run build`. Requires Node 24 or later.
