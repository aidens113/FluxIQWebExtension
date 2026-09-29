import { scenarioLabOriginProof } from "../lab-control/index.js";
import { scenarioNetworkOrigins, type DeterministicNetworkPolicy } from "../network-guard.js";
import { panelNetworkPolicy } from "./panel-network-policy.js";

/**
 * The allowlists of a lane that runs the extension against a local FluxIQ
 * panel and a Scenario Lab -- the `demo:*`, `demo:llm:*` and UI end-to-end
 * lanes -- with the same semantics as a scenario run's
 * (`install-run-network-guard.ts`).
 *
 * The extension's browser reaches the Lab (both loopback spellings, plus any
 * second Lab port proven with the Lab's own run token), the panel's HTTP API,
 * and the client gateway's WebSocket. The panel's browser reaches the panel
 * and nothing else (`panelNetworkPolicy`). Neither browser reaches a model
 * provider: an LLM lane's provider calls are made by Core's Node process, so a
 * provider host in either browser is a violation.
 */
export function loopbackLanePolicies(endpoints: {
  scenarioOrigin: string;
  /** The `SCENARIO_LAB_RUN_TOKEN` the Lab was started with, which signs its origin proof. */
  scenarioLabToken: string;
  fluxiqOrigin: string;
  gatewayUrl: string;
}): { extension: DeterministicNetworkPolicy; panel: DeterministicNetworkPolicy } {
  return {
    extension: {
      scenarioOrigins: scenarioNetworkOrigins(endpoints.scenarioOrigin),
      fluxiqOrigins: [endpoints.fluxiqOrigin],
      gatewayOrigins: [endpoints.gatewayUrl],
      verifyScenarioOrigin: scenarioLabOriginProof(endpoints.scenarioOrigin, endpoints.scenarioLabToken),
    },
    panel: panelNetworkPolicy(endpoints.fluxiqOrigin),
  };
}
