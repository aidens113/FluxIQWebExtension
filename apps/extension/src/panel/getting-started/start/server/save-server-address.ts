// Saves the FluxIQ web address the person chose, with the connection address its discovery document names, so
// one address is all anyone types. Everything else in the saved settings stays as it was.

import { defaultSettings } from "../../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { ExtensionStatus, FluxIQSettings } from "../../../../shared/protocol";
import type { PanelResult, PanelStore } from "../../../state";

/** Saves `origin` as the web address and `gatewayUrl` as the connection address. */
export function saveServerAddress(request: PanelStore["request"], status: ExtensionStatus | undefined, origin: string, gatewayUrl: string): Promise<PanelResult<unknown>> {
  const settings: FluxIQSettings = { ...defaultSettings(), ...status?.settings, coreApiUrl: origin, gatewayUrl };
  return request({ type: RUNTIME_MESSAGES.panelSaveSettings, settings });
}
