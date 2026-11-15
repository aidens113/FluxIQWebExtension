import { finishPkceAttempt, loadPkceAttempt, pkceAttemptBase, pkceAttemptView, swapPkceAttempt } from "./attempt";
import { readPkceCallback } from "./callback";
import { pkceFailureCode, type HostedPkceContext } from "./context";
import { discoverPkceBinding, samePkceAudience } from "./discovery";
import { adoptPkceToken, requestPkceToken } from "./exchange";
import { HostedPkceFailure } from "./failure";
import type { HostedPkceOwnerOutcome, HostedPkceStoredAttempt } from "./model";
import { failedPkceOperation } from "./operation-result";

export async function observeHostedPkce(context: HostedPkceContext, input: Readonly<{ tabId: number; url: string }>): Promise<HostedPkceOwnerOutcome> {
  let exchanging: HostedPkceStoredAttempt | undefined;
  try {
    context.guard();
    const envelope = await loadPkceAttempt(context);
    context.guard();
    const record = envelope.attempt;
    if (!record) return pkceAttemptView(null);
    context.owner(record);
    if (record.phase !== "waiting") return pkceAttemptView(record);
    const callback = readPkceCallback(record, input);
    if (!callback) return pkceAttemptView(record);
    if (callback.kind === "error") return await finishPkceAttempt(context, record, callback.error === "access_denied" ? "denied" : "failed", callback.error === "server_error" ? "server_error" : undefined);
    const binding = await discoverPkceBinding(context);
    context.owner(record);
    if (!samePkceAudience(binding, record.binding)) throw new HostedPkceFailure("binding_changed");
    const bound = context.options.credentials.forBinding(binding);
    const installation = await bound.getOrCreateInstallation();
    context.owner(record);
    if (installation.installId !== record.installId || installation.revision !== record.expectedCredentialRevision) throw new HostedPkceFailure("credential_conflict");
    const trust = await bound.read();
    context.owner(record);
    if (trust) throw new HostedPkceFailure("trust_transition_required");
    const next: HostedPkceStoredAttempt = { ...pkceAttemptBase(record), phase: "exchanging", tabId: record.tabId, submittedAtMs: context.clock() };
    await swapPkceAttempt(context, envelope, next);
    exchanging = next;
    context.owner(next);
    const response = await requestPkceToken(context, record, callback.code);
    return await adoptPkceToken(context, bound, next, response);
  } catch (error) {
    if (exchanging) {
      const code = pkceFailureCode(error);
      const uncertain = code === "exchange_uncertain" || code === "response_invalid";
      try { return await finishPkceAttempt(context, exchanging, uncertain ? "uncertain" : "failed", code); }
      catch (finishError) { return failedPkceOperation(finishError, exchanging); }
    }
    return failedPkceOperation(error);
  }
}
