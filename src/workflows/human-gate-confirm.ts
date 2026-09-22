/**
 * @file Compatibility exports for the existing terminal confirmation protocol.
 * @description Shares one token and TTY implementation with the compiler host.
 */
export { confirmHumanGateInteractively, nonInteractiveHumanGateIo } from "llmwiki-core/compiler-cli";
export type { HumanGateIo } from "llmwiki-core/compiler-cli";
