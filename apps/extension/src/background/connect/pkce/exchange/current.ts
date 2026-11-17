import { loadPkceAttempt, samePkceAttemptBase } from "../attempt";
import type { HostedPkceContext } from "../context";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceStoredAttempt } from "../model";

export async function requirePkceExchange(context: HostedPkceContext, record: HostedPkceStoredAttempt): Promise<void> {
  context.owner(record);
  const envelope = await loadPkceAttempt(context);
  context.owner(record);
  if (!envelope.attempt || !samePkceAttemptBase(envelope.attempt, record) || envelope.attempt.phase !== "exchanging" || envelope.attempt.tabId !== record.tabId) throw new HostedPkceFailure(envelope.attempt?.phase === "terminal" && envelope.attempt.outcome === "cancelled" ? "cancelled" : "attempt_conflict");
}
