// The default defence every action runs behind: a recoverable page fault is
// waited out and the verb is run again, bounded, with an account of what was
// absorbed.
//
// `actions/execute.ts` is the only caller. Nothing here touches the DOM itself:
// the one move that does -- pressing a blocking dialog's own way out -- is
// `action-runtime/interference/`, injected into the loop and defaulted there, so
// all of this still runs in a Node test.

export { runWithRecovery } from "./attempt";
export { recordRecovery } from "./record";
export { recoverableFault, faultNeedsInterference, webActionReadsOnly, RECOVERY_FAULT_BY_CODE, RECOVERY_OBSTRUCTION_FAULTS, RECOVERY_KNOWN_ACTION_TYPES } from "./fault";
export { recoveryBackoffMs, recoveryBackoffLadder, RECOVERY_TARGET_BACKOFF_MS, RECOVERY_BLIP_BACKOFF_MS, RECOVERY_INTERFERENCE_BACKOFF_MS, RECOVERY_BUDGET_MS } from "./budget";
export { recoveryAccountSentence, CLEAN_RECOVERY_ACCOUNT } from "./account";

export type { RecoveredExecution, RecoveryPause, RecoveryIntervention } from "./attempt";
export type { RecoveryAccount, RecoveryOutcome } from "./account";
export type { RecoveryFault } from "./fault";
