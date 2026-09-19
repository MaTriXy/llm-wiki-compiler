/**
 * @file test/query-embedding-degrade.test.ts
 * @description D29 fix (ii): with a v3 store PRESENT, a failing embedding call
 * (the keyless configuration — an agent provider that cannot embed) degrades
 * the page-level leg to the LLM/index fallback — which needs no embedder —
 * with an `embedding-degraded` warning, instead of aborting the whole query.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTempRoot } from "./fixtures/temp-root.js";
import { writePage } from "./fixtures/write-page.js";
import { pageEntryOf, writePageStore } from "./fixtures/typed-grounding.js";
import * as providerMod from "../src/utils/provider.js";
import { generateAnswer } from "../src/commands/query.js";

// Selection call (tools present) picks the seeded concept; answer call echoes
// its grounding prompt — neither needs an embedder, which is the point.
vi.mock("../src/utils/llm.js", () => ({
  callClaude: vi.fn(async (opts: { tools?: unknown[]; messages: Array<{ content: string }> }) =>
    opts.tools ? JSON.stringify({ pages: ["concepts/alpha"], reasoning: "r" }) : opts.messages[0].content),
}));

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** Seed a project whose v3 PAGE store is live for one concept page. */
async function seedRootWithPageStore(): Promise<string> {
  const root = await makeTempRoot("embed-degrade");
  roots.push(root);
  await writeFile(path.join(root, "wiki", "index.md"), "# Index\n");
  await writePage(path.join(root, "wiki/concepts"), "alpha", { title: "Alpha", summary: "a" }, "ALPHA_BODY fact.");
  await mkdir(path.join(root, ".llmwiki"), { recursive: true });
  await writePageStore(root, [pageEntryOf("concepts/alpha", "Alpha", "a", [1, 0])]);
  return root;
}

describe("page-level embedding failure degrades to the fallback", () => {
  it("answers via LLM/index selection and carries the embedding-degraded warning", async () => {
    const root = await seedRootWithPageStore();
    const embed = vi.fn(async () => {
      throw new Error("no embedding credentials");
    });
    vi.spyOn(providerMod, "getProvider").mockReturnValue(
      { embed, embedBatch: embed } as unknown as ReturnType<typeof providerMod.getProvider>,
    );

    const result = await generateAnswer(root, "what is alpha?");
    // PRECONDITION pinned: the v3 store was loaded and the embed call was
    // actually reached — the degrade is witnessed, not vacuously absent.
    expect(embed, "the embedding path was never reached").toHaveBeenCalled();
    expect(result.answer).toContain("ALPHA_BODY");
    expect(result.pageIds).toEqual(["concepts/alpha"]);
    expect((result.warnings ?? []).map((w) => w.code)).toContain("embedding-degraded");
  });
});
