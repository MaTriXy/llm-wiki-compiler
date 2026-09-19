/**
 * @file test/connectors/final9-candidate-store.test.ts
 * @description Decision 19 integration regressions require connector preflight
 * to validate both literal candidate namespaces before fetch and require exact
 * compensation before translating a late namespace failure.
 */

import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CandidateMutationSelectionHooks } from "../../src/compiler/candidate-selection.js";
import { runConnector, type RunConnectorDeps } from "../../src/connectors/run.js";
import { readEvents } from "../../src/events/store-read.js";
import { useTempRoot } from "../fixtures/temp-root.js";
import { plantConnectorCandidate } from "./final6-fixtures.js";
import { activateFixtureConnector, countedFixtureFetch } from "./run-test-fixtures.js";

const root = useTempRoot();
const STORE_UNAVAILABLE = Object.freeze({
  kind: "unavailable" as const,
  reason: "connector candidate store unavailable",
});

type RunDepsWithSelectionHooks = RunConnectorDeps & {
  candidateSelectionHooksForTest: CandidateMutationSelectionHooks & {
    maxMutationBytesForTest: number;
  };
};

/** Run the activated fixture with an exact dependency set. */
function runFixture(deps: RunConnectorDeps) {
  return runConnector(root.dir, "fixture", { id: "story-1" }, deps);
}

/** Make archive a stable in-project alias. */
async function aliasArchive(): Promise<void> {
  const candidates = path.join(root.dir, ".llmwiki", "candidates");
  const alternate = path.join(root.dir, "alternate-archive");
  await mkdir(candidates, { recursive: true });
  await mkdir(alternate);
  await symlink(alternate, path.join(candidates, "archive"));
}

/** Tighten the fixture interval so a misplaced preflight leaves a rate effect. */
async function requireRateStamp(): Promise<void> {
  const file = path.join(root.dir, ".llmwiki", "config.json");
  const current = JSON.parse(await readFile(file, "utf8"));
  const fixture = { ...current.connectors.fixture, minRequestIntervalMs: 1_000 };
  const config = { ...current, connectors: { ...current.connectors, fixture } };
  await writeFile(file, JSON.stringify(config));
}

/** Install one literal namespace fault after fixture activation. */
async function installFault(namespace: "pending" | "archive", kind: string): Promise<void> {
  const candidates = path.join(root.dir, ".llmwiki", "candidates");
  const targetPath = namespace === "pending" ? candidates : path.join(candidates, "archive");
  if (namespace === "archive") await mkdir(candidates, { recursive: true });
  if (kind === "file") {
    await writeFile(targetPath, "not-a-directory");
    return;
  }
  const target = kind === "stable" ? path.join(root.dir, `${namespace}-alternate`)
    : kind === "loop" ? targetPath : path.join(root.dir, `${namespace}-missing`);
  if (kind === "stable") await mkdir(target);
  await symlink(target, targetPath);
}

/** Prove an initial refusal precedes fetch, events, and candidate publication. */
async function expectInitialRefusal(fetches: { value: number }): Promise<void> {
  await requireRateStamp();
  const result = await runFixture({ fetcher: countedFixtureFetch(fetches) });

  await expectUnavailableWithoutEffects(result, fetches);
  expect(existsSync(path.join(root.dir, ".llmwiki", "connectors", "fixture.last-fetch.json")))
    .toBe(false);
}

/** Assert the common unavailable result and zero observable connector effects. */
async function expectUnavailableWithoutEffects(
  result: Awaited<ReturnType<typeof runConnector>>,
  fetches: { value: number },
): Promise<void> {
  expect(result).toEqual(STORE_UNAVAILABLE);
  expect(fetches.value).toBe(0);
  expect((await readEvents(root.dir)).events).toEqual([]);
}

describe("Final9 connector candidate namespace gate", () => {
  afterEach(() => { delete process.env.LLMWIKI_CONNECTORS; });

  it.each([
    ["pending", "stable"], ["pending", "dangling"], ["pending", "loop"], ["pending", "file"],
    ["archive", "stable"], ["archive", "dangling"], ["archive", "loop"], ["archive", "file"],
  ] as const)("refuses a %s %s fault before rate or fetch", async (namespace, kind) => {
    await activateFixtureConnector(root.dir);
    await installFault(namespace, kind);
    const fetches = { value: 0 };

    await expectInitialRefusal(fetches);
  });

  it("refuses an unreadable archive before rate or fetch", async () => {
    await activateFixtureConnector(root.dir);
    const archive = path.join(root.dir, ".llmwiki", "candidates", "archive");
    await mkdir(archive, { recursive: true });
    await chmod(archive, 0o000);
    const fetches = { value: 0 };

    try {
      await expectInitialRefusal(fetches);
    } finally {
      await chmod(archive, 0o700);
    }
  });

  it("maps a late namespace failure only after empty compensation settles", async () => {
    await activateFixtureConnector(root.dir);

    const result = await runFixture({
      fetcher: countedFixtureFetch({ value: 0 }),
      beforeCandidateStageForTest: aliasArchive,
    });

    expect(result).toEqual(STORE_UNAVAILABLE);
    expect((await readEvents(root.dir)).events).toEqual([]);
  });

  it("lets recovery-required win when a late alias hides archived authority", async () => {
    await activateFixtureConnector(root.dir);
    await plantConnectorCandidate(root.dir, "selected");
    const candidates = path.join(root.dir, ".llmwiki", "candidates");
    const archive = path.join(candidates, "archive");

    const result = await runFixture({
      fetcher: countedFixtureFetch({ value: 0 }),
      beforeCandidateStageForTest: async () => {
        await rename(archive, `${archive}-hidden`);
        await mkdir(path.join(root.dir, "alternate-archive"));
        await symlink(path.join(root.dir, "alternate-archive"), archive);
      },
    });

    expect(result).toEqual({ kind: "recovery-required", candidateIds: ["selected"] });
    expect(existsSync(path.join(candidates, "selected.json"))).toBe(false);
  });

  it("maps aggregate scan exhaustion before fetch with zero effects", async () => {
    await activateFixtureConnector(root.dir);
    await plantConnectorCandidate(root.dir, "unrelated", { idempotencyKey: "b".repeat(64) });
    const fetches = { value: 0 };
    const deps: RunDepsWithSelectionHooks = {
      fetcher: countedFixtureFetch(fetches),
      candidateSelectionHooksForTest: { maxMutationBytesForTest: 1 },
    };

    const result = await runFixture(deps);

    await expectUnavailableWithoutEffects(result, fetches);
  });
});
