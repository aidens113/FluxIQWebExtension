import type { ExtensionAddresses } from "../../../extension-chat-check/index.js";

/**
 * The addresses the attempt's extension is told before its panel opens: the run's own gateway and Core (through the
 * recording proxy). Without them the panel probes the product default web address, which the run never gave it.
 */
export function attemptPanelAddresses(topology: { gatewayUrl?: string }, coreApiUrl: string): ExtensionAddresses {
  if (!topology.gatewayUrl) throw new Error("The isolated Core started without a gateway, so the extension has no address to be told");
  return { gatewayUrl: topology.gatewayUrl, coreApiUrl };
}
