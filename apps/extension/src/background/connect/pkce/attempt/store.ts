import type { HostedPkceContext } from "../context";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceAttemptEnvelope, HostedPkceStoredAttempt } from "../model";
import { readPkceAttemptEnvelope } from "./read";

export async function loadPkceAttempt(context: HostedPkceContext): Promise<HostedPkceAttemptEnvelope> {
  let value: unknown;
  try { value = await context.options.attempts.load(); }
  catch { throw new HostedPkceFailure("attempt_store_unavailable"); }
  const envelope = readPkceAttemptEnvelope(value);
  if (envelope.browserSessionId !== context.session()) throw new HostedPkceFailure("session_changed");
  return envelope;
}

export async function swapPkceAttempt(context: HostedPkceContext, envelope: HostedPkceAttemptEnvelope, next: HostedPkceStoredAttempt): Promise<HostedPkceAttemptEnvelope> {
  if (!Number.isSafeInteger(envelope.revision + 1)) throw new HostedPkceFailure("attempt_invalid");
  let committed: boolean;
  try { committed = await context.options.attempts.compareAndSwap({ browserSessionId: envelope.browserSessionId, revision: envelope.revision }, Object.freeze(next)); }
  catch { throw new HostedPkceFailure("attempt_store_unavailable"); }
  if (committed !== true) throw new HostedPkceFailure("attempt_conflict");
  return Object.freeze({ browserSessionId: envelope.browserSessionId, revision: envelope.revision + 1, attempt: next });
}
