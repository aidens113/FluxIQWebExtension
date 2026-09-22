// The session a journey runs in, on the existing demo topology: one persistent
// demo Core (`withPersistentDemoCore`) with a freshly signed-in control client,
// and the extension, panel and scenario pages of `withDemoBrowser`.
//
// This is the only module that knows how a journey's Core and browser are
// started. The journeys see a `JourneyCore` and a `JourneySession` and nothing
// else, so moving them onto the suite's own topology (`ui-e2e/topology.ts`)
// replaces this file and leaves the journeys as they are.
import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { authenticatedControl, credentialLiterals, type DemoWorkspaceConfiguration, withDemoBrowser, withPersistentDemoCore, withWorkspaceLock } from "../../demo-workspace/index.js";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import type { RecordedTaskId } from "./recorded-task.js";

/** The journeys that provision a Flow, one project each; a failure task is its own journey here. */
export type JourneyProjectKey = "extraction" | `failure-${RecordedTaskId}`;

/**
 * How long a journey waits, from Stop recording, for Core to finalize the new
 * recording. Measured on t069: an extraction recording of 20 s held 99 entries,
 * Core appended them about one a second on a loaded machine, and finished 93.5 s
 * after Stop -- past the demo lanes' 90 s (`DEMO_RECORDING_FINALIZE_TIMEOUT_MS`).
 * A finalized recording returns at once, so the bound costs only a failure.
 */
export const JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS = 240_000;

/**
 * The configuration a journey provisions its Flow under: its own project, named
 * after the journey, and its own Flow -- each failure task counting as a
 * journey, since both would otherwise provision the same Flow. One project per journey keeps each
 * project's hierarchy to one Flow, which is what the panel steps that create and
 * find a Subflow by name were built against; with a second Flow in the same
 * project, the new Subflow's row never appeared to them (t069, live). The
 * journey names are chosen so that no project's name contains another's,
 * because the panel's project search matches by substring. A configured
 * project id is not used: it would put every journey in one project.
 */
export function journeyFlowConfiguration(config: DemoWorkspaceConfiguration, journey: JourneyProjectKey, flow: { flowId: string; flowName: string }): DemoWorkspaceConfiguration {
  const { projectId: _sharedProject, ...rest } = config;
  return { ...rest, projectName: `${config.projectName}: ${journey}`, flowId: flow.flowId, flowName: flow.flowName };
}

/** A running Core: its signed-in control client, the gateway the extension connects to, and the panel's session cookie. */
export type JourneyCore = {
  config: DemoWorkspaceConfiguration;
  control: ExistingFluxIQControlClient;
  gatewayUrl: string;
  panelCookie: string;
};

/** A running Core with the unpacked extension, the panel and one Scenario Lab page open. */
export type JourneySession = Omit<JourneyCore, "panelCookie"> & {
  extensionPage: Page;
  panelPage: Page;
  scenarioPage: Page;
  scenarioUrl: string;
  evidence: BrowserEvidenceRecorder;
};

/**
 * Starts the workspace's Core, signs in afresh, runs `operation`, then stops
 * the Core and its gateway. Returning from here is the stop the restart
 * journey proves.
 */
export async function withJourneyCore<T>(config: DemoWorkspaceConfiguration, operation: (core: JourneyCore) => Promise<T>): Promise<T> {
  return withWorkspaceLock(config, () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    return operation({ config, control, gatewayUrl, panelCookie });
  }));
}

/** Opens the extension, panel and scenario pages against a running Core, on `scenarioPath`, with evidence under `evidenceId`. */
export async function withJourneyBrowser<T>(core: JourneyCore, input: { evidenceId: string; scenarioPath: string }, operation: (session: JourneySession) => Promise<T>): Promise<T> {
  const { config, control, gatewayUrl } = core;
  return withDemoBrowser(config, core.panelCookie, input.evidenceId, pages => operation({ config, control, gatewayUrl, ...pages }), credentialLiterals(config), input.scenarioPath);
}
