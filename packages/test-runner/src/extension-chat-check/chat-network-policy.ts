import type { RunningTopology } from "../coordinator.js";
import { scenarioLabOriginProof } from "../lab-control/index.js";
import { scenarioNetworkOrigins, type DeterministicNetworkPolicy } from "../network-guard.js";

/**
 * The destinations the chat check's browser may reach: the run's scenario
 * origins, the isolated Core, the recording proxy the extension is pointed at
 * as its Core API (`coreApiOrigin`), and the gateway. It is the run lane's
 * policy (`installRunNetworkGuard`) with the proxy added, because the
 * extension's chat calls go to the proxy, not to Core directly.
 */
export function chatNetworkPolicy(topology: RunningTopology, coreApiOrigin: string): DeterministicNetworkPolicy {
  return {
    scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin),
    fluxiqOrigins: [topology.fluxiqOrigin, coreApiOrigin],
    ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
    verifyScenarioOrigin: scenarioLabOriginProof(topology.scenarioOrigin, topology.allocation.controllerToken),
  };
}
