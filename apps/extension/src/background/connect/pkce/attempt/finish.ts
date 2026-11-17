import type { HostedPkceContext } from "../context";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceFailureCode } from "../failure-codes";
import type { HostedPkceStoredAttempt, HostedPkceAttemptView } from "../model";
import { pkceAttemptBase } from "./base";
import { loadPkceAttempt, swapPkceAttempt } from "./store";
import { pkceAttemptView } from "./view";
import { samePkceAttemptBase } from "./same";

export async function finishPkceAttempt(context: HostedPkceContext, record: HostedPkceStoredAttempt, outcome: "adopted" | "denied" | "cancelled" | "uncertain" | "failed", failureCode?: HostedPkceFailureCode, replaceTerminal = false): Promise<HostedPkceAttemptView> {
  let previousRevision = -1;
  for (;;) {
    const envelope = await loadPkceAttempt(context);
    if (!envelope.attempt || !samePkceAttemptBase(envelope.attempt, record)) throw new HostedPkceFailure("attempt_conflict");
    if (envelope.attempt.phase === "terminal" && !replaceTerminal) return pkceAttemptView(envelope.attempt);
    if (envelope.revision <= previousRevision) throw new HostedPkceFailure("attempt_conflict");
    previousRevision = envelope.revision;
    const terminal: HostedPkceStoredAttempt = { ...pkceAttemptBase(record), phase: "terminal", tabId: record.tabId, outcome, ...(failureCode ? { failureCode } : {}) };
    try {
      await swapPkceAttempt(context, envelope, terminal);
      return pkceAttemptView(terminal);
    } catch (error) {
      if (!(error instanceof HostedPkceFailure) || error.code !== "attempt_conflict") throw error;
    }
  }
}
