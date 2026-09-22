/** Canonical-root FIFO integration plus deterministic queue-progress timing. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { acquireLockBlocking, releaseLock } from "../src/utils/lock.js";
import { acquireKeyedFifo } from "../src/utils/keyed-fifo.js";

describe("blocking lock process-local FIFO", () => {
  let parent = "";
  let root = "";
  let alias = "";

  beforeEach(async () => {
    parent = await mkdtemp(path.join(os.tmpdir(), "lock-fifo-"));
    root = path.join(parent, "root");
    alias = path.join(parent, "alias");
    await mkdir(root);
    await symlink(root, alias, "dir");
  });

  afterEach(async () => {
    await releaseLock(root);
    await rm(parent, { recursive: true, force: true });
  });

  it("serializes an alias-root burst through the same queue", async () => {
    const order: string[] = [];
    await acquireLockBlocking(root, { timeoutMs: 5_000, intervalMs: 5 });
    const second = acquireLockBlocking(alias, { timeoutMs: 5_000, intervalMs: 5 }).then(async () => {
      order.push("second");
      await releaseLock(alias);
      return "second";
    });
    const third = acquireLockBlocking(root, { timeoutMs: 5_000, intervalMs: 5 }).then(async () => {
      order.push("third");
      await releaseLock(root);
      return "third";
    });
    await releaseLock(root);
    await expect(Promise.all([second, third])).resolves.toEqual(["second", "third"]);
    expect(order).toHaveLength(2);
  });

  it("resets waiting deadlines on queue progress beyond the original timeout", async () => {
    vi.useFakeTimers();
    try {
      const failure = () => new Error("queue timed out");
      const releaseFirst = await acquireKeyedFifo("progress-test", 50, failure);
      const second = acquireKeyedFifo("progress-test", 50, failure);
      const third = acquireKeyedFifo("progress-test", 50, failure);
      await vi.advanceTimersByTimeAsync(30);
      releaseFirst();
      const releaseSecond = await second;
      await vi.advanceTimersByTimeAsync(45);
      releaseSecond();
      const releaseThird = await third;
      releaseThird();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
