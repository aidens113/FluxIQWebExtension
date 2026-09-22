// Connecting the extension for the project a journey works in.
//
// The extension persists its session, and with it the project it last
// recorded into. Measured on t069: after an earlier journey's session had
// recorded into another project, a new Core session did not replace that
// project, so the next recording start was refused as "FluxIQ has a different
// project open than the one this recording asked for" -- although the panel had
// the journey's project open, which is what the refusal tells a person to do.
// The one control that clears it is the extension's own Reset Session, so a
// journey that finds the extension on another project resets it there and
// reconnects, and reports that it had to (`sessionReset`), rather than letting
// the workaround pass unseen.
import { connectExtension, extensionStatus, pollStatus } from "../../demo-workspace/index.js";
import { RunnerFailure } from "../../failure.js";
import type { JourneySession } from "./session.js";

export type ExtensionProjectConnection = Readonly<{
  /** Whether the extension had kept another project and its session was reset to connect. */
  sessionReset: boolean;
}>;

export async function connectExtensionForProject(session: JourneySession, input: { projectId: string; flowId: string }): Promise<ExtensionProjectConnection> {
  const { control, gatewayUrl, extensionPage, panelPage, scenarioUrl, evidence, config } = session;
  const connect = () => connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, input.projectId, input.flowId, scenarioUrl, evidence);
  await connect();
  if (!staleProject((await extensionStatus(extensionPage)).projectId, input.projectId)) return { sessionReset: false };
  await evidence.diagnostic("extension", "extension-project-stale", "ui-e2e.extension.project-stale", { sessionReset: true });
  await evidence.step("extension", "extension-reset-settings", "Open extension settings to reset the session", () => extensionPage.getByRole("button", { name: "Settings" }).click());
  await evidence.step("extension", "extension-reset-session", "Reset the extension session left on another project", () => extensionPage.getByRole("button", { name: "Reset Session", exact: true }).click());
  await pollStatus(extensionPage, value => value.projectId === undefined && value.connectionState !== "connected", "extension session reset");
  await evidence.step("extension", "extension-reset-close", "Close extension settings", () => extensionPage.getByRole("button", { name: "Close" }).click());
  await connect();
  if (staleProject((await extensionStatus(extensionPage)).projectId, input.projectId)) {
    throw new RunnerFailure("gateway.connection", "The extension stayed on another project after its session was reset", { details: { reasonCode: "extension.project_stale" } });
  }
  return { sessionReset: true };
}

/** Whether the extension reports a project, and it is not `projectId`. An extension with no project yet resolves the panel's at recording start. */
export function staleProject(extensionProjectId: unknown, projectId: string): boolean {
  return typeof extensionProjectId === "string" && extensionProjectId !== "" && extensionProjectId !== projectId;
}
