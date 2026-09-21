/**
 * Version-locked compatibility support for the existing startWorkflowLocked API.
 * The caller MUST already own the compiler mutation lock. This deliberately does
 * not acquire, release, or claim to verify that lock, matching the legacy API.
 * It exposes only confined signed run persistence, not domain mutation or an
 * approval grant. New runtime operations use transaction-scoped host persistence.
 */
export { writeRun as writeRunWithCallerHeldLock } from "./run-store.js";
