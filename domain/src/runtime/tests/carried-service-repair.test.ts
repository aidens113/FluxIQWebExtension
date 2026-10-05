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

const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";
const LOCATION = "https://fixture.test/carried";
const ACTOR = { actorUserId: "fixture.user", actorSessionId: "fixture.session" };
const CONTROLS = {
  "#open": { tagName: "button", visibleText: "Open editor", attributes: { id: "open" } },
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

async function fixture(root: string, options: { missingDeclaration?: true; missingStart?: true; unresolvedSavedBinding?: true } = {}) {
  let text = "";
  let opened = false;
  let decisions = 0;
  let judgeCalls = 0;
  let replacementChecked = false;
  let unresolvedBindingRefused = false;
  let prepareRepair: (() => Promise<void>) | undefined;
  const commands: Array<{ action: string; parameters: JsonObject; phase: string }> = [];
  const mutations: Array<{ action: string; phase: string }> = [];
  const modelCalls: Array<{ task: string; phase: string; commandCount: number }> = [];
  let phase = "saved-run";
  function snapshot(): JsonObject {
    return {
      url: LOCATION, title: "Carried fixture", text: `Editor message: ${text}`,
      viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
      interactiveElements: [
        { ...CONTROLS["#open"], selector: "#open" },
        ...(opened ? [{ ...CONTROLS["#message"], selector: "#message", value: text }] : [])
      ]
    };
  }
  const command: WebLlmEvidenceGateway["executeAction"] = async (_session, request) => {
    commands.push({ action: request.actionType, parameters: structuredClone(request.parameters), phase });
    if (request.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshot() } };
    if (request.actionType === "web.browser.navigate") { opened = false; text = ""; }
    if (request.actionType === "web.dom.click") {
      assert.equal(request.parameters.selector, "#open", "only authored opener may be clicked");
      opened = true;
      mutations.push({ action: request.actionType, phase });
    }
    if (request.actionType === "web.dom.type") {
      assert.equal(opened, true, "typing requires the actual opener effect");
      assert.equal(request.parameters.selector, "#message");
      assert.equal(typeof request.parameters.text, "string", "binding must resolve before client dispatch");
      text = String(request.parameters.text);
      mutations.push({ action: request.actionType, phase });
    }
    return { status: "succeeded", payload: { snapshot: snapshot() } };
  };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => [ACTOR.actorSessionId], executeAction: command
  };
  const host: WebAutomationHostRuntimeGateway = {
    dispatch: async ({ outputId, payload, metadata }) => {
      // The actual native host capture is incomplete; the independent evidence
      // gateway can still publish the page and admit a checked replacement.
      if (options.missingStart && phase === "saved-run" && outputId === "web.dom.capture_snapshot") {
        const { url: _url, ...captured } = snapshot();
        return { ok: true, outputId, domainId: WEB_AUTOMATION_DOMAIN_ID, payload: { result: { snapshot: captured } } };
      }
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
        const right = text === "right";
        if (!right && prepareRepair) { const prepare = prepareRepair; prepareRepair = undefined; await prepare(); }
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
      const draft = loop.evidence.map(record).find((entry) => entry.toolId === "core.flow_draft");
      const value = record(draft?.value);
      assert.ok(Array.isArray(value.steps));
      const steps = value.steps.map(record);
      const faulty = steps.find((step) => step.actionId === TYPE && step.inResult === true && step.written !== true);
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
  const flow = await service.createFlow({ projectId: project.id, flowId: "flow.carried.fixture", name: "Right message" });
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
  await service.saveFlow({ projectId: project.id, flow: { ...graph, nodes: [
    { id: "start", definitionId: "builtin.control.start", parameterValues: {} },
    { id: "open", definitionId: CLICK, parameterValues: { selector: "#open", element: CONTROLS["#open"] }, ...(options.missingDeclaration ? {} : { metadata: { declaredConsequences: [] } }) },
    { id: "type", definitionId: TYPE, parameterValues: { selector: "#message", element: CONTROLS["#message"], text: { $state: { path: "message", fallback: "wrong" } } }, metadata: { declaredConsequences: [] } },
    { id: "end", definitionId: "builtin.control.end", parameterValues: { status: "success" } }
  ], edges: [
    { id: "s.o", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "open", targetPortId: "in" },
    { id: "o.t", sourceNodeId: "open", sourcePortId: "success", targetNodeId: "type", targetPortId: "in" },
    { id: "t.e", sourceNodeId: "type", sourcePortId: "success", targetNodeId: "end", targetPortId: "in" }
  ] } });
  await service.setFlowMapFallback({ projectId: project.id, flowId: flow.flowId, kind: "subflow", targetSubflowId: primary.subflowId });
  if (options.unresolvedSavedBinding) prepareRepair = async () => {
    // Edit actual persisted configuration after the genuinely executed wrong
    // result, never trace evidence or historical arguments. The new full test
    // must resolve this current source binding before any dispatch.
    const current = await service.getFlow(project.id, primary.graphFlowId!);
    await service.saveFlow({ projectId: project.id, flow: { ...current, nodes: current.nodes.map((node) => node.id === "open"
      ? { ...node, parameterValues: { ...node.parameterValues, selector: automationNodeStateBinding("unavailable") } } : node) } });
  };
  await service.saveFlowInstruction(project.id, { schemaVersion: "0.1", instructionId: "instruction.carried", title: "Right message", body: "Open the editor and set its message to right.", scope: { kind: "flow", projectId: project.id, flowId: flow.flowId }, priority: 100, status: "active", requirement: "required", tags: ["generation"], createdAt: 1, updatedAt: 1 });
  return { service, runtime, projectId: project.id, flowId: flow.flowId, commands, mutations, modelCalls,
    judgeCalls: () => judgeCalls, replacementChecked: () => replacementChecked, unresolvedBindingRefused: () => unresolvedBindingRefused, text: () => text };
}

test("ordinary repair freshly tests the untouched carried selector through real web dispatch", { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-carried-service-"));
  let harness: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    harness = await fixture(root);
    const run = await harness.service.runRuntimeSession({ projectId: harness.projectId, flowId: harness.flowId, authorizedDomainIds: [WEB_AUTOMATION_DOMAIN_ID], llmExecution: { ...ACTOR, intent: "build_and_adapt" } });
    const detail = await harness.service.getFlowRunDetail(harness.projectId, run.runId);
    const codes = new Set<string>();
    function diagnosticCodes(value: unknown): void {
      if (Array.isArray(value)) { value.forEach(diagnosticCodes); return; }
      if (!isRecord(value)) return;
      for (const [key, child] of Object.entries(value)) {
        if (["code", "resultCode", "status", "phase", "outcome"].includes(key) && typeof child === "string" && /^[a-z0-9_.-]+$/u.test(child)) codes.add(child);
        else if (typeof child === "object") diagnosticCodes(child);
      }
    }
    diagnosticCodes(detail?.metadata);
    const modelCalls = harness.modelCalls;
    t.diagnostic(JSON.stringify({ status: run.status, codes: [...codes], modelTasks: Object.fromEntries([...new Set(modelCalls.map((call) => call.task))].map((task) => [task, modelCalls.filter((call) => call.task === task).length])), actionTrace: harness.commands.filter((call) => ["web.browser.navigate", "web.dom.click", "web.dom.type"].includes(call.action)).map((call) => ({ action: call.action, phase: call.phase, textWasResolvedWrong: call.parameters.text === "wrong", textWasResolvedRight: call.parameters.text === "right" })) }));
    const savedActions = harness.commands.filter((call) => call.phase === "saved-run" && ["web.dom.click", "web.dom.type"].includes(call.action));
    assert.deepEqual(savedActions.map((call) => call.action), ["web.dom.click", "web.dom.type"], "setup must physically run the saved graph");
    assert.equal(savedActions[1]?.parameters.text, "wrong", "saved $state fallback must resolve in native execution");
    assert.ok(detail?.actionAttempts?.some((attempt) => {
      const refs = attempt.metadata?.stateRefs;
      const before = isRecord(refs) ? refs.beforeAction : undefined;
      const from = isRecord(before) ? before.from : undefined;
      return attempt.nodeId === "open" && isRecord(from) && from.location === LOCATION;
    }), "ordinary host capture must enter actual first opener start token");
    assert.ok(harness.judgeCalls() >= 2, "actual wrong output must be refuted before repair");
    assert.ok(harness.replacementChecked(), "replacement must be admitted by the real write/schema/binding path");
    if (run.status !== "succeeded") assert.ok(codes.has("llm_evidence_loop.full_run_required"), "failure must be the current carried full-test gate, not fixture setup");
    const repaired = harness.commands.filter((call) => call.phase === "repair" && ["web.browser.navigate", "web.dom.click", "web.dom.type"].includes(call.action));
    assert.ok(repaired.some((call) => call.action === "web.browser.navigate"), "whole repaired Flow must reset from its captured start");
    assert.ok(repaired.some((call) => call.action === "web.dom.click" && call.parameters.selector === "#open"), "untouched carried selector must actually replay before acceptance");
    const reset = harness.commands.findIndex((call) => call.phase === "repair" && call.action === "web.browser.navigate");
    const click = harness.commands.findIndex((call, index) => index > reset && call.phase === "repair" && call.action === "web.dom.click" && call.parameters.selector === "#open");
    const type = harness.commands.findIndex((call, index) => index > click && call.phase === "repair" && call.action === "web.dom.type" && call.parameters.text === "right");
    assert.ok(reset >= 0 && click > reset && type > click, "fresh test must reset, replay carried opener, then resolve bound replacement in order");
    const buildJudge = harness.modelCalls.find((call) => call.task === "loop_verification" && call.phase === "repair");
    assert.ok(buildJudge && buildJudge.commandCount > type, "accepting build judge must follow actual whole-test commands");
    assert.equal(run.status, "succeeded", "current C4 full-run refusal must not be accepted as a repair");
    assert.equal(harness.text(), "right");
  } finally {
    await harness?.service.close();
    // Root is a newly created fixture directory, never a persisted user workspace.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("fluxiq-carried-service-"));
    await rm(root, { recursive: true, force: true });
  }
});

for (const missing of ["declaration", "start"] as const) test(`actual saved repair refuses missing ${missing} before full-test actions`, { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-carried-service-"));
  let harness: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    harness = await fixture(root, missing === "declaration" ? { missingDeclaration: true } : { missingStart: true });
    const run = await harness.service.runRuntimeSession({ projectId: harness.projectId, flowId: harness.flowId, authorizedDomainIds: [WEB_AUTOMATION_DOMAIN_ID], llmExecution: { ...ACTOR, intent: "build_and_adapt" } });
    const detail = await harness.service.getFlowRunDetail(harness.projectId, run.runId);
    const saved = harness.commands.filter((call) => call.phase === "saved-run" && ["web.dom.click", "web.dom.type"].includes(call.action));
    const repair = harness.commands.filter((call) => call.phase === "repair" && ["web.browser.navigate", "web.dom.click", "web.dom.type"].includes(call.action));
    t.diagnostic(JSON.stringify({ case: missing, status: run.status, savedActions: saved.map((call) => call.action), repairActions: repair.map((call) => call.action), replacementChecked: harness.replacementChecked(), judgeCalls: harness.judgeCalls() }));
    assert.deepEqual(saved.map((call) => call.action), ["web.dom.click", "web.dom.type"], "negative setup must actually execute the original saved Flow");
    assert.ok(harness.replacementChecked(), "a valid faulty-step replacement must reach the real full-test gate");
    assert.equal(run.status, "failed");
    assert.ok(JSON.stringify(detail?.metadata).includes("llm_evidence_loop.full_run_required"), "actual carried provenance gap must refuse whole-test acceptance");
    assert.deepEqual(repair, [], "no reset or action may run with missing source provenance");
    if (missing === "start") assert.equal(detail?.actionAttempts?.some((attempt) => {
      const refs = attempt.metadata?.stateRefs;
      return isRecord(refs) && isRecord(refs.beforeAction) && isRecord(refs.beforeAction.from);
    }), false, "URL-less actual host captures must not invent a start token");
  } finally {
    await harness?.service.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("fluxiq-carried-service-"));
    await rm(root, { recursive: true, force: true });
  }
});

async function observedOpener(harness: Awaited<ReturnType<typeof fixture>>) {
  const initial = harness.runtime.runsNodes?.initial;
  assert.ok(initial, "public runtime must provide its ordinary initial observation");
  const look = await harness.runtime.executeTool({ projectId: harness.projectId, flowId: harness.flowId, callId: "fixture.look", toolId: "core.run_node", value: initial });
  const evidence = record(look.evidence);
  const page = typeof evidence.page === "string" ? evidence.page : record(evidence.page).page;
  assert.equal(typeof page, "string");
  const handle = String(page).split("\n").flatMap((line) => /^(t[1-9][0-9]*) button(?: |$)/u.exec(line)?.[1] ?? []).at(0);
  assert.ok(handle, "the authored opener must be published by the actual observation");
  return handle;
}

test("actual saved repair refuses an unresolved current binding before mutation", { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-carried-service-"));
  let harness: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    harness = await fixture(root, { unresolvedSavedBinding: true });
    const run = await harness.service.runRuntimeSession({ projectId: harness.projectId, flowId: harness.flowId, authorizedDomainIds: [WEB_AUTOMATION_DOMAIN_ID], llmExecution: { ...ACTOR, intent: "build_and_adapt" } });
    const initial = harness.commands.filter((call) => call.phase === "saved-run" && ["web.dom.click", "web.dom.type"].includes(call.action));
    const repair = harness.commands.filter((call) => call.phase === "repair" && ["web.browser.navigate", "web.dom.click", "web.dom.type"].includes(call.action));
    t.diagnostic(JSON.stringify({ case: "unresolved", status: run.status, initialActions: initial.map((call) => call.action), repairAttempts: repair.map((call) => call.action), repairMutations: harness.mutations.filter((call) => call.phase === "repair").length, replacementChecked: harness.replacementChecked() }));
    assert.deepEqual(initial.map((call) => call.action), ["web.dom.click", "web.dom.type"]);
    assert.ok(harness.replacementChecked());
    assert.equal(run.status, "failed");
    assert.ok(harness.unresolvedBindingRefused(), "actual full-test resolver feedback must refuse the missing current state binding");
    assert.ok(repair.some((call) => call.action === "web.browser.navigate"), "eligible captured start must enter the ordinary full test");
    assert.ok(!repair.some((call) => call.action === "web.dom.click"), "the unresolved saved action must never reach gateway dispatch");
    assert.deepEqual(harness.mutations.filter((call) => call.phase === "repair"), [], "later attempted outputs also cannot mutate an absent editor");
  } finally {
    await harness?.service.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("fluxiq-carried-service-"));
    await rm(root, { recursive: true, force: true });
  }
});

for (const mode of ["permission", "lasting"] as const) test(`actual adapter ${mode} case never performs an unauthorized action`, { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-carried-service-"));
  let harness: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    harness = await fixture(root);
    const handle = await observedOpener(harness);
    let permissionChecks = 0;
    const result = await harness.runtime.executeTool({ projectId: harness.projectId, flowId: harness.flowId, callId: `fixture.${mode}`, toolId: "core.run_node",
      value: { node: CLICK, parameters: { target: { handle } }, replay: mode === "lasting" ? "verify" : "step", from: { location: LOCATION }, consequences: ["create_new"] },
      permission: async () => { permissionChecks++; return mode === "permission"
        ? { permitted: false as const, missing: ["create_new" as const], requestId: "fixture.permission", declined: true as const }
        : { permitted: true as const }; }
    });
    const attemptedActions = harness.commands.filter((call) => ["web.dom.click", "web.dom.type"].includes(call.action));
    t.diagnostic(JSON.stringify({ case: mode, resultCode: result.resultCode, effectApplied: result.effectApplied, permissionChecks, attemptedActions: attemptedActions.length, mutationCount: harness.mutations.length, modelCallCount: harness.modelCalls.length }));
    assert.equal(attemptedActions.length, 0, "real adapter must refuse before gateway mutation dispatch");
    assert.equal(harness.mutations.length, 0);
    assert.equal(result.effectApplied, false);
    assert.equal(harness.modelCalls.length, 0, "direct adapter coverage invokes no scripted or external provider");
    if (mode === "permission") {
      assert.equal(permissionChecks, 1, "actual permission gate must be consulted");
      assert.equal(result.resultCode, "core.replay.failed");
      assert.ok(JSON.stringify(result.evidence).includes("consequences_declined"), "actual refusal must preserve explicit declined permission");
    }
    if (mode === "lasting") {
      assert.equal(permissionChecks, 1, "authorized verification still traverses the ordinary permission port");
      assert.equal(result.resultCode, "core.replay.verified");
      assert.equal(record(result.draft ?? {}).effectApplied, undefined, "verification cannot fabricate performed draft proof");
    }
  } finally {
    await harness?.service.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("fluxiq-carried-service-"));
    await rm(root, { recursive: true, force: true });
  }
});
