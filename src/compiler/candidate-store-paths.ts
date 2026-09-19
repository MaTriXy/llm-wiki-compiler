/**
 * @file src/compiler/candidate-store-paths.ts
 * @description Literal owned-directory classification for review candidate
 * stores. Every existing lexical component below the project root must be a
 * real, non-symlink directory at its canonical location. Only `ENOENT` on a
 * literal component means the namespace is absent; aliases, broken links,
 * non-directories, permission faults, and other I/O failures are unavailable.
 */

import { lstat, realpath } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { isSafeFilenameComponent } from "../profile/identity.js";

/** Stable identity captured for one literal candidate directory. */
export interface CandidateDirectoryIdentity {
  readonly dev: number;
  readonly ino: number;
}

/** Canonical binding for one existing literal candidate directory. */
export interface CandidateDirectoryBinding {
  readonly dir: string;
  readonly realDir: string;
  readonly identity: CandidateDirectoryIdentity;
}

/** Typed refusal when a candidate namespace is not literal trusted authority. */
export class UnsafeCandidateDirError extends Error {
  constructor() {
    super("candidate store directory is unavailable");
    this.name = "UnsafeCandidateDirError";
  }
}

/** Extension used for every candidate JSON file. */
const CANDIDATE_EXT = ".json";

/** True only for a genuine lexical absence. */
function isAbsent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** Split and validate one project-relative owned namespace. */
function ownedSegments(root: string, dir: string): string[] {
  const lexicalRoot = path.resolve(root);
  const target = path.resolve(lexicalRoot, dir);
  const relative = path.relative(lexicalRoot, target);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new UnsafeCandidateDirError();
  }
  return relative.split(path.sep).filter(Boolean);
}

/** Read one component without following a symlink. */
async function inspectComponent(component: string): Promise<Stats | null> {
  try {
    return await lstat(component);
  } catch (error) {
    if (isAbsent(error)) return null;
    throw new UnsafeCandidateDirError();
  }
}

/** Build and freeze the final directory binding. */
function binding(
  dir: string,
  realDir: string,
  info: Stats,
): CandidateDirectoryBinding {
  return Object.freeze({
    dir,
    realDir,
    identity: Object.freeze({ dev: info.dev, ino: info.ino }),
  });
}

/**
 * Classify one literal owned candidate directory. The walk inspects `.llmwiki`
 * and every deeper existing component with `lstat`, so a broken intermediate
 * symlink can never collapse into an absent final directory.
 */
export async function captureCandidateDirectoryBinding(
  root: string,
  dir: string,
): Promise<CandidateDirectoryBinding | null> {
  const segments = ownedSegments(root, dir);
  const realRoot = await realpath(root).catch(() => null);
  if (realRoot === null) throw new UnsafeCandidateDirError();
  let lexical = path.resolve(root);
  let finalInfo: Stats | null = null;
  for (let index = 0; index < segments.length; index += 1) {
    lexical = path.join(lexical, segments[index]!);
    finalInfo = await inspectComponent(lexical);
    if (finalInfo === null) return null;
    if (finalInfo.isSymbolicLink() || !finalInfo.isDirectory()) {
      throw new UnsafeCandidateDirError();
    }
    const observed = await realpath(lexical).catch(() => null);
    const expected = path.join(realRoot, ...segments.slice(0, index + 1));
    if (observed !== expected) throw new UnsafeCandidateDirError();
  }
  if (finalInfo === null) throw new UnsafeCandidateDirError();
  return binding(lexical, path.join(realRoot, ...segments), finalInfo);
}

/** Resolve one safe candidate leaf through the literal namespace classifier. */
export async function confinedCandidateFilePath(
  root: string,
  dir: string,
  id: string,
  onUnsafeId: (id: string) => Error,
): Promise<string> {
  if (!isSafeFilenameComponent(id)) throw onUnsafeId(id);
  const captured = await captureCandidateDirectoryBinding(root, dir);
  const realRoot = await realpath(root).catch(() => null);
  if (realRoot === null) throw new UnsafeCandidateDirError();
  const ownedDir = captured?.realDir ?? path.join(realRoot, ...ownedSegments(root, dir));
  return path.join(ownedDir, `${id}${CANDIDATE_EXT}`);
}

/** Resolve one existing literal candidate directory, or null when absent. */
export async function resolveConfinedCandidatesDir(
  root: string,
  dir: string,
): Promise<string | null> {
  return (await captureCandidateDirectoryBinding(root, dir))?.realDir ?? null;
}
