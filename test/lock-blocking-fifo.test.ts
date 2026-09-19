import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { acquireLockBlocking, releaseLock } from "../src/utils/lock.js";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  it("lets an alias-root burst progress beyond one caller's timeout", async () => {
    await acquireLockBlocking(root, { timeoutMs: 50, intervalMs: 5 });
    const second = acquireLockBlocking(alias, { timeoutMs: 50, intervalMs: 5 }).then(async () => {
      await delay(45);
      await releaseLock(alias);
      return "second";
    });
    const third = acquireLockBlocking(root, { timeoutMs: 50, intervalMs: 5 }).then(async () => {
      await releaseLock(root);
      return "third";
    });

    await delay(30);
    await releaseLock(root);
    await expect(Promise.all([second, third])).resolves.toEqual(["second", "third"]);
  });
});
