// The default defence every action runs behind: a recoverable page fault is
// waited out and the verb is run again, bounded, with an account of what was
// absorbed.
//
// `actions/execute.ts` is the only caller. Nothing here touches the DOM, so all
// of it runs in a Node test.

export { runWithRecovery } from "./attempt";
export { recordRecovery } from "./record";
export { recoverableFault, webActionReadsOnly, RECOVERY_FAULT_BY_CODE, RECOVERY_KNOWN_ACTION_TYPES } from "./fault";
export { recoveryBackoffMs, recoveryBackoffLadder, RECOVERY_TARGET_BACKOFF_MS, RECOVERY_BLIP_BACKOFF_MS, RECOVERY_BUDGET_MS } from "./budget";
export { recoveryAccountSentence, CLEAN_RECOVERY_ACCOUNT } from "./account";

export type { RecoveredExecution, RecoveryPause } from "./attempt";
export type { RecoveryAccount, RecoveryOutcome } from "./account";
export type { RecoveryFault } from "./fault";
