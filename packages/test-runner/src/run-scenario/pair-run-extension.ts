import type { Page } from "@playwright/test";
import type { RunningTopology } from "../coordinator.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, runtimeMessage } from "../run-lifecycle/index.js";
import type { ExtensionStartTrace } from "./extension-start-trace/index.js";

/** The extension's status once it is paired: connected, with the session Core gave it. */
export type PairedExtensionStatus = Record<string, unknown> & { connectionState: "connected"; sessionId: string };

/**
 * Pairs the run's extension with the run's Core: connects it to the
 * topology's gateway and Core API, approves the pairing through Core's
 * control, and recovers a cold gateway epoch (`pairExtensionWithColdEpochRecovery`).
 * The connect and the approval are timed into the extension start trace.
 * The topology must carry a control.
 */
export async function pairRunExtension(page: Page, topology: RunningTopology, trace: ExtensionStartTrace): Promise<PairedExtensionStatus> {
  return pairExtensionWithColdEpochRecovery({
    connect: () => trace.timed("connect", async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status, status => ({ connectionState: typeof status?.connectionState === "string" ? status.connectionState : "unreported", lastError: typeof status?.lastError === "string" ? status.lastError : null })),
    readStatus: () => extensionStatus(page),
    approvePairing: referenceCode => trace.timed("approve", () => topology.control!.approvePairing(referenceCode)),
  });
}
