import { finishPkceAttempt, loadPkceAttempt, pkceAttemptView } from "./attempt";
import type { HostedPkceContext } from "./context";
import { discoverPkceBinding, samePkceAudience } from "./discovery";
import { HostedPkceFailure } from "./failure";
import type { HostedPkceAttemptView, HostedPkceStoredAttempt } from "./model";
import { failedPkceOperation } from "./operation-result";

export async function restoreHostedPkce(context: HostedPkceContext): Promise<HostedPkceAttemptView> {
  let record: HostedPkceStoredAttempt | undefined;
  try {
    context.guard();
    try { await context.options.authenticationTabs.ready(); }
    catch { throw new HostedPkceFailure("ownership_unavailable"); }
    context.guard();
    const envelope = await loadPkceAttempt(context);
    context.guard();
    if (!envelope.attempt) return pkceAttemptView(null);
    record = envelope.attempt;
    if (record.selectionId !== context.selection.id || record.binding.origin !== context.selection.origin) throw new HostedPkceFailure("selection_changed");
    if (record.phase === "terminal") return pkceAttemptView(record);
    if (record.phase === "preparing") return await finishPkceAttempt(context, record, "failed", "interrupted");
    if (record.phase === "exchanging") return await finishPkceAttempt(context, record, "uncertain", "interrupted");
    context.owner(record);
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
    const latest = await loadPkceAttempt(context);
    context.owner(record);
    if (latest.revision !== envelope.revision) throw new HostedPkceFailure("attempt_conflict");
    return pkceAttemptView(record);
  } catch (error) { return failedPkceOperation(error, record); }
}
