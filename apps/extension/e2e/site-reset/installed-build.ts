import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { registerWebAutomationDomain, createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle, WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES } from "@fluxiq-web-extension/domain";
import { startScenarioLab } from "../../../scenario-lab/src/server.js";
import { expect, restartServiceWorker, type ExtensionSession } from "../fixtures/extension-context";
import { startResetDiagnosticGateway } from "./gateway";

/** Every temporary root this harness makes starts so, and cleanup refuses anything else. */
const ROOT_PREFIX = "fluxiq-reset-installed-";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * The provider-free installed environment the site-reset proofs share: a real
 * FluxIQ Core with the web-automation domain, its real client gateway over a
 * websocket, the scenario Lab, and a page in the installed extension's own
 * browser. Nothing here calls a model; the build's provider is bound by the
 * spec (`./scripted-provider.ts`).
 */
export type InstalledBuild = {
  fluxiq: FluxIQ;
  service: FluxIQ["programs"]["automationStudio"];
  page: Page;
  origin: string;
  /** The build's temporary FluxIQ root, removed by `close`. */
  rootDir: string;
  gatewayErrors: string[];
  /** The newest raw snapshot an action result carried, for descriptor checks only. */
  latestRawSnapshot: () => JsonObject | undefined;
  /** Points the installed extension at the gateway, approves its pairing, and waits for a ready session. */
  pair: () => Promise<void>;
  close: () => Promise<void>;
};

export async function startInstalledBuild(session: ExtensionSession): Promise<InstalledBuild> {
  const root = await mkdtemp(path.join(os.tmpdir(), ROOT_PREFIX));
  const make = () => FluxIQ.create({ rootDir: root, domainId: "web-automation", loadEnv: false, modelProvidersEnabled: false });
  const initial = make();
  await initial.setup();
  await initial.close();
  const fluxiq = registerWebAutomationDomain(make());
  let latestRawSnapshot: JsonObject | undefined;
  const gateway = await startResetDiagnosticGateway(fluxiq, message => {
    if (message.type !== "client.action_result") return;
    const snapshot = record(record(message.payload).payload).snapshot;
    if (snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot)) latestRawSnapshot = snapshot;
  });
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("hex") });
  const service = fluxiq.programs.automationStudio;
  const nodes = new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES });
  service.bindNativeNodeRuntime(nodes.register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle()));
  const page = await session.context.newPage();
  const pair = async () => {
    await page.bringToFront();
    await session.extensionPage.evaluate(async url => chrome.storage.local.set({
      "fluxiq.clientId": "reset-installed-diagnostic",
      "fluxiq.settings": { gatewayUrl: url, coreApiUrl: "http://127.0.0.1:9/", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
    }), gateway.url);
    await restartServiceWorker(session);
    await session.extensionPage.reload();
    await session.extensionPage.getByRole("button", { name: "Connect", exact: true }).click();
    await expect.poll(() => fluxiq.programs.clientGateway.snapshot().pairings.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const pairing = fluxiq.programs.clientGateway.snapshot().pairings[0]!;
    await fluxiq.programs.clientGateway.approvePairing(pairing.pairingCode, { approvedByUserId: "diagnostic" });
    await expect.poll(() => fluxiq.programs.clientGateway.snapshot().sessions.filter(entry => entry.status === "ready").length).toBeGreaterThan(0);
    await page.bringToFront();
    console.log(JSON.stringify({ resetDiagnosticStage: "actual_gateway_paired" }));
  };
  const close = async () => {
    await gateway.close();
    await fluxiq.close();
    await lab.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith(ROOT_PREFIX)) throw new Error("diagnostic.cleanup_scope");
    await rm(owned, { recursive: true, force: true });
  };
  return { fluxiq, service, page, origin: lab.origin, rootDir: root, gatewayErrors: gateway.errors, latestRawSnapshot: () => latestRawSnapshot, pair, close };
}
