// Journey E, second half: restart and reuse.
//
// The Flows earlier journeys saved are read from a running Core, and that
// Core -- panel and gateway -- is stopped. Both ports must then refuse
// connections. A new Core is started on the same store, signed into afresh,
// the extension reconnects, and each saved Flow is found through the panel's
// hierarchy search and rerun under No LLM intervention: same identities, no
// model activity, and the same answer (`panel-rerun.ts`).
import { assertConnectedSession, type DemoWorkspaceConfiguration, explicitPort, extensionStatus } from "../../demo-workspace/index.js";
import { RunnerFailure } from "../../failure.js";
import { connectExtensionForProject } from "./extension-project.js";
import { type SavedFlowRerun, rerunSavedFlow } from "./panel-rerun.js";
import { waitForPortsClosed } from "./port-probe.js";
import { readSavedFlowIdentity, type SavedFlowIdentity, type SavedJourneyFlow } from "./saved-flow.js";
import { withJourneyBrowser, withJourneyCore } from "./session.js";
import { type JourneyCheckpoint, journeyTimeline } from "./timeline.js";

export type RestartReuseJourneyResult = Readonly<{
  journey: "restart_reuse";
  status: "verified";
  stop: Readonly<{ webPortClosed: true; gatewayPortClosed: true; waitedMs: number; probes: number }>;
  flows: readonly SavedFlowRerun[];
  checkpoints: readonly JourneyCheckpoint[];
}>;

/** How long a stopped Core may take to release both ports before one still open is a failure. */
const PORT_RELEASE_TIMEOUT_MS = 20_000;

export async function runRestartReuseJourney(config: DemoWorkspaceConfiguration, flows: readonly SavedJourneyFlow[]): Promise<RestartReuseJourneyResult> {
  if (flows.length === 0) throw new RunnerFailure("fixture.invalid", "The restart journey was given no saved Flow to reuse", { details: { reasonCode: "restart.no_saved_flows" } });
  const timeline = journeyTimeline();
  const before: SavedFlowIdentity[] = await withJourneyCore(config, async core => {
    const identities: SavedFlowIdentity[] = [];
    for (const flow of flows) identities.push(await readSavedFlowIdentity(core.control, flow));
    timeline.mark("identities-read", { flows: identities.length });
    return identities;
  });
  timeline.mark("core-stopped");
  const stop = await waitForPortsClosed([
    { label: "web", port: explicitPort(config.origin, "FLUXIQ_DEMO_BASE_URL") },
    { label: "gateway", port: explicitPort(config.gatewayUrl, "FLUXIQ_DEMO_GATEWAY_URL") },
  ], PORT_RELEASE_TIMEOUT_MS);
  timeline.mark("ports-closed", { waitedMs: stop.waitedMs, probes: stop.probes });

  const reruns = await withJourneyCore(config, core => withJourneyBrowser(core, { evidenceId: "ui-e2e-restart-reuse", scenarioPath: flows[0]!.scenarioPath }, async session => {
    timeline.mark("core-restarted");
    const first = flows[0]!.state;
    const connection = await connectExtensionForProject(session, first);
    timeline.mark("extension-reconnected", { sessionReset: connection.sessionReset });
    const results: SavedFlowRerun[] = [];
    for (const [index, flow] of flows.entries()) {
      results.push(await rerunSavedFlow(session, flow, before[index]!));
      timeline.mark(`rerun-${flow.label}`);
    }
    await assertConnectedSession(session.control, (await extensionStatus(session.extensionPage)).sessionId);
    return results;
  }));
  return { journey: "restart_reuse", status: "verified", stop: { webPortClosed: true, gatewayPortClosed: true, ...stop }, flows: reruns, checkpoints: timeline.checkpoints };
}
