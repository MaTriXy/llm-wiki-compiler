/**
 * @file test/lint-tiered-cli.test.ts
 * @description §4.6 `check` through the BUILT binary: one run over a wiki
 * holding both a FACT problem (a broken wikilink) and a JUDGEMENT problem (a
 * stored low-confidence assessment) reports them in SEPARATE tiers — the
 * separation is the §4.6 outcome, and it was never driven end to end.
 *
 * The judgement finding reads STORED provenance metadata, so the tier is
 * exercised without a live model; authoring that metadata with a configured
 * review provider remains unmeasured and stays in the status index's missing
 * clause.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCLI } from "./fixtures/run-cli.js";
import { tempRootTracker } from "./temp-roots.js";

const tracker = tempRootTracker();
afterEach(() => tracker.cleanup());

/** A wiki with one deterministic failure and one judgement-tier finding. */
async function mixedProject(): Promise<string> {
  const root = await tracker.create("tiered-cli-", { real: true });
  await mkdir(path.join(root, "wiki", "concepts"), { recursive: true });
  await writeFile(path.join(root, "wiki", "concepts", "alpha.md"), [
    "---", "title: Alpha", "summary: links to a page that is not there", "confidence: 0.2", "---",
    "", "See [[Missing Page]]. Extra body text keeps the empty-page rule quiet.",
  ].join("\n"), "utf8");
  return root;
}

describe("llmwiki lint --tiered separates facts from judgements", () => {
  it("reports the broken link under BROKEN and the low confidence under JUDGEMENT", async () => {
    const root = await mixedProject();
    const result = await runCLI(["lint", "--tiered"], root);
    const out = result.stdout;
    const broken = out.indexOf("BROKEN — deterministic failures");
    const judgement = out.indexOf("JUDGEMENT — a model's assessment, not a fact");
    expect(broken, out).toBeGreaterThanOrEqual(0);
    expect(judgement, out).toBeGreaterThanOrEqual(0);
    // Each finding sits INSIDE its own tier's section, not merely somewhere in
    // the output: the broken link before the judgement header, the confidence
    // assessment after it.
    const brokenAt = out.indexOf("Missing Page");
    const confidenceAt = out.indexOf("confidence 0.20", judgement);
    expect(brokenAt, "broken-wikilink finding missing").toBeGreaterThan(broken);
    expect(brokenAt, "fact reported as judgement").toBeLessThan(judgement);
    expect(confidenceAt, "low-confidence finding not under JUDGEMENT").toBeGreaterThan(judgement);
  }, 60_000);
});
