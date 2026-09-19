/**
 * @file test/active-profile-digest-genericity.test.ts
 * @description §4.6 genericity evidence for the `activeProfileDigest` core seam (P9.2).
 * Requirement (1) — no product vocabulary/imports — is enforced by the existing
 * `no-research-branch-in-core` + `product-boundary-genericity` gates the seam passes
 * unchanged. Here: (2) a DISSIMILAR (newsroom) consumer exercises the seam — a stable,
 * profile-DISTINCT digest for a product unlike AutoSci; (3) BYTE-IDENTICAL CORE — a
 * fingerprint over the COMPLETE tracked core tree (`git ls-files -z src`, path + raw bytes)
 * is unchanged before/after the seam runs under two dissimilar profiles, so a mutation to
 * ANY tracked core file (any extension) is caught.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { activeProfileDigest } from "../src/profile/load.js";
import { makeTempRoot } from "./fixtures/temp-root.js";
import { installNewsroomProfile } from "./fixtures/newsroom-profile.js";
import { installWorkflowProfile, WORKFLOW_PROFILE } from "./fixtures/workflow-profile.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A fingerprint of the COMPLETE tracked core tree: EVERY `git ls-files src` (any
 * extension), sorted, hashing each relative PATH and its RAW BYTES with unambiguous
 * length-prefixed framing so a rename, a new file, or a byte edit all change the digest.
 */
function coreTreeFingerprint(): string {
  const listed = execFileSync("git", ["ls-files", "-z", "src"], { cwd: REPO_ROOT });
  const files = listed.toString("utf8").split("\0").filter((rel) => rel.length > 0).sort();
  const hash = createHash("sha256");
  for (const rel of files) {
    const bytes = readFileSync(path.join(REPO_ROOT, rel));
    hash.update(`${rel.length}:${rel}\n${bytes.length}:`);
    hash.update(bytes);
    hash.update("\n");
  }
  return hash.digest("hex");
}

describe("activeProfileDigest — §4.6 genericity", () => {
  it("is a stable, profile-DISTINCT observation for a dissimilar (newsroom) consumer", async () => {
    const newsroom = await makeTempRoot("apd-newsroom");
    await installNewsroomProfile(newsroom);
    const workflow = await makeTempRoot("apd-workflow");
    await installWorkflowProfile(workflow, WORKFLOW_PROFILE);
    const digestN = await activeProfileDigest(newsroom);
    expect(digestN).toMatch(/\S/); // non-empty
    expect(await activeProfileDigest(newsroom)).toBe(digestN); // stable
    expect(await activeProfileDigest(workflow)).not.toBe(digestN); // profile-distinct
  });

  it("leaves the COMPLETE tracked core tree byte-identical when exercised under two profiles", async () => {
    const before = coreTreeFingerprint();
    const newsroom = await makeTempRoot("apd-fp-newsroom");
    await installNewsroomProfile(newsroom);
    const workflow = await makeTempRoot("apd-fp-workflow");
    await installWorkflowProfile(workflow, WORKFLOW_PROFILE);
    expect(await activeProfileDigest(newsroom)).not.toBe(await activeProfileDigest(workflow));
    // A representative product/profile configuration change never edits core.
    expect(coreTreeFingerprint()).toBe(before);
  });
});
