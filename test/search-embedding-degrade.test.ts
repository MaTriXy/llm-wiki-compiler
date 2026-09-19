/**
 * @file test/search-embedding-degrade.test.ts
 * @description The `search` sibling of the query embedding-degrade fix: with a
 * v3 store PRESENT, a failing embedding call (the keyless configuration — an
 * agent provider that cannot embed) degrades `pickSearchRefs` to the LLM/index
 * fallback — which needs no embedder — with an `embedding-degraded` warning,
 * instead of aborting the whole search.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTempRoot } from "./fixtures/temp-root.js";
import { writePage } from "./fixtures/write-page.js";
import { pageEntryOf, writePageStore } from "./fixtures/typed-grounding.js";
import * as providerMod from "../src/utils/provider.js";
import { pickSearchRefs } from "../src/search/retrieval.js";

// The fallback's page-selection call (tools present) picks the seeded concept;
// it needs no embedder, which is the point.
vi.mock("../src/utils/llm.js", () => ({
  callClaude: vi.fn(async () => JSON.stringify({ pages: ["concepts/alpha"], reasoning: "r" })),
}));

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("search embedding failure degrades to the fallback", () => {
  it("returns fallback refs and carries the embedding-degraded warning", async () => {
    const root = await makeTempRoot("search-embed-degrade");
    roots.push(root);
    await writeFile(path.join(root, "wiki", "index.md"), "# Index\n");
    await writePage(path.join(root, "wiki/concepts"), "alpha", { title: "Alpha", summary: "a" }, "ALPHA_BODY fact.");
    await mkdir(path.join(root, ".llmwiki"), { recursive: true });
    await writePageStore(root, [pageEntryOf("concepts/alpha", "Alpha", "a", [1, 0])]);
    const embed = vi.fn(async () => {
      throw new Error("no embedding credentials");
    });
    vi.spyOn(providerMod, "getProvider").mockReturnValue(
      { embed, embedBatch: embed } as unknown as ReturnType<typeof providerMod.getProvider>,
    );

    const { refs, warnings } = await pickSearchRefs(root, "what is alpha?");
    // PRECONDITION pinned: the v3 store was loaded and the embed call was
    // actually reached — the degrade is witnessed, not vacuously absent.
    expect(embed, "the embedding path was never reached").toHaveBeenCalled();
    expect(refs.map((ref) => ref.pageId)).toEqual(["concepts/alpha"]);
    expect(warnings.map((w) => w.code)).toContain("embedding-degraded");
  });
});
