/**
 * @file src/compiler/candidate-custody-limits.ts
 * @description Shared byte ceilings for candidate serialization and custody
 * reads, split out so runtime boundary capture does not form an import cycle.
 */

/** Maximum raw or serialized bytes in one review-candidate record. */
export const MAX_CANDIDATE_RECORD_BYTES = 4 * 1024 * 1024;
