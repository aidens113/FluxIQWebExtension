import { copyPkceAudience } from "./audience";
import { finishPkceAttempt, loadPkceAttempt, pkceAttemptBase, pkceAttemptView, swapPkceAttempt } from "./attempt";
import { HostedPkceContext, pkceFailureCode } from "./context";
import { createPkceChallenge, createPkceMaterial } from "./crypto";
import { discoverPkceBinding } from "./discovery";
import { HostedPkceFailure } from "./failure";
import type { HostedPkceAttemptView, HostedPkceStoredAttempt } from "./model";
import { pkceAuthorizeUrl } from "./navigation";
import { failedPkceOperation } from "./operation-result";

export async function startHostedPkce(context: HostedPkceContext): Promise<HostedPkceAttemptView> {
  let record: HostedPkceStoredAttempt | undefined;
  try {
    context.guard();
    try { await context.options.authenticationTabs.ready(); }
    catch { throw new HostedPkceFailure("ownership_unavailable"); }
    context.guard();
    const session = context.session();
    const binding = await discoverPkceBinding(context);
    context.guard();
    const bound = context.options.credentials.forBinding(binding);
    const installation = await bound.getOrCreateInstallation();
    context.guard();
    const currentTrust = await bound.read();
    context.guard();
    if (currentTrust) throw new HostedPkceFailure("trust_transition_required");
    const material = createPkceMaterial(context.options.crypto);
    const challenge = await createPkceChallenge(material.verifier, context.options.crypto);
    context.guard();
    const envelope = await loadPkceAttempt(context);
    context.guard();
    if (envelope.browserSessionId !== session) throw new HostedPkceFailure("session_changed");
    if (envelope.attempt && envelope.attempt.phase !== "terminal") throw new HostedPkceFailure("attempt_conflict");
    record = Object.freeze({ version: 1, ...material, browserSessionId: session, selectionId: context.selection.id, binding: copyPkceAudience(binding), installId: installation.installId, expectedCredentialRevision: installation.revision, createdAtMs: context.clock(), phase: "preparing", tabId: null });
    const preparing = await swapPkceAttempt(context, envelope, record);
    context.guard();
    const tabId = await context.options.tabs.createBlank();
    context.guard();
    if (!Number.isSafeInteger(tabId) || tabId < 0) throw new HostedPkceFailure("ownership_unavailable");
    try { await context.options.authenticationTabs.own(tabId, record.attemptId); }
    catch { throw new HostedPkceFailure("ownership_unavailable"); }
    context.guard();
    const waiting: Extract<HostedPkceStoredAttempt, { phase: "waiting" }> = { ...pkceAttemptBase(record), phase: "waiting", tabId, state: material.state, verifier: material.verifier };
    context.owner(waiting);
    await swapPkceAttempt(context, preparing, waiting);
    record = waiting;
    context.owner(waiting);
    await context.options.tabs.navigateOwned({ tabId, attemptId: waiting.attemptId, browserSessionId: session, url: pkceAuthorizeUrl(context, waiting, challenge), stillCurrent: () => context.current() && context.options.authenticationTabs.sessionIdentity() === session && context.options.authenticationTabs.owns(tabId, waiting.attemptId) });
    context.owner(waiting);
    return pkceAttemptView(waiting);
  } catch (error) {
    if (record) {
      try { return await finishPkceAttempt(context, record, pkceFailureCode(error) === "cancelled" ? "cancelled" : "failed", pkceFailureCode(error)); }
      catch (finishError) { return failedPkceOperation(pkceFailureCode(finishError) === "attempt_conflict" ? error : finishError, record); }
    }
    return failedPkceOperation(error);
  }
}
