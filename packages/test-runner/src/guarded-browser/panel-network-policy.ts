import type { DeterministicNetworkPolicy } from "../network-guard.js";

/**
 * What a browser that shows only the FluxIQ panel may reach: the panel's own
 * origin. Core's web app is a production build that opens no WebSocket and
 * loads no remote asset, so the gateway, the Scenario Lab and every remote
 * host -- a model provider included -- are violations here.
 */
export function panelNetworkPolicy(fluxiqOrigin: string): DeterministicNetworkPolicy {
  return { scenarioOrigins: [], fluxiqOrigins: [fluxiqOrigin] };
}
