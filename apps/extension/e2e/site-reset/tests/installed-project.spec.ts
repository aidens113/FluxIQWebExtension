import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, registerWebAutomationDomain, createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle, WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES } from "@fluxiq-web-extension/domain/node";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context";
import { startResetDiagnosticGateway } from "../index";

const TASK = "Create one new store line.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
type Entry = { callId: string; toolId: string; value: JsonObject };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const answer = (decision: JsonObject) => ({ response: { kind: "evidence_tool_decision", summary: "Provider-free transport diagnostic", decision }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 } });

test("installed gateway project build preserves original collection authority for a new-row inverse", async ({ extensionSession }, testInfo) => {
  test.setTimeout(180_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-reset-installed-"));
  const make = () => FluxIQ.create({ rootDir: root, domainId: "web-automation", loadEnv: false, modelProvidersEnabled: false });
  const initial = make();
  await initial.setup();
  await initial.close();
  const fluxiq = registerWebAutomationDomain(make());
  const gateway = await startResetDiagnosticGateway(fluxiq);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("hex") });
  const service = fluxiq.programs.automationStudio;
  service.bindNativeNodeRuntime(new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle()));
  const cart = new URL("/scenarios/everything-store/cart", lab.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), lab.origin).href;
  const page = await extensionSession.context.newPage();
  const reads: Array<{ call: string; scopes: string[]; groups: string[]; sizes: number[]; hash: string; subjects: string[] }> = [];
  const declarations: Array<{ call: string; consequences: unknown; scope?: string; subject?: string; page?: string; item?: string; permitted: boolean }> = [];
  const outcomes: Array<{ call: string; ok: unknown; code: unknown }> = [];
  let build: Promise<unknown> | undefined;
  let projectId = "", flowId = "";
  let instructionSourceId = "";
  let baseline: string | undefined, restored: string | undefined;
  try {
    await page.goto(new URL("/scenarios/everything-store", lab.origin).href);
    await page.getByRole("dialog", { name: "Never miss a deal" }).waitFor();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await page.goto(detail);
    await page.getByTitle("Close", { exact: true }).click();
    await page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
    await page.getByRole("button", { name: "Minimize chat", exact: true }).click();
    // The first real domain observation knows this detail address. The builder
    // must still visit Cart itself before Add to establish original authority.
    await page.bringToFront();
    await extensionSession.extensionPage.evaluate(async url => chrome.storage.local.set({
      "fluxiq.clientId": "reset-installed-diagnostic", "fluxiq.settings": { gatewayUrl: url, coreApiUrl: "http://127.0.0.1:9/", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
    }), gateway.url);
    await restartServiceWorker(extensionSession);
    await extensionSession.extensionPage.reload();
    await extensionSession.extensionPage.getByRole("button", { name: "Connect", exact: true }).click();
    await expect.poll(() => fluxiq.programs.clientGateway.snapshot().pairings.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const pairing = fluxiq.programs.clientGateway.snapshot().pairings[0]!;
    await fluxiq.programs.clientGateway.approvePairing(pairing.pairingCode, { approvedByUserId: "diagnostic" });
    await expect.poll(() => fluxiq.programs.clientGateway.snapshot().sessions.filter(session => session.status === "ready").length).toBeGreaterThan(0);
    await page.bringToFront();
    console.log(JSON.stringify({ resetDiagnosticStage: "actual_gateway_paired" }));
    const runtime = createWebAutomationLlmEvidenceRuntime({
      eligibleSessionIds: () => fluxiq.programs.clientGateway.snapshot().sessions.filter(session => session.status === "ready").map(session => session.sessionId),
      executeAction: (session, command) => fluxiq.programs.automationStudioClientGateway.executeAction(session, command)
    });
    const startState = runtime.startState!.bind(runtime);
    runtime.startState = async input => {
      const result = await startState(input);
      if (result) {
        const collections = result.collections ?? [];
        reads.push({ call: input.callId, scopes: collections.map(collection => collection.scope), groups: collections.map(collection => collection.group), sizes: collections.map(collection => collection.subjects.length), hash: digest(collections), subjects: collections.flatMap(collection => collection.subjects) });
      }
      return result;
    };
    const execute = runtime.executeTool.bind(runtime);
    runtime.executeTool = async input => {
      const permission = input.permission;
      const result = await execute({ ...input, ...(permission ? { permission: async declaration => {
        const verdict = await permission(declaration);
        const control = declaration.control;
        declarations.push({ call: input.callId, consequences: declaration.consequences, ...(control?.scope ? { scope: control.scope } : {}), ...(control?.subject ? { subject: control.subject } : {}), ...(control?.page ? { page: control.page } : {}), ...(control?.item ? { item: control.item } : {}), permitted: verdict.permitted });
        return verdict;
      } } : {}) });
      const evidence = record(result.evidence);
      outcomes.push({ call: input.callId, ok: evidence.ok, code: evidence.code });
      return result;
    };
    service.bindLlmEvidenceRuntime(runtime);
    let supervisorStep = 0, builderStep = 0, addHandle = "";
    const receipts: Array<{ call: string; code: unknown }> = [];
    let failure: JsonObject = {};
    service.bindLlmExecutionProvider(() => ({ provider: {
      metadata: { provider: "scripted", model: "provider-free" }, runTask: async request => {
        if (request.taskKind === "loop_verification") return { response: { kind: "loop_verification", verdict: "yes", reason: "Diagnostic trial completed.", confidence: 1 }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 } };
        const loop = request.context.evidenceLoop;
        const tools = (loop?.tools ?? []).map(tool => tool.toolId);
        const evidence = (loop?.evidence ?? []) as Entry[];
        if (!tools.length) return answer({ kind: "tool_call", callId: "read", toolId: "none", input: {} });
        const last = (tool: string) => [...evidence].reverse().find(entry => entry.toolId === tool)?.value;
        const call = (id: string, toolId: string, input: JsonObject) => answer({ kind: "tool_call", callId: id, toolId, input });
        if (tools.includes("project.write_plan")) {
          supervisorStep++;
          const previous = evidence.at(-1);
          if (previous) receipts.push({ call: previous.toolId, code: previous.value.code ?? (previous.value.ok === true ? "ok" : "unknown") });
          if (supervisorStep === 1) return call("plan", "project.write_plan", { taskSpec: { parts: [{ id: "p1", quote: { sourceId: instructionSourceId, text: TASK }, goalFacts: ["A new line exists"], lastingActs: ["create_new"] }], notAsked: [] }, subflows: [{ key: "main", name: "New line", parts: ["p1"] }] });
          if (supervisorStep === 2) return call("dispatch", "project.dispatch", { reason: "Exercise the transport.", briefs: [{ kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["create_new"], maxIterations: 20 }] });
          return answer({ kind: "complete", result: record(last("project.dispatch")?.complete) });
        }
        const shown = [...evidence].reverse().map(entry => entry.value).find(value => typeof value.page === "string");
        const handle = (label: string): string => {
          const found = String(shown?.page ?? "").split("\n").find(line => /^t\d+ /u.test(line) && line.includes(JSON.stringify(label)))?.split(" ")[0];
          if (!found) throw new Error("diagnostic.control_missing");
          return found;
        };
        const node = (id: string, name: string, parameters: JsonObject, consequences: string[] = [], extra: JsonObject = {}) => call(id, "core.run_node", { node: name, parameters, consequences, ...extra });
        builderStep++;
        if (builderStep === 1) return node("original", "web.output.browser-navigate", { url: cart });
        if (builderStep === 2) { baseline = reads.at(-1)?.hash; return node("detail", "web.output.browser-navigate", { url: detail }); }
        if (builderStep === 3) { addHandle = handle("Add to Cart"); return node("add", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"]); }
        if (builderStep === 4) return node("destination", "web.output.browser-navigate", { url: cart });
        if (builderStep === 5) return call("submit", "core.submit_subflow", { flow: [`flow: New line`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`, `step add: add the product`, `  node: web.dom.click`, `  target: ${addHandle}`, `  consequences: create_new`].join("\n") });
        const submitted = last("core.submit_subflow");
        const tested = last("core.test_subflow");
        if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
        const candidate = { revision: submitted.revision, digest: submitted.digest };
        if (builderStep === 6) return call("trial.dirty", "core.test_subflow", candidate);
        if (builderStep === 7) {
          receipts.push({ call: "trial.dirty", code: tested?.code });
          const acts = tested?.actsToUndo as JsonObject[] | undefined;
          const act = acts?.[0]?.act;
          if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
          return node("undo.arrival", "web.output.browser-navigate", { url: cart }, [], { undoes: act });
        }
        if (builderStep === 8) {
          const acts = tested?.actsToUndo as JsonObject[] | undefined;
          const act = acts?.[0]?.act;
          if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
          return node("undo", "web.output.dom-click", { target: { handle: handle("Delete") } }, ["delete"], { undoes: act });
        }
        if (builderStep === 9) {
          const undone = last("core.run_node");
          receipts.push({ call: "undo", code: undone?.code ?? (undone?.ok === true ? "ok" : "unknown") });
          restored = reads.at(-1)?.hash;
          if (undone?.ok !== true) throw new Error("diagnostic.inverse_refused");
          return call("trial.clean", "core.test_subflow", candidate);
        }
        receipts.push({ call: "trial.clean", code: tested?.code ?? tested?.verdict });
        return answer({ kind: "complete", result: { subflowKey: "main", ...candidate } });
      }
    }, maxCallsPerRun: 30, maxEstimatedCostUsd: 0.1 }));
    const project = await service.createProject({ name: "Installed reset diagnostic", domainId: "web-automation" });
    projectId = project.id;
    const flow = await service.createFlow({ projectId, flowId: "flow.installed.reset", name: "Transport proof" });
    flowId = flow.flowId;
    instructionSourceId = (await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: TASK })).instructionId;
    build = service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project", caller: { actorUserId: "diagnostic", actorSessionId: "diagnostic" } }).then(() => "proposed", error => {
      const diagnostic = record(record(error).diagnostic);
      failure = { code: diagnostic.code ?? null, stage: diagnostic.stage ?? null, issueCodes: diagnostic.issueCodes ?? null };
      return "failed";
    });
    const ending = await build;
    const diagnostic = { ending, failure, supervisorStep, builderStep, baseline, restored, receipts, reads, declarations, outcomes, gatewayErrors: gateway.errors };
    await testInfo.attach("reset-structural.json", { body: Buffer.from(JSON.stringify(diagnostic)), contentType: "application/json" });
    console.log(JSON.stringify({ resetDiagnostic: diagnostic }));
    expect(receipts.find(receipt => receipt.call === "trial.dirty")?.code).toBe("candidate.trial_reset_required");
    expect(receipts.find(receipt => receipt.call === "undo")?.code).toBe("ok");
    expect(restored).toBe(baseline);
  } finally {
    if (build) { service.buildCancellation.cancel(projectId, flowId); await build; }
    await gateway.close();
    await fluxiq.close();
    await lab.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("fluxiq-reset-installed-")) throw new Error("diagnostic.cleanup_scope");
    await rm(owned, { recursive: true, force: true });
  }
});
