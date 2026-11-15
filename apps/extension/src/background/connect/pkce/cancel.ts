import { finishPkceAttempt, loadPkceAttempt } from "./attempt";
import type { HostedPkceContext } from "./context";
import { HostedPkceFailure } from "./failure";
import type { HostedPkceAttemptView } from "./model";
import { failedPkceOperation } from "./operation-result";

export async function cancelHostedPkce(context: HostedPkceContext): Promise<HostedPkceAttemptView> {
  context.retire();
  try {
    const envelope = await loadPkceAttempt(context);
    const record = envelope.attempt;
    if (!record) return Object.freeze({ phase: "cancelled" });
    if (record.selectionId !== context.selection.id || record.binding.origin !== context.selection.origin) throw new HostedPkceFailure("selection_changed");
    return await finishPkceAttempt(context, record, "cancelled", "cancelled");
  } catch (error) { return failedPkceOperation(error); }
  finally { for (const controller of context.aborts) controller.abort(); }
}
