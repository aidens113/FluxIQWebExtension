import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AutomationStudioService, AutomationStudioNativeNodeRuntime,
  createAutomationStudioSessionKeyProviderResolver, automationNodeStateBinding
} from "fluxiq/automation-studio";
import { IoRegistry, defineDomainIo, defineOutput } from "fluxiq/io";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "../llm-evidence";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";
import {
  createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS, WEB_AUTOMATION_RUNTIME_CAPABILITIES
} from "../../output-nodes";
import { webAutomationManifestOutputs } from "../../io/manifest-definitions";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";

const EXTRACT = "web.output.dom-extract_list";
const TYPE = "web.output.dom-type";
const LOCATION = "https://fixture.test/carried-rows";
const ACTOR = { actorUserId: "fixture.user", actorSessionId: "fixture.session" };
const ROWS = [{ name: "Alpha", desired: "alpha-right" }, { name: "Beta", desired: "beta-right" }];
const FRESH_ROWS = [...ROWS].reverse().map(row => ({ ...row, desired: `${row.name.toLowerCase()}-fresh-right` }));
const DECOY = { name: "Decoy", desired: "never-write" };
const CONTROLS = {
  "#row-message": { tagName: "input", inputType: "text", attributes: { id: "row-message", type: "text" }, context: { record: { text: "Alpha alpha-right" } } },
  "#message": { tagName: "input", inputType: "text", attributes: { id: "message", type: "text" } }
} satisfies Record<string, JsonObject>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value), "fixture expected an object");
  return value;
}

function reply(content: JsonObject): Response {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 14, completion_tokens: 7, total_tokens: 21 }
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function fixture(root: string) {
  let text = "";
  let fresh = false;
  const rowValues = new Map<string, string>();
  let decisions = 0;
  let judgeCalls = 0;
  let replacementChecked = false;
  const replacementFeedback: Array<{ code?: string; itemsMentioned: boolean; eachMentioned: boolean; shapeKeys: string[] }> = [];
  let unresolvedBindingRefused = false;

  const commands: Array<{ action: string; parameters: JsonObject; phase: string }> = [];
  const mutations: Array<{ action: string; phase: string; row?: string; text: string }> = [];
  const modelCalls: Array<{ task: string; phase: string; commandCount: number }> = [];
  let phase = "saved-run";
  function currentRows() { return fresh ? FRESH_ROWS : ROWS; }
  function snapshot(): JsonObject {
    return {
      url: LOCATION, title: "Carried row fixture", text: `Summary: ${text}; rows: ${[...rowValues].map(([name, value]) => `${name}=${value}`).join(";")}`,
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
      interactiveElements: [{ ...CONTROLS["#row-message"], selector: "#row-message" }, { ...CONTROLS["#message"], selector: "#message", value: text }]
    };
  }
  const command: WebLlmEvidenceGateway["executeAction"] = async (_session, request) => {
    commands.push({ action: request.actionType, parameters: structuredClone(request.parameters), phase });
    if (request.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshot() } };
    if (request.actionType === "web.browser.navigate") { fresh = true; text = ""; rowValues.clear(); }
    if (request.actionType === "web.dom.extract_list") return { status: "succeeded", payload: { extracted: currentRows(), snapshot: snapshot() } };
    if (request.actionType === "web.dom.type") {
      assert.equal(typeof request.parameters.text, "string", "binding must resolve before dispatch");
      if (request.parameters.selector === "#message") {
        text = String(request.parameters.text);
        mutations.push({ action: request.actionType, phase, text });
      } else {
        assert.equal(request.parameters.selector, "#row-message");
        const context = record(record(request.parameters.element).context);
        const values = record(context.record).values;
        assert.ok(Array.isArray(values), "row target requires actual current scoped row values, never example selector alone");
        const matches = [...currentRows(), DECOY].filter(row => Object.values(row).every(value => values.includes(value)));
        assert.equal(matches.length, 1, "current target must identify exactly one row");
        const row = matches[0]!;
        assert.notEqual(row.name, DECOY.name, "excluded row must never mutate");
        assert.equal(request.parameters.text, row.desired, "actual row mapping must supply that row's own value");
        rowValues.set(row.name, String(request.parameters.text));
        mutations.push({ action: request.actionType, phase, row: row.name, text: String(request.parameters.text) });
      }
    }
    return { status: "succeeded", payload: { snapshot: snapshot() } };
  };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => [ACTOR.actorSessionId], executeAction: command
  };
  const host: WebAutomationHostRuntimeGateway = {
    dispatch: async ({ outputId, payload, metadata }) => {
      const result = await command(ACTOR.actorSessionId, { actionType: outputId, parameters: payload, metadata: metadata ?? {} });
      return { ok: result.status === "succeeded", outputId, domainId: WEB_AUTOMATION_DOMAIN_ID, payload: { result: result.payload ?? {} } };
    }
  };
  const io = new IoRegistry();
  io.register(defineDomainIo({ domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputs: webAutomationManifestOutputs.map((definition) => defineOutput<JsonObject, JsonObject>({
      definition, mode: "request", dispatch: (request) => host.dispatch({ ...request, metadata: request.metadata ?? {} })
    }))
  }));
  const resolve = createAutomationStudioSessionKeyProviderResolver({
    ports: {
      snapshot: async () => ({ keys: [{ id: "fixture.key", name: "Script", kind: "llm", provider: "deepseek", scope: "global", enabled: true, createdAtMs: 1, updatedAtMs: 1, lastRotatedAtMs: 1, metadata: { model: "deepseek-flash" } }] }),
      createSessionRevealAuthorization: async () => ({ authorizationId: "fixture.reveal", keyId: "fixture.key", keyUpdatedAtMs: 1 }),
      revealKeyWithAuthorization: async () => ({ value: "fixture-only-not-a-provider-key" }),
      revokeRevealAuthorization: () => undefined
    },
    fetchImpl: async (_url, init) => {
      const body = record(JSON.parse(String(init?.body ?? "{}")));
      assert.ok(Array.isArray(body.messages));
      const user = body.messages.map(record).find((message) => message.role === "user");
      assert.equal(typeof user?.content, "string");
      const sent = String(user?.content);
      const request = record(JSON.parse(sent));
      const task = String(request.taskKind);
      modelCalls.push({ task, phase, commandCount: commands.length });
      if (task === "loop_verification") {
        judgeCalls += 1;
        const right = text === "right" && currentRows().every(row => rowValues.get(row.name) === row.desired);
        assert.ok(sent.includes(right ? "right" : "wrong"), "judge must receive the actual observed message");
        return reply({ kind: "diagnosis", summary: right ? "The message is right." : "The message is wrong.",
          diagnosis: right ? { answersRequest: "yes" } : { answersRequest: "no", changed: "Set the editor message to right." } });
      }
      assert.equal(task, "evidence_tool_decision", "fixture accepts only actual judge and repair tasks");
      phase = "repair";
      decisions += 1;
      const context = record(request.context);
      const loop = record(context.evidenceLoop);
      assert.ok(Array.isArray(loop.evidence));
      unresolvedBindingRefused ||= loop.evidence.map(record).some((entry) => entry.toolId === "core.dry_run" && JSON.stringify(entry.value).includes("core.replay.unresolved_binding"));
      for (const entry of loop.evidence.map(record).filter(entry => entry.callId === "fixture.replacement")) {
        const feedback = record(entry.value);
        const serialized = JSON.stringify(feedback);
        replacementFeedback.push({ code: typeof feedback.code === "string" ? feedback.code : undefined, itemsMentioned: /items/.test(serialized), eachMentioned: /for-each/.test(serialized), shapeKeys: Object.keys(feedback) });
      }
      const draft = loop.evidence.map(record).find((entry) => entry.toolId === "core.flow_draft");
      const value = record(draft?.value);
      assert.ok(Array.isArray(value.steps));
      const steps = value.steps.map(record);
      const faulty = steps.find((step) => step.actionId === TYPE && step.inResult === true && step.written !== true && isRecord(step.input) && isRecord(step.input.parameters) && step.input.parameters.selector === "#message");
      const written = steps.find((step) => step.actionId === TYPE && step.inResult === true && step.written === true);
      if (written) {
        const argument = record(written.input);
        const parameters = record(argument.parameters);
        const binding = record(parameters.text);
        assert.equal(binding.$input, "message");
        assert.equal(binding.test, "right");
        assert.equal(written.changed, "no", "written replacement is checked, not performed");
        replacementChecked = true;
      }
      let decision: JsonObject;
      if (decisions === 1) {
        assert.equal(typeof faulty?.step, "number", "saved type must seed the real extend draft");
        // Read the same published control line the provider was actually shown.
        const field = loop.evidence.map(record).flatMap((entry) => {
          if (!isRecord(entry.value)) return [];
          const page = typeof entry.value.page === "string" ? entry.value.page : isRecord(entry.value.page) && typeof entry.value.page.page === "string" ? entry.value.page.page : "";
          return page.split("\n").flatMap((line) => {
            const match = /^(t[1-9][0-9]*) field(?::[\w-]+|\[search\])?(?: |$)/u.exec(line);
            return match?.[1] ? [match[1]] : [];
          });
        }).at(-1);
        assert.ok(field, "seed observation must actually show the message field");
        decision = { kind: "tool_call", callId: "fixture.replacement", toolId: "core.run_node", input: {
          node: TYPE, write: true, parameters: { target: { handle: field }, text: { $input: "message", test: "right" } }, consequences: []
        } };
      } else if (decisions === 2) {
        assert.ok(replacementChecked, "ordinary write must admit a current bound replacement before dropping old type");
        assert.equal(typeof faulty?.step, "number");
        decision = { kind: "amend_draft", amendments: [{ step: Number(faulty?.step), change: "drop" }] };
      } else decision = { kind: "complete", result: { summary: "The editor message is right." } };
      return reply({ kind: "evidence_tool_decision", summary: "Repair only the message.", decision });
    }
  });
  const native = new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES })
    .register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const service = new AutomationStudioService({ dataDir: root, seedFixture: false,
    llmProviderResolver: (input) => resolve(input), llmEvidenceRuntime: runtime,
    hostRuntime: createWebAutomationHostRuntime(host)
  }).bindIoRuntime(io, WEB_AUTOMATION_DOMAIN_ID).bindNativeNodeRuntime(native);
  const project = await service.createProject({ name: "Carried service fixture", domainId: WEB_AUTOMATION_DOMAIN_ID });
  const flow = await service.createFlow({ projectId: project.id, flowId: "flow.carried.fixture", name: "Row messages and summary" });
  await service.saveFlow({ projectId: project.id, flow: { ...flow, metadata: {
    adaptationModeVersion: 1, adaptationMode: "fully_adaptive",
    adaptationPolicySettings: { preset: "adaptive", proposalMode: "auto", allowRuntimeRecovery: true, allowCreateRecoveryPaths: true, allowModifySubflows: true, allowCreateSubflows: true, allowModifyRouter: true, allowModifyExpectations: true, allowModifyActionTargets: true },
    trainingModeSettings: { mode: "continuous_adaptive", allowLlmIntervention: true, allowRuntimeRecovery: true, allowAdaptationCreation: true, proposalApprovalMode: "auto", allowPromotion: true, requireFirstManualReviewBeforeAutoPromotion: false,
      budgets: { maxInterventionsPerRun: 2, maxCostUsdPerTrainingWindow: 5, exhaustedBehavior: "ask" },
      resultCheck: { schedule: { enabled: true, shape: "every_run", initialRunCount: 3, interval: 5, decay: 5 } }
    }
  } } });
  const primary = await service.createFlowSubflow({ projectId: project.id, flowId: flow.flowId, name: "Primary", role: "primary" });
  assert.ok(primary.graphFlowId);
  const graph = await service.getFlow(project.id, primary.graphFlowId);
  const edge = (id: string, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => ({ id, sourceNodeId, sourcePortId, targetNodeId, targetPortId });
  await service.saveFlow({ projectId: project.id, flow: { ...graph, nodes: [
    { id: "start", definitionId: "builtin.control.start", parameterValues: {} },
    { id: "list", definitionId: EXTRACT, parameterValues: { extractList: { item: "li.row", fields: { name: ".name", desired: ".desired" } } }, metadata: { declaredConsequences: [] } },
    { id: "each", definitionId: "builtin.control.for-each", parameterValues: {} },
    { id: "row-type", definitionId: TYPE, parameterValues: { selector: "#row-message", element: CONTROLS["#row-message"], text: automationNodeStateBinding("item.desired") }, metadata: { declaredConsequences: [] } },
    { id: "type", definitionId: TYPE, parameterValues: { selector: "#message", element: CONTROLS["#message"], text: { $state: { path: "message", fallback: "wrong" } } }, metadata: { declaredConsequences: [] } },
    { id: "end", definitionId: "builtin.control.end", parameterValues: { status: "success" } }
  ], edges: [
    edge("start.list", "start", "success", "list", "in"), edge("list.each", "list", "success", "each", "in"),
    edge("list.items", "list", "records", "each", "items"), edge("each.body", "each", "body", "row-type", "in"),
    edge("each.item", "each", "item", "row-type", "item"), edge("row.each", "row-type", "success", "each", "in"),
    edge("each.done", "each", "done", "type", "in"), edge("type.end", "type", "success", "end", "in")
  ] } });
  await service.setFlowMapFallback({ projectId: project.id, flowId: flow.flowId, kind: "subflow", targetSubflowId: primary.subflowId });
  await service.saveFlowInstruction(project.id, { schemaVersion: "0.1", instructionId: "instruction.carried", title: "Right message", body: "Set each listed row message to its desired value and set the global summary to right.", scope: { kind: "flow", projectId: project.id, flowId: flow.flowId }, priority: 100, status: "active", requirement: "required", tags: ["generation"], createdAt: 1, updatedAt: 1 });
  return { service, runtime, projectId: project.id, flowId: flow.flowId, commands, mutations, modelCalls,
    judgeCalls: () => judgeCalls, replacementChecked: () => replacementChecked, unresolvedBindingRefused: () => unresolvedBindingRefused, text: () => text, replacementFeedback, graphId: primary.graphFlowId, rowValues };
}


test("actual saved row repair retains fresh listing and per-row mapping before judgement", { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-carried-rows-"));
  let harness: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    harness = await fixture(root);
    const run = await harness.service.runRuntimeSession({ projectId: harness.projectId, flowId: harness.flowId, authorizedDomainIds: [WEB_AUTOMATION_DOMAIN_ID], llmExecution: { ...ACTOR, intent: "build_and_adapt" } });
    const detail = await harness.service.getFlowRunDetail(harness.projectId, run.runId);
    const codes = new Set<string>();
    const inputIssues: Array<Record<string, unknown>> = [];
    function diagnosticCodes(value: unknown): void {
      if (Array.isArray(value)) { value.forEach(diagnosticCodes); return; }
      if (!isRecord(value)) return;
      if (value.code === "bootstrap.required_input_unconnected") inputIssues.push(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, typeof child === "string" && /^(s[1-9][0-9]*|items|builtin\.control\.for-each|bootstrap\.required_input_unconnected)$/.test(child) ? child : Array.isArray(child) ? child.map(part => typeof part === "string" && /^[a-zA-Z0-9_.-]+$/.test(part) ? part : "withheld") : typeof child])));
      for (const [key, child] of Object.entries(value)) {
        if (["code", "resultCode", "status", "phase", "outcome"].includes(key) && typeof child === "string" && /^[a-z0-9_.-]+$/u.test(child)) codes.add(child);
        else if (typeof child === "object") diagnosticCodes(child);
      }
    }
    diagnosticCodes(detail?.metadata);
    t.diagnostic(JSON.stringify({ status: run.status, codes: [...codes], inputIssues, replacementChecked: harness.replacementChecked(), replacementFeedback: harness.replacementFeedback, commands: harness.commands.map(call => ({ action: call.action, phase: call.phase })), mutations: harness.mutations.map(mutation => ({ phase: mutation.phase, row: mutation.row ?? "summary", right: mutation.text.endsWith("right") })) }));
    const saved = harness.commands.filter(call => call.phase === "saved-run" && ["web.dom.extract_list", "web.dom.type"].includes(call.action));
    assert.deepEqual(saved.map(call => call.action), ["web.dom.extract_list", "web.dom.type", "web.dom.type", "web.dom.type"], "setup must genuinely execute extraction/foreach/two mapped rows/faulty summary");
    assert.deepEqual(harness.mutations.filter(m => m.phase === "saved-run" && m.row).map(m => [m.row, m.text]), ROWS.map(row => [row.name, row.desired]));
    assert.ok(detail?.actionAttempts?.some(attempt => {
      const refs = attempt.metadata?.stateRefs;
      const before = isRecord(refs) ? refs.beforeAction : undefined;
      return attempt.nodeId === "list" && isRecord(before) && isRecord(before.from) && before.from.location === LOCATION;
    }), "actual first extraction host capture must retain the reset start");
    assert.ok(harness.judgeCalls() >= 2, "actual faulty summary must be refuted before repair");
    assert.ok(harness.replacementChecked(), "actual writer must admit the only faulty-step replacement");
    const reset = harness.commands.findIndex(call => call.phase === "repair" && call.action === "web.browser.navigate");
    const listed = harness.commands.findIndex((call, at) => at > reset && call.phase === "repair" && call.action === "web.dom.extract_list");
    assert.ok(reset >= 0 && listed > reset, "repaired whole test must reset and freshly replay the untouched listing");
    const repairRows = harness.mutations.filter(m => m.phase === "repair" && m.row);
    assert.deepEqual(repairRows.map(m => [m.row, m.text]), FRESH_ROWS.map(row => [row.name, row.desired]), "fresh repeat must use each current row and its retained parameter mapping");
    const summary = harness.commands.findIndex((call, at) => at > listed && call.phase === "repair" && call.action === "web.dom.type" && call.parameters.selector === "#message" && call.parameters.text === "right");
    const judge = harness.modelCalls.find(call => call.task === "loop_verification" && call.phase === "repair");
    assert.ok(summary > listed && judge && judge.commandCount > summary, "accepting judge must follow actual fresh list/row body/correct summary");
    assert.equal(run.status, "succeeded");
    const graph = await harness.service.getFlow(harness.projectId, harness.graphId);
    assert.equal(graph.nodes.filter(n => n.definitionId === "builtin.control.for-each").length, 1);
    const body = graph.nodes.find(n => n.id === "row-type");
    assert.ok(body, "unchanged body retains original stable node identity");
    assert.deepEqual(body.parameterValues?.text, automationNodeStateBinding("item.desired"));
    assert.deepEqual(body.metadata?.declaredConsequences, []);
  } finally {
    await harness?.service.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("fluxiq-carried-rows-"));
    await rm(root, { recursive: true, force: true });
  }
});
