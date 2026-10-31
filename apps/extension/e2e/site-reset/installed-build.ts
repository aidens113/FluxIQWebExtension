import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime, automationStudioGatewayTraceServiceStore } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { registerWebAutomationDomain, createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle, WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES } from "@fluxiq-web-extension/domain";
import { startScenarioLab } from "../../../scenario-lab/src/server.js";
import { expect, restartServiceWorker, type ExtensionSession } from "../fixtures/extension-context";
import { startResetDiagnosticGateway } from "./gateway";

/** Every temporary root this harness makes starts so, and cleanup refuses anything else. */
const ROOT_PREFIX = "fluxiq-reset-installed-";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

type ActionResultSummary = {
  actionType: string;
  status: string;
  receivedAfterMs: number;
  resultBytes: number;
  resultNodes: number;
  failureCode?: string | undefined;
  effect?: string | undefined;
  retryable?: boolean | undefined;
};

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
  /** How many action results the extension has sent the gateway so far: each is one command the site was acted on or read with. */
  actionResults: () => number;
  /** Closed outcome/timing diagnostics; no command IDs, page data or credentials. */
  actionResultSummaries: () => readonly ActionResultSummary[];
  gatewayOutcomeSummaries: (projectId: string) => Promise<readonly { outcome?: string | undefined; reason?: string | undefined }[]>;
  /** The action type of every command Core has sent the extension so far, in order: what reached the site. */
  siteCommands: () => string[];
  /** Count of distinct command IDs already retained privately; never exposes IDs. */
  distinctActionCommands: () => number;
  /** Puts every Lab scenario back to its first state through the Lab's authenticated control endpoint (consent unanswered again, nothing liked), for a spec that must meet the site as a first visit does. */
  resetLab: () => Promise<void>;
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
  let actionResults = 0;
  const siteCommands: string[] = [];
  const traceScopes = new Set<string>();
  const sentCommands = new Map<string, { actionType: string; at: number }>();
  const actionResultSummaries: ActionResultSummary[] = [];
  const gateway = await startResetDiagnosticGateway(fluxiq, message => {
    if (message.type !== "client.action_result") return;
    actionResults++;
    const payload = record(message.payload);
    const command = typeof payload.commandId === "string" ? sentCommands.get(payload.commandId) : undefined;
    const failure = record(payload.failure);
    const pending: unknown[] = [payload];
    let resultNodes = 0;
    while (pending.length > 0) {
      const value = pending.pop();
      resultNodes++;
      if (value !== null && typeof value === "object") {
        for (const child of Object.values(value)) pending.push(child);
      }
    }
    actionResultSummaries.push({
      actionType: command?.actionType ?? "unmapped",
      status: typeof payload.status === "string" && ["succeeded", "failed", "unknown", "interrupted"].includes(payload.status) ? payload.status : "malformed",
      receivedAfterMs: command === undefined ? 0 : Date.now() - command.at,
      resultBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
      resultNodes,
      failureCode: typeof failure.code === "string" && /^(?:web|executor|output_dispatch)\.[a-z0-9_.]+$/u.test(failure.code) ? failure.code : undefined,
      effect: typeof failure.effect === "string" && ["unacted", "ambiguous", "acted"].includes(failure.effect) ? failure.effect : undefined,
      retryable: typeof failure.retryable === "boolean" ? failure.retryable : undefined
    });
    const snapshot = record(record(message.payload).payload).snapshot;
    if (snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot)) latestRawSnapshot = snapshot;
  }, (actionType, commandId, traceScope) => {
    if (traceScope !== undefined) traceScopes.add(traceScope);
    siteCommands.push(actionType);
    if (commandId !== undefined) sentCommands.set(commandId, { actionType, at: Date.now() });
  });
  const gatewayOutcomeSummaries = async (projectId: string) => {
    const store = automationStudioGatewayTraceServiceStore(fluxiq.programs.automationStudio, projectId);
    const summaries: { outcome?: string | undefined; reason?: string | undefined }[] = [];
    if (store === undefined) return summaries;
    for (const scope of traceScopes) {
      const manifest = await store.readManifest(scope);
      if (manifest === undefined) continue;
      for (const event of await store.readEventRange(scope, 1, manifest.completeness.lastSequence)) {
        if (event.stream !== "gateway" || event.kind !== "synthesized" || event.payload.encoding !== "json") continue;
        const value = record(event.payload.value);
        const outcome = typeof value.outcome === "string" && ["suppressed", "unknown", "timed_out", "observer_failed", "dispatch_failed", "refused_unsent"].includes(value.outcome) ? value.outcome : undefined;
        const reason = typeof value.reason === "string" && ["invalid_result", "not_waiting", "not_committed", "uncertain_status"].includes(value.reason) ? value.reason : undefined;
        if (outcome !== undefined || reason !== undefined) summaries.push({ outcome, reason });
      }
    }
    return summaries;
  };
  const runToken = randomBytes(24).toString("hex");
  const lab = await startScenarioLab({ runToken });
  const resetLab = async () => {
    const response = await fetch(`${lab.origin}/__control/reset`, { method: "POST", headers: { authorization: `Bearer ${runToken}`, "content-type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error(`diagnostic.lab_reset_${response.status}`);
  };
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
  return { fluxiq, service, page, origin: lab.origin, rootDir: root, gatewayErrors: gateway.errors, latestRawSnapshot: () => latestRawSnapshot, actionResults: () => actionResults, gatewayOutcomeSummaries, actionResultSummaries: () => actionResultSummaries.map((entry) => ({ ...entry })), siteCommands: () => [...siteCommands], distinctActionCommands: () => sentCommands.size, resetLab, pair, close };
}
