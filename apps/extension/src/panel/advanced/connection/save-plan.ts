// What pressing Save does with the form (UI audit, section 4, and defect F3:
// settings used to be stored only by Connect, which the drawer's backdrop
// covered and which was disabled while connected).
//
// Save stores the settings without connecting (`panelSaveSettings`). When the
// connection address changed and the browser is connected or trying to be, it
// also reconnects, because the open socket still points at the old address.
// An address FluxIQ could never be reached at is refused here with a sentence
// naming the field, instead of being stored and failing later as
// "Can't reach FluxIQ".

import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus, FluxIQSettings } from "../../../shared/protocol";
import type { AddressKey } from "./settings-fields";

/** The settings to store and whether to reconnect, or the field that stops the save and why. */
export type SavePlan =
  | { readonly ok: true; readonly settings: FluxIQSettings; readonly reconnect: boolean }
  | { readonly ok: false; readonly field: AddressKey; readonly sentence: string };

const SCHEMES: Readonly<Record<AddressKey, { protocols: readonly string[]; empty: string; wrong: string }>> = {
  gatewayUrl: {
    protocols: ["ws:", "wss:"],
    empty: "Enter the FluxIQ connection address.",
    wrong: "The FluxIQ connection address starts with ws:// or wss://."
  },
  coreApiUrl: {
    protocols: ["http:", "https:"],
    empty: "Enter the FluxIQ web address.",
    wrong: "The FluxIQ web address starts with http:// or https://."
  }
};

/** Plans a save of `values` against the settings `status` reports. */
export function savePlan(values: FluxIQSettings, status: ExtensionStatus | undefined): SavePlan {
  const gatewayUrl = values.gatewayUrl.trim();
  const coreApiUrl = values.coreApiUrl.trim();
  for (const [field, value] of [["gatewayUrl", gatewayUrl], ["coreApiUrl", coreApiUrl]] as const) {
    const problem = addressProblem(field, value);
    if (problem !== undefined) return { ok: false, field, sentence: problem };
  }
  const settings: FluxIQSettings = { ...values, gatewayUrl, coreApiUrl };
  const before = savedGatewayUrl(status);
  const live = status !== undefined && status.connectionState !== "disconnected";
  return { ok: true, settings, reconnect: live && before !== gatewayUrl };
}

function addressProblem(field: AddressKey, value: string): string | undefined {
  const scheme = SCHEMES[field];
  if (value === "") return scheme.empty;
  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch (error) {
    // `new URL` throws TypeError for text that is not an address at all.
    if (error instanceof TypeError) return scheme.wrong;
    throw error;
  }
  return scheme.protocols.includes(protocol) ? undefined : scheme.wrong;
}

function savedGatewayUrl(status: ExtensionStatus | undefined): string {
  return status?.settings?.gatewayUrl || status?.gatewayUrl || defaultSettings().gatewayUrl;
}
