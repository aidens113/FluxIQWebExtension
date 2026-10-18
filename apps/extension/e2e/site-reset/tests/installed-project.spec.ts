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
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex").slice(0, 20);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const answer = (decision: JsonObject) => ({ response: { kind: "evidence_tool_decision", summary: "Provider-free transport diagnostic", decision }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 } });

for (const retryTransfer of [false, true]) test(retryTransfer
  ? "installed gateway project build distinguishes a failed save from its successful retry inverse"
  : "installed gateway project build preserves original collection authority for a new-row inverse", async ({ extensionSession }, testInfo) => {
  test.setTimeout(180_000);
  const task = retryTransfer ? `${TASK} You may temporarily move the original first cart line to the saved collection while building, then restore it before a trial.` : TASK;
  const permitted = retryTransfer ? ["create_new", "modify_existing"] : ["create_new"];
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-reset-installed-"));
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
  service.bindNativeNodeRuntime(new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle()));
  const cart = new URL("/scenarios/everything-store/cart", lab.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), lab.origin).href;
  const page = await extensionSession.context.newPage();
  const reads: Array<{ call: string; scopes: string[]; groups: string[]; sizes: number[]; hash: string; subjects: string[]; resourceHash?: string; stateHashes: string[][] }> = [];
  const declarations: Array<{ call: string; consequences: unknown; scope?: string; subject?: string; page?: string; item?: string; resourceHash?: string; permitted: boolean }> = [];
  const outcomes: Array<{ call: string; ok: unknown; code: unknown }> = [];
  const targetDescriptors: JsonObject[] = [];
  let build: Promise<unknown> | undefined;
  let projectId = "", flowId = "";
  let instructionSourceId = "";
  let baseline: string | undefined, restored: string | undefined;
  let clickDispatches = 0, missingClicksBefore = 0, missingClicksAfter = 0;
  let missingCreateCode: unknown;
  let destinationReference = "";
  let originalItem = "", failedSaveAct = "", retryAct = "";
  let wrongClicksBefore = 0, wrongClicksAfter = 0, wrongHashBefore: string | undefined, wrongHashAfter: string | undefined;
  let wrongInverseCode: unknown, correctInverseCode: unknown;
  let otherEffectActs: string[] = [];
  let rowSelectionFailure: JsonObject | undefined;
  let correctClicksBefore = 0, correctClicksAfter = 0;
  const transferStages: Array<{ stage: string; readIndex: number }> = [];
  const transferStage = (stage: string) => { transferStages.push({ stage, readIndex: reads.length - 1 }); };
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
      executeAction: (session, command) => {
        if (command.actionType === "web.dom.click") clickDispatches++;
        return fluxiq.programs.automationStudioClientGateway.executeAction(session, command);
      }
    });
    const startState = runtime.startState!.bind(runtime);
    runtime.startState = async input => {
      const result = await startState(input);
      if (result) {
        const collections = result.collections ?? [];
        reads.push({ call: input.callId, scopes: collections.map(collection => collection.scope), groups: collections.map(collection => collection.group), sizes: collections.map(collection => collection.subjects.length), hash: digest(collections), subjects: collections.flatMap(collection => collection.subjects), ...(result.resource ? { resourceHash: digest(result.resource) } : {}), stateHashes: collections.map(collection => collection.subjects.map(subject => digest(collection.states[subject]))) });
      }
      return result;
    };
    const execute = runtime.executeTool.bind(runtime);
    runtime.executeTool = async input => {
      const permission = input.permission;
      const result = await execute({ ...input, ...(permission ? { permission: async declaration => {
        const verdict = await permission(declaration);
        const control = declaration.control;
        declarations.push({ call: input.callId, consequences: declaration.consequences, ...(control?.scope ? { scope: control.scope } : {}), ...(control?.subject ? { subject: control.subject } : {}), ...(control?.page ? { page: control.page } : {}), ...(control?.item ? { item: control.item } : {}), ...(control?.resource ? { resourceHash: digest(control.resource) } : {}), permitted: verdict.permitted });
        return verdict;
      } } : {}) });
      const evidence = record(result.evidence);
      outcomes.push({ call: input.callId, ok: evidence.ok, code: evidence.code });
      return result;
    };
    service.bindLlmEvidenceRuntime(runtime);
    let supervisorStep = 0, builderStep = 0, addHandle = "", inverseHandle = "";
    const receipts: Array<{ call: string; code: unknown }> = [];
    let failure: JsonObject = {};
    service.bindLlmExecutionProvider(() => ({ provider: {
      metadata: { provider: "scripted", model: "provider-free" }, runTask: async request => {
        if (request.taskKind === "loop_verification") return { response: { kind: "diagnosis", summary: "Diagnostic trial completed.", diagnosis: { answersRequest: "yes" } }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 } };
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
          if (supervisorStep === 1) return call("plan", "project.write_plan", { taskSpec: { parts: [{ id: "p1", quote: { sourceId: instructionSourceId, text: task }, goalFacts: ["A new line exists"], lastingActs: permitted }], notAsked: [] }, subflows: [{ key: "main", name: "New line", parts: ["p1"] }] });
          if (supervisorStep === 2) return call("dispatch", "project.dispatch", { reason: "Exercise the transport.", briefs: [{ kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: permitted, maxIterations: retryTransfer ? 30 : 20 }] });
          return answer({ kind: "complete", result: record(last("project.dispatch")?.complete) });
        }
        const shown = [...evidence].reverse().map(entry => entry.value).find(value => typeof value.page === "string");
        const handle = (label: string): string => {
          const found = String(shown?.page ?? "").split("\n").find(line => /^t\d+ /u.test(line) && line.includes(JSON.stringify(label)))?.split(" ")[0];
          if (!found) throw new Error("diagnostic.control_missing");
          return found;
        };
        // Match only words already observed in the original row, then choose
        // its freshly observed control. No selector or raw snapshot picks it.
        const rowControl = (label: string, identity?: string): { handle: string; identity: string } => {
          const blocks = String(shown?.page ?? "").split(/\n- (?:\d+\/\d+|row \d+)\n/u);
          for (const block of blocks.slice(1)) {
            const lines = block.split("\n");
            const title = lines.find(line => /^t\d+ (?:h[1-6] )?link "/u.test(line))?.match(/"(?:[^"\\]|\\.)*"/u)?.[0];
            if (!title || (identity !== undefined && title !== identity)) continue;
            const control = lines.find(line => /^t\d+ /u.test(line) && line.includes(JSON.stringify(label)))?.split(" ")[0];
            if (control) return { handle: control, identity: title };
          }
          const latest = evidence.at(-1);
          const latestSearch = last("web.find_on_page");
          rowSelectionFailure = {
            builderStep, rowBlockCount: blocks.length - 1, originalIdentityPresent: originalItem.length > 0,
            latestToolId: latest?.toolId ?? null,
            latestHasFullPage: typeof latest?.value.page === "string",
            latestHasFound: typeof latest?.value.found === "string",
            latestFoundHasRequestedControl: typeof latest?.value.found === "string" && latest.value.found.includes(JSON.stringify(label)),
            searchHasRequestedControl: typeof latestSearch?.found === "string" && latestSearch.found.includes(JSON.stringify(label)),
            shownPageHasRequestedControl: String(shown?.page ?? "").includes(JSON.stringify(label)),
            shownPageSourceIsLatest: latest?.value === shown
          };
          throw new Error("diagnostic.original_row_control_missing");
        };
        const node = (id: string, name: string, parameters: JsonObject, consequences: string[] = [], extra: JsonObject = {}) => call(id, "core.run_node", { node: name, parameters, consequences, ...extra });
        builderStep++;
        if (builderStep === 1) {
          addHandle = handle("Add to Cart");
          missingClicksBefore = clickDispatches;
          return node("add.missing", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"]);
        }
        if (builderStep === 2) {
          missingCreateCode = last("core.run_node")?.code;
          missingClicksAfter = clickDispatches;
          receipts.push({ call: "add.missing", code: missingCreateCode });
          return node("original", "web.output.browser-navigate", { url: cart });
        }
        if (builderStep === 3) {
          baseline = reads.at(-1)?.hash;
          if (retryTransfer) {
            originalItem = rowControl("Save for later").identity;
            transferStage("original");
          }
          const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
          const reference = destinations?.[0]?.ref;
          if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
          destinationReference = reference;
          return node("detail", "web.output.browser-navigate", { url: detail });
        }
        if (builderStep === 4) {
          addHandle = handle("Add to Cart");
          return node("add", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"], { resetDestination: destinationReference });
        }
        if (builderStep === 5) return node("destination", "web.output.browser-navigate", { url: cart });
        if (retryTransfer && builderStep === 6) {
          transferStage("postAdd");
          return node("save.failed", "web.output.dom-click", { target: { handle: rowControl("Save for later", originalItem).handle } }, ["modify_existing"]);
        }
        if (retryTransfer && builderStep === 7) {
          transferStage("failedSave");
          await page.getByText("Try again", { exact: true }).waitFor({ timeout: 10_000 });
          return node("retry.observe", "web.output.dom-capture_snapshot", {});
        }
        if (retryTransfer && builderStep === 8) return node("save.retry", "web.output.dom-click", { target: { handle: rowControl("Try again", originalItem).handle } }, ["modify_existing"]);
        if (retryTransfer && builderStep === 9) {
          transferStage("postRetry");
          return node("moved.observe", "web.output.browser-navigate", { url: cart });
        }
        const step = builderStep - (retryTransfer ? 4 : 0);
        if (step === 6) return call("submit", "core.submit_subflow", { flow: [`flow: New line`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`, `step add: add the product`, `  node: web.dom.click`, `  target: ${addHandle}`, `  consequences: create_new`].join("\n") });
        const submitted = last("core.submit_subflow");
        const tested = last("core.test_subflow");
        if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
        const candidate = { revision: submitted.revision, digest: submitted.digest };
        if (step === 7) return call("trial.dirty", "core.test_subflow", candidate);
        if (step === 8) {
          receipts.push({ call: "trial.dirty", code: tested?.code });
          const acts = tested?.actsToUndo as JsonObject[] | undefined;
          const act = acts?.find(value => value.call === "add")?.act;
          if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
          if (retryTransfer) {
            const failed = acts?.find(value => value.call === "save.failed")?.act;
            const retried = acts?.find(value => value.call === "save.retry")?.act;
            if (typeof failed !== "string" || typeof retried !== "string" || failed === retried) throw new Error("diagnostic.retry_act_receipts_missing");
            failedSaveAct = failed;
            retryAct = retried;
          }
          return node("undo.arrival", "web.output.browser-navigate", { url: cart }, [], { undoes: act });
        }
        if (step === 9) {
          inverseHandle = handle("Delete");
          return call("describe.inverse", "web.describe_element", { target: inverseHandle });
        }
        if (step === 10) {
          const description = String(last("web.describe_element")?.element ?? "");
          const tag = description.match(/<(\w+)>/u)?.[1];
          const box = description.match(/box: x=(-?\d+) y=(-?\d+) (\d+)x(\d+)/u)?.slice(1).map(Number);
          const elements = (latestRawSnapshot?.interactiveElements as JsonObject[] | undefined) ?? [];
          const matches = elements.filter(element => {
            const bounds = record(element.documentBounds);
            return element.tagName === tag && box?.every((number, index) => number === Math.round(Number(bounds[["x", "y", "width", "height"][index]!])));
          });
          const features = (element: JsonObject): JsonObject => ({
            tag: element.tagName ?? null,
            rolePresent: typeof element.role === "string",
            tabindexPresent: Object.hasOwn(record(element.attributes), "tabindex"),
            ownHandlerBool: element.hasClickHandler === true,
            cursorPointer: element.cursor === "pointer",
            subjectPresent: typeof record(element.context).subject === "string"
          });
          const matched = matches.length === 1 ? matches[0] : undefined;
          const row = matched ? digest(record(matched.context).record) : undefined;
          const siblings = matched ? elements.filter(element => element !== matched && digest(record(element.context).record) === row && (element.accessibleName === "Delete" || element.visibleText === "Delete") && Object.hasOwn(record(element.attributes), "tabindex")) : [];
          targetDescriptors.push({ handleHash: digest(inverseHandle), matchCount: matches.length, ...(matched ? features(matched) : {}), sameRowAlternatives: siblings.map(features) });
          if (!matched) throw new Error("diagnostic.descriptor_match_unproved");
          const acts = tested?.actsToUndo as JsonObject[] | undefined;
          const act = acts?.find(value => value.call === "add")?.act;
          if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
          return node("undo", "web.output.dom-click", { target: { handle: inverseHandle } }, ["delete"], { undoes: act });
        }
        if (step === 11) {
          const undone = last("core.run_node");
          receipts.push({ call: "undo", code: undone?.code ?? (undone?.ok === true ? "ok" : "unknown") });
          if (undone?.ok !== true) throw new Error("diagnostic.inverse_refused");
          if (retryTransfer) {
            transferStage("afterDelete");
            return node("wrong.observe", "web.output.dom-capture_snapshot", {});
          }
          restored = reads.at(-1)?.hash;
          return call("trial.clean", "core.test_subflow", candidate);
        }
        if (retryTransfer && step === 12) {
          wrongClicksBefore = clickDispatches;
          wrongHashBefore = reads.at(-1)?.hash;
          return node("undo.failed", "web.output.dom-click", { target: { handle: rowControl("Move to cart", originalItem).handle } }, ["modify_existing"], { undoes: failedSaveAct });
        }
        if (retryTransfer && step === 13) {
          const refused = last("core.run_node");
          wrongInverseCode = refused?.code;
          const related = refused?.otherActsWithObservedEffect;
          otherEffectActs = Array.isArray(related) ? related.map(value => record(value).act).filter((value): value is string => typeof value === "string") : [];
          wrongClicksAfter = clickDispatches;
          wrongHashAfter = reads.at(-1)?.hash;
          transferStage("afterWrong");
          receipts.push({ call: "undo.failed", code: wrongInverseCode });
          if (refused?.ok !== false || wrongClicksAfter !== wrongClicksBefore) throw new Error("diagnostic.wrong_claim_dispatched");
          return node("correct.observe", "web.output.dom-capture_snapshot", {});
        }
        if (retryTransfer && step === 14) {
          correctClicksBefore = clickDispatches;
          return node("undo.retry", "web.output.dom-click", { target: { handle: rowControl("Move to cart", originalItem).handle } }, ["modify_existing"], { undoes: retryAct });
        }
        if (retryTransfer && step === 15) {
          const corrected = last("core.run_node");
          correctInverseCode = corrected?.code ?? (corrected?.ok === true ? "ok" : "unknown");
          receipts.push({ call: "undo.retry", code: correctInverseCode });
          restored = reads.at(-1)?.hash;
          correctClicksAfter = clickDispatches;
          transferStage("afterCorrect");
          if (corrected?.ok !== true) throw new Error("diagnostic.correct_retry_inverse_refused");
          return call("trial.clean", "core.test_subflow", candidate);
        }
        receipts.push({ call: "trial.clean", code: tested?.code ?? tested?.verdict });
        return answer({ kind: "complete", result: { subflowKey: "main", ...candidate } });
      }
    }, maxCallsPerRun: retryTransfer ? 40 : 30, maxEstimatedCostUsd: 0.1 }));
    const project = await service.createProject({ name: "Installed reset diagnostic", domainId: "web-automation" });
    projectId = project.id;
    const flow = await service.createFlow({ projectId, flowId: "flow.installed.reset", name: "Transport proof" });
    flowId = flow.flowId;
    instructionSourceId = (await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: task })).instructionId;
    build = service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project", caller: { actorUserId: "diagnostic", actorSessionId: "diagnostic" } }).then(() => "proposed", error => {
      const diagnostic = record(record(error).diagnostic);
      failure = { code: diagnostic.code ?? null, stage: diagnostic.stage ?? null, issueCodes: diagnostic.issueCodes ?? null };
      return "failed";
    });
    const ending = await build;
    const diagnostic = { ending, failure, supervisorStep, builderStep, baseline, restored, receipts, reads, declarations, outcomes, targetDescriptors, rowSelectionFailure, missingCreate: { code: missingCreateCode, clickDispatchesBefore: missingClicksBefore, clickDispatchesAfter: missingClicksAfter }, retryTransfer: retryTransfer ? { failedSaveAct, retryAct, wrongInverseCode, correctInverseCode, otherEffectActs, wrongClicksBefore, wrongClicksAfter, wrongHashBefore, wrongHashAfter, correctClicksBefore, correctClicksAfter, stages: transferStages } : null, gatewayErrors: gateway.errors };
    await testInfo.attach("reset-structural.json", { body: Buffer.from(JSON.stringify(diagnostic)), contentType: "application/json" });
    console.log(JSON.stringify({ resetDiagnostic: diagnostic }));
    expect(ending).toBe("proposed");
    expect(missingCreateCode).toBe("candidate.create_baseline_required");
    expect(missingClicksAfter).toBe(missingClicksBefore);
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    expect(restored).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline && read.sizes.length === 2 && read.sizes[0] === 2 && read.sizes[1] === 2);
    const postAdd = reads.find(read => read.sizes.length === 2 && read.sizes[0] === 3 && read.sizes[1] === 2);
    expect(original).toBeDefined();
    expect(postAdd).toBeDefined();
    if (!original || !postAdd) throw new Error("diagnostic.complete_inventory_missing");
    expect(original.subjects).toHaveLength(4);
    expect(postAdd.subjects).toHaveLength(5);
    expect(original.scopes.every(scope => /^p:[a-f0-9]{32}$/u.test(scope))).toBe(true);
    expect(postAdd.scopes).toEqual(original.scopes);
    expect(postAdd.groups).toEqual(original.groups);
    const add = declarations.find(declaration => declaration.call === "add");
    const inverse = declarations.find(declaration => declaration.call === "undo");
    expect(add?.subject).toMatch(/^s:[a-f0-9]{32}$/u);
    expect(add?.permitted).toBe(true);
    const refused = declarations.find(declaration => declaration.call === "add.missing");
    expect(refused?.permitted).toBe(false);
    expect(refused?.subject).toBe(add?.subject);
    expect(inverse?.permitted).toBe(true);
    expect(inverse?.subject).toBe(add?.subject);
    expect(inverse?.scope).toBe(postAdd.scopes[0]);
    expect(original.subjects).not.toContain(add?.subject);
    expect(postAdd.subjects).toContain(add?.subject);
    expect(targetDescriptors).toHaveLength(1);
    expect(targetDescriptors[0]).toMatchObject({ matchCount: 1, tag: "span", rolePresent: false, tabindexPresent: false, ownHandlerBool: false, cursorPointer: true, subjectPresent: true });
    expect(receipts.find(receipt => receipt.call === "trial.dirty")?.code).toBe("candidate.trial_reset_required");
    expect(receipts.find(receipt => receipt.call === "undo")?.code).toBe("ok");
    if (retryTransfer) {
      const failed = declarations.find(declaration => declaration.call === "save.failed");
      const retried = declarations.find(declaration => declaration.call === "save.retry");
      const wrong = declarations.find(declaration => declaration.call === "undo.failed");
      const correct = declarations.find(declaration => declaration.call === "undo.retry");
      expect(failed?.consequences).toEqual(["modify_existing"]);
      expect(retried?.consequences).toEqual(["modify_existing"]);
      expect(failed?.subject).toMatch(/^s:[a-f0-9]{32}$/u);
      expect(failed?.subject).not.toBe(add?.subject);
      expect(original.subjects).toContain(failed?.subject);
      expect(retried?.subject).toBe(failed?.subject);
      expect(retried?.scope).toBe(failed?.scope);
      expect(original.resourceHash).toMatch(/^[a-f0-9]{20}$/u);
      expect(failed?.resourceHash).toBe(original.resourceHash);
      expect(retried?.resourceHash).toBe(original.resourceHash);
      expect(failed?.scope).toBe(original.scopes[0]);
      const staged = (stage: string) => {
        const at = transferStages.find(value => value.stage === stage)?.readIndex;
        if (at === undefined || !reads[at]) throw new Error("diagnostic.transfer_stage_missing");
        return reads[at]!;
      };
      expect(staged("postAdd").sizes).toEqual([3, 2]);
      expect(staged("failedSave").subjects).toEqual(staged("postAdd").subjects);
      expect(staged("postRetry").sizes).toEqual([2, 3]);
      expect(staged("postRetry").subjects.slice(0, 2)).not.toContain(failed?.subject);
      expect(staged("postRetry").subjects.slice(2)).toContain(failed?.subject);
      expect(staged("afterDelete").sizes).toEqual([1, 3]);
      expect(wrongInverseCode).toBe("candidate.undo_unproved");
      expect(otherEffectActs).toEqual([retryAct]);
      expect(wrongClicksAfter).toBe(wrongClicksBefore);
      expect(wrongHashBefore).toMatch(/^[a-f0-9]{20}$/u);
      expect(wrongHashAfter).toBe(wrongHashBefore);
      expect(wrong?.permitted).toBe(false);
      expect(wrong?.subject).toBe(failed?.subject);
      expect(correct?.permitted).toBe(true);
      expect(correct?.subject).toBe(failed?.subject);
      expect(correct?.scope).toBe(original.scopes[1]);
      expect(correctInverseCode).toBe("ok");
      expect(correctClicksAfter).toBe(correctClicksBefore + 1);
      expect(staged("afterCorrect").sizes).toEqual([2, 2]);
    }
    expect(restored).toBe(baseline);
    expect(receipts.find(receipt => receipt.call === "trial.clean")?.code).toBe("yes");
  } finally {
    if (build) {
      service.buildCancellation.cancel(projectId, flowId);
      await build;
    }
    await gateway.close();
    await fluxiq.close();
    await lab.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("fluxiq-reset-installed-")) throw new Error("diagnostic.cleanup_scope");
    await rm(owned, { recursive: true, force: true });
  }
});
