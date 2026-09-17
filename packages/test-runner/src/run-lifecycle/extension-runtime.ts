// Talking to the extension's own runtime, and reading what it says back.
//
// Every one of these is a message to `chrome.runtime` from the extension's own
// page, or a reading of the status that comes back. They lived in the runner
// beside the scenario it drives, which made the runner the one place that knew
// both how to ask the extension a question and what a scenario means -- and
// left it with no room for the lanes that came after. They belong here, beside
// the extension worker wait and the pairing recovery, which are the same
// subject: getting an extension into a state a run can use, and saying what is
// wrong when it will not.
//
// The diagnostics keep the rule the runner applied to them: labels, codes and
// counts. An activity's label and a recording block's code say why a recording
// would not start; a tab URL or an activity's detail would carry page data into
// a bundle, so neither is read.

import type { Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

/** How long the extension is given to reach a status a run is waiting for. */
const EXTENSION_STATUS_TIMEOUT_MS = 15_000;

/** One `chrome.runtime` message, from the extension's own page. A refusal is the extension's, and is raised as one. */
export async function runtimeMessage(page: Page, message: Record<string, unknown>): Promise<any> {
  const response = await page.evaluate((value: Record<string, unknown>) => (globalThis as any).chrome.runtime.sendMessage(value), message);
  if (!response?.ok) throw new RunnerFailure("extension.worker", response?.error ?? "Extension runtime message failed");
  return response;
}

/** The extension's current status, as `fluxiq.getStatus` reports it. */
export async function extensionStatus(page: Page): Promise<unknown> {
  return (await runtimeMessage(page, { type: "fluxiq.getStatus" })).status;
}

/** Polls the extension's status until the predicate holds, or fails as a connection timeout. */
export async function pollStatus(page: Page, predicate: (value: any) => boolean): Promise<any> {
  const deadline = Date.now() + EXTENSION_STATUS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await runtimeMessage(page, { type: "fluxiq.getStatus" });
    if (predicate(response.status)) return response.status;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("gateway.connection", "Timed out waiting for extension connection state");
}

/** The extension's own account of a recording start. Labels and reasons only: activity details and tab URLs carry page data. */
export function recordingStartDiagnostic(status: any): Record<string, unknown> | undefined {
  if (!status) return undefined;
  return {
    connectionState: status.connectionState,
    recordingState: status.recordingState,
    hasSessionId: typeof status.sessionId === "string",
    hasProjectId: typeof status.projectId === "string",
    unsupportedPageReason: status.unsupportedPage?.reason,
    recordingBlockCode: status.recordingBlock?.code,
    lastError: status.lastError,
    queueSize: status.queueSize,
    eventCount: status.eventCount,
    activities: Array.isArray(status.recentActivities) ? status.recentActivities.map((entry: any) => `${entry?.kind}:${entry?.label}`) : undefined
  };
}

/** The same diagnostic as one sentence, for the failure a run reports. */
export function describeRecordingStartDiagnostic(diagnostic: Record<string, unknown> | undefined): string {
  if (!diagnostic) return "the extension reported no status";
  return `connectionState=${String(diagnostic.connectionState)} recordingState=${String(diagnostic.recordingState)} lastError=${String(diagnostic.lastError ?? "none")} unsupportedPage=${String(diagnostic.unsupportedPageReason ?? "none")} recordingBlock=${String(diagnostic.recordingBlockCode ?? "none")}`;
}
