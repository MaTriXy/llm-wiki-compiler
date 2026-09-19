/**
 * @file Malformed candidate mutation authority refuses live compilation before
 * provider calls. Read-only candidate listing remains tolerant independently.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { compileAndReport } from "../src/compiler/index.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { CandidateRecordMalformedError } from "../src/compiler/candidate-read.js";
import { useCompileProject } from "./fixtures/compile-project.js";

const project = useCompileProject({ dirSuffix: "candidate-preflight" });
describe("live compile candidate preflight", () => {
  it("refuses invalid records before any extraction or generation spend", async () => {
    const extraction = vi.spyOn(AnthropicProvider.prototype, "toolCall");
    const generation = vi.spyOn(AnthropicProvider.prototype, "complete");
    await mkdir(path.join(project.dir, ".llmwiki", "candidates"));
    await writeFile(path.join(project.dir, ".llmwiki", "candidates", "broken.json"), "{");
    await expect(compileAndReport(project.dir)).rejects.toBeInstanceOf(CandidateRecordMalformedError);
    expect(extraction).not.toHaveBeenCalled();
    expect(generation).not.toHaveBeenCalled();
  });
});
