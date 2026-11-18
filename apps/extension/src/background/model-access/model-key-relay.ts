// The person's own model key, saved, replaced or removed through Core's
// `secret-keys` program with no password or PIN. Each relay sends Core exactly the
// fields named below. The key value goes to Core and nowhere else: not a log, an
// activity entry, a problem report, an error message or extension storage, and a
// failure that happens to repeat it is cut before it reaches the panel.

import { pairedClientModelAccessState, readModelAccessState } from "@fluxiq/contracts/platform";
import { AUTOMATION_PANEL_MESSAGES, type AutomationPanelRequest, type PanelRelayResponse } from "../../shared/protocol";
import { MODEL_KEY_PROVIDERS, type ModelKeyProvider } from "../../shared/model-key-messages";

export type ModelKeyCall = (endpoint: string, payload: Record<string, unknown>, programId?: string) => Promise<PanelRelayResponse>;

const PROGRAM = "secret-keys";

/** The panel messages this module answers. */
export const MODEL_KEY_MESSAGES: ReadonlySet<string> = new Set([
  AUTOMATION_PANEL_MESSAGES.modelKeySave,
  AUTOMATION_PANEL_MESSAGES.modelKeyReplace,
  AUTOMATION_PANEL_MESSAGES.modelKeyRemove
]);

export async function relayModelKey(type: string, message: AutomationPanelRequest, call: ModelKeyCall): Promise<PanelRelayResponse> {
  if (type === AUTOMATION_PANEL_MESSAGES.modelKeyRemove) return answer(await call("remove-model-key", {}, PROGRAM), undefined);
  const key = typeof message.key === "string" && message.key.trim() ? message.key.trim() : undefined;
  if (!key) return refuse("That request is missing its key.");
  if (type === AUTOMATION_PANEL_MESSAGES.modelKeyReplace) return answer(await call("replace-model-key", { value: key }, PROGRAM), key);
  if (type !== AUTOMATION_PANEL_MESSAGES.modelKeySave) return refuse("That request is not one FluxIQ knows.");
  const provider = message.provider;
  if (typeof provider !== "string" || !(MODEL_KEY_PROVIDERS as readonly string[]).includes(provider)) return refuse("That request must name a provider FluxIQ supports.");
  const name = typeof message.name === "string" && message.name.trim() ? message.name.trim() : undefined;
  return answer(await call("save-model-key", { provider: provider as ModelKeyProvider, value: key, ...(name ? { name } : {}) }, PROGRAM), key);
}

function answer(reply: PanelRelayResponse, key: string | undefined): PanelRelayResponse {
  if (!reply.ok) return key && reply.error.includes(key) ? { ...reply, error: reply.error.split(key).join("[key]") } : reply;
  const modelAccess = readModelAccessState((reply.payload as { modelAccess?: unknown } | null | undefined)?.modelAccess);
  return { ok: true, payload: modelAccess ? { modelAccess: pairedClientModelAccessState(modelAccess) } : {} };
}

function refuse(error: string): PanelRelayResponse {
  return { ok: false, code: "invalid_request", error };
}
