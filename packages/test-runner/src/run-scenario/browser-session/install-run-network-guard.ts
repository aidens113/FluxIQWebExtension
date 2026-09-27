import type { BrowserContext } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { scenarioLabOriginProof } from "../../lab-control/index.js";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard } from "../../network-guard.js";

/**
 * Binds the deterministic network guard to the three origins one run is allowed
 * to talk to: the Scenario Lab's fixture origin, the isolated FluxIQ Core, and
 * the gateway when the topology exposes one separately.
 *
 * The guard's own module knows nothing about a run, so this is where a run's
 * topology becomes a policy. `scenarioLabOriginProof` is what lets a loopback
 * origin the run did not predict -- a fixture served on a second allocated port
 * -- be admitted on proof that it is this run's Lab rather than on the shape of
 * its URL, which nothing outside the Lab can forge because the proof is signed
 * with the allocation's controller token.
 */
export async function installRunNetworkGuard(context: BrowserContext, topology: RunningTopology, scenarioOrigins: readonly string[]): Promise<DeterministicNetworkGuard> {
  return installDeterministicNetworkGuard(context, {
    scenarioOrigins: [...scenarioOrigins],
    fluxiqOrigins: [topology.fluxiqOrigin],
    ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
    verifyScenarioOrigin: scenarioLabOriginProof(topology.scenarioOrigin, topology.allocation.controllerToken),
  });
}
