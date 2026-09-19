/**
 * @file test/candidate-mutation-capacity-final7.test.ts
 * @description Decision 15 regressions bind candidate writers and strict
 * mutation enumeration to the same bounded store-authority contract.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readCandidate,
  CandidateRecordCapacityError,
  writeCandidate,
  writeFreshCandidate,
  type CandidateDraft,
} from "../src/compiler/candidates.js";
import { MAX_CANDIDATE_RECORD_BYTES } from "../src/compiler/candidate-custody.js";
import { listCandidates } from "../src/compiler/candidate-read.js";
import { selectConnectorCandidateEntriesForRun } from "../src/connectors/candidate-supersession.js";
import type { ConfinedFetchResult } from "../src/connectors/confined-fetch.js";
import { runConnector } from "../src/connectors/run.js";
import { snapshotCandidateQueue } from "./fixtures/candidate-queue.js";
import { useTempRoot } from "./fixtures/temp-root.js";
import { plantConnectorCandidate } from "./connectors/final6-fixtures.js";
import { activateFixtureConnector } from "./connectors/run-test-fixtures.js";

const root = useTempRoot();
const SLUG = "capacity";

/** Build the minimal draft used for exact serialized-size fixtures. */
function draft(body: string): CandidateDraft {
  return { title: SLUG, slug: SLUG, summary: "", sources: [], body };
}

/** Compute a body whose normal candidate record has exactly `size` bytes. */
function bodyForRecordSize(size: number): string {
  const record = {
    id: `${SLUG}-${"0".repeat(8)}`, title: SLUG, slug: SLUG, summary: "",
    sources: [], body: "", generatedAt: "2000-01-01T00:00:00.000Z",
    reviewMode: "forced", heldReasons: [{ code: "manual-review-requested" }],
  };
  const base = Buffer.byteLength(JSON.stringify(record, null, 2));
  return "x".repeat(size - base);
}

/** Deterministic response used only if a pre-fetch gate incorrectly passes. */
function fixtureFetch(): Promise<ConfinedFetchResult> {
  return Promise.resolve({
    kind: "ok", finalUrl: "https://fixture.local/story-1",
    bytes: Buffer.from("{}"), contentHash: "a".repeat(64),
  });
}

/** Require a writer capacity refusal and a byte-empty candidate queue. */
async function expectCapacityRefusal(writing: Promise<unknown>): Promise<void> {
  await expect(writing).rejects.toBeInstanceOf(CandidateRecordCapacityError);
  expect(await snapshotCandidateQueue(root.dir)).toEqual({});
}

describe("Final7 candidate mutation capacity", () => {
  afterEach(() => { delete process.env.LLMWIKI_CONNECTORS; });

  it("writes and reads back an exact-cap candidate", async () => {
    const candidate = await writeFreshCandidate(
      root.dir, draft(bodyForRecordSize(MAX_CANDIDATE_RECORD_BYTES)),
    );
    const file = path.join(root.dir, ".llmwiki", "candidates", `${candidate.id}.json`);

    expect((await stat(file)).size).toBe(MAX_CANDIDATE_RECORD_BYTES);
    expect((await readCandidate(root.dir, candidate.id))?.id).toBe(candidate.id);
  });

  it.each([
    ["canonical", writeCandidate],
    ["fresh", writeFreshCandidate],
  ] as const)("rejects cap-plus-one in the %s writer", async (_name, writer) => {
    const body = bodyForRecordSize(MAX_CANDIDATE_RECORD_BYTES + 1);

    await expectCapacityRefusal(writer(root.dir, draft(body)));
  });

  it("measures JSON escape expansion before writing", async () => {
    const body = "\u0000".repeat(700_000);
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_CANDIDATE_RECORD_BYTES);

    await expectCapacityRefusal(writeFreshCandidate(root.dir, draft(body)));
  });

  it("leaves duplicates byte-identical when an oversized replacement refuses", async () => {
    await writeCandidate(root.dir, draft("small"));
    const before = await snapshotCandidateQueue(root.dir);

    await expect(writeCandidate(root.dir, draft("x".repeat(MAX_CANDIDATE_RECORD_BYTES))))
      .rejects.toBeInstanceOf(CandidateRecordCapacityError);

    expect(await snapshotCandidateQueue(root.dir)).toEqual(before);
  });

  it("keeps tolerant reads but blocks malformed mutation authority before fetch", async () => {
    await activateFixtureConnector(root.dir);
    const dir = path.join(root.dir, ".llmwiki", "candidates");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "broken.json"), "{not-json");
    let fetches = 0;

    const result = await runConnector(root.dir, "fixture", { id: "story-1" }, {
      fetcher: async () => { fetches += 1; return fixtureFetch(); },
    });

    expect(result).toEqual({ kind: "unavailable", reason: "connector candidate store unavailable" });
    expect(fetches).toBe(0);
    expect(await listCandidates(root.dir)).toEqual([]);
  });

  it("refuses JSON leaf 201 even when every record is unrelated", async () => {
    for (let index = 0; index < 201; index += 1) {
      await plantConnectorCandidate(root.dir, `unrelated-${index}`, {
        idempotencyKey: "b".repeat(64),
      });
    }

    const result = await selectConnectorCandidateEntriesForRun(root.dir, "a".repeat(64));

    expect(result).toEqual({ kind: "unavailable", reason: "connector candidate store unavailable" });
  });

  it("refuses direct directory entry 202 including the archive directory", async () => {
    const dir = path.join(root.dir, ".llmwiki", "candidates");
    await mkdir(path.join(dir, "archive"), { recursive: true });
    await Promise.all(Array.from({ length: 201 }, (_, index) =>
      writeFile(path.join(dir, `noise-${index}.txt`), "x")));

    const result = await selectConnectorCandidateEntriesForRun(root.dir, "a".repeat(64));

    expect(result).toEqual({ kind: "unavailable", reason: "connector candidate store unavailable" });
  });
});
