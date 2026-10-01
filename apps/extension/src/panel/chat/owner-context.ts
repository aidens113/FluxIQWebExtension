import type { ExtensionStatus } from "../../shared/protocol";
import type { PanelStore } from "../state";

export type ChatOwner = { readonly token: object; readonly identity: string; current(): boolean; readonly request: PanelStore["request"] };

/** Observed remote context, separate from volatile connectivity and presentation. */
export function createChatOwnerContext(request: PanelStore["request"]) {
  let fields: readonly unknown[] = [undefined, undefined, undefined, null, undefined];
  let owner = make(fields);
  let observed = false;
  function make(values: readonly unknown[]): ChatOwner {
    const token = {};
    return {
      token,
      identity: JSON.stringify(values),
      current: () => owner.token === token,
      request: <T>(message: Parameters<PanelStore["request"]>[0]) => owner.token === token
        ? request<T>(message)
        : Promise.resolve({ ok: false as const, sentence: "This chat context has changed. Try again." })
    };
  }
  return {
    capture: () => owner,
    observe(status: ExtensionStatus) {
      const next = [typeof status.gatewayUrl === "string" ? status.gatewayUrl : fields[0], typeof status.settings?.coreApiUrl === "string" ? status.settings.coreApiUrl : fields[1], typeof status.clientId === "string" ? status.clientId : fields[2], typeof status.projectId === "string" ? status.projectId : null, typeof status.paired === "boolean" ? status.paired : fields[4]];
      const changed = next.some((value, index) => value !== fields[index]);
      const initial = !observed; observed = true;
      if (changed) { fields = next; owner = make(fields); }
      return { changed, initial };
    }
  };
}
