import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  bindWebAutomationLlmEvidenceRuntime,
  createWebAutomationLlmEvidenceRuntime,
  sanitizeWebLlmSnapshot,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_EVIDENCE_BYTE_BUDGETS,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmEvidenceGateway
} from "..";

test("captures through the generic action bridge and keeps navigation on the inspected origin", async () => {
  const commands: Array<{ sessionId: string; actionType: string; parameters: unknown; metadata: unknown }> = [];
  let location = "https://example.test/start";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (sessionId, command) => {
      commands.push({ sessionId, ...command });
      if (command.actionType === "web.browser.navigate") location = String(command.parameters.url);
      return command.actionType === "web.dom.capture_snapshot"
        ? { status: "succeeded", payload: { snapshot: snapshot(location) } }
        : { status: "succeeded" };
    },
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  assert.equal(inspected.effectApplied, false);
  assert.equal(inspected.resultCode, "web.inspect.succeeded");
  assert.deepEqual((inspected.evidence as any).location, "https://example.test/start");
  const navigated = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.two", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://example.test/next?private=yes" } });
  assert.equal(navigated.effectApplied, true);
  assert.equal(navigated.resultCode, "web.action.succeeded");
  assert.deepEqual((navigated.evidence as any).location, "https://example.test/next");
  assert.deepEqual(commands.map(command => command.actionType), ["web.dom.capture_snapshot", "web.dom.capture_snapshot", "web.browser.navigate", "web.dom.capture_snapshot"]);
  assert.equal(JSON.stringify(commands).includes("llm-evidence-runtime"), true);
});

test("rejects navigation to the already inspected location without applying an effect", async () => {
  const commands: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      return { status: "succeeded", payload: { snapshot: snapshot("https://example.test/start?private=yes") } };
    },
  });
  const result = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://example.test/start" } });
  assert.deepEqual(result, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress", detail: { reason: "already_at_destination" } }, effectApplied: false, resultCode: "web.action.rejected.no_progress" });
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
});

test("returns content-free recoverable results for policy/input rejection while session and cancellation failures remain fatal", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["one", "two"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: snapshot("https://example.test/") } }),
  });
  await assert.rejects(runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} }), /exactly one/);

  const one = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["one"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: snapshot("https://example.test/") } }),
  });
  assert.deepEqual(await one.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.two", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://outside.test/private-value" } }), { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "cross_origin", detail: { reason: "another_origin" } }, effectApplied: false, resultCode: "web.action.rejected.cross_origin" });
  assert.deepEqual(await one.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.three", toolId: WEB_LLM_INSPECT_TOOL_ID, value: { extra: "private-value" } }), { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "invalid_input", detail: { reason: "unexpected_input_keys", instead: [] } }, effectApplied: false, resultCode: "web.action.rejected.invalid_input" });
  const controller = new AbortController(); controller.abort(new Error("cancelled"));
  await assert.rejects(one.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.four", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {}, signal: controller.signal }), /cancelled/);
});

test("binds from the production host seam and selects the sole trusted web client without requiring stale pairing project metadata", async () => {
  let bound: WebAutomationLlmEvidenceRuntime | undefined;
  const fluxiq = {
    programs: {
      automationStudio: { bindLlmEvidenceRuntime: (runtime: WebAutomationLlmEvidenceRuntime) => { bound = runtime; } },
      clientGateway: { snapshot: () => ({ sessions: [
        { sessionId: "recording", status: "ready", clientType: "extension", activeRecordingId: "recording.one", capabilities: [{ id: "web.actions", actionTypes: ["web.dom.capture_snapshot"] }] },
        { sessionId: "right", status: "ready", clientType: "extension", capabilities: [{ id: "web.actions", actionTypes: ["web.dom.capture_snapshot"] }] },
      ] }) },
      automationStudioClientGateway: { executeAction: async (sessionId: string) => ({ status: "succeeded", payload: { snapshot: snapshot(`https://example.test/${sessionId}`) } }) },
    },
  };
  bindWebAutomationLlmEvidenceRuntime(fluxiq as never);
  assert.deepEqual(bound?.tools.map(tool => tool.toolId), [WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_NAVIGATE_TOOL_ID, WEB_LLM_PRESS_TOOL_ID, WEB_LLM_ENTER_FIELD_TOOL_ID, WEB_LLM_DETECT_STRUCTURE_TOOL_ID]);
  assert.deepEqual(bound?.tools.map(tool => ({ toolId: tool.toolId, effect: tool.effect, repeatPolicy: tool.repeatPolicy, initialObservation: tool.initialObservation })), [
    { toolId: WEB_LLM_INSPECT_TOOL_ID, effect: "observe", repeatPolicy: "after_mutation", initialObservation: { input: {} } },
    { toolId: WEB_LLM_NAVIGATE_TOOL_ID, effect: "mutate", repeatPolicy: undefined, initialObservation: undefined },
    { toolId: WEB_LLM_PRESS_TOOL_ID, effect: "mutate", repeatPolicy: undefined, initialObservation: undefined },
    { toolId: WEB_LLM_ENTER_FIELD_TOOL_ID, effect: "mutate", repeatPolicy: undefined, initialObservation: undefined },
    // Observe-only, and deliberately without a repeat policy: a second target is a different request, and Core refuses an identical one.
    { toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, effect: "observe", repeatPolicy: undefined, initialObservation: undefined },
  ]);
  // A live build authored the right narrowing steps and named each control by a
  // handle it had invented from the Flow-script example, so every one was refused
  // web.handle.malformed. The extraction handle went in correctly, because the
  // detection tool states its shape; inspect now states this one the same way.
  const inspectDescription = bound?.tools.find(tool => tool.toolId === WEB_LLM_INSPECT_TOOL_ID)?.description ?? "";
  assert.match(inspectDescription, /copy that handle exactly into the step's target/u);
  const pressDescription = bound?.tools.find(tool => tool.toolId === WEB_LLM_PRESS_TOOL_ID)?.description ?? "";
  // Named by what pressing is for rather than by the handful of ARIA shapes the
  // tool used to accept. A live slice across three fixtures built nothing that
  // changed a page: the composer behind "New post" was refused as unsafe, so
  // the model never saw the form it had to fill.
  assert.match(pressDescription, /see what exists only after a press/u);
  assert.match(pressDescription, /the form behind a New post, Compose, Reply or Edit button/u);
  assert.match(pressDescription, /tick it in the Flow yourself/u);
  // And it says where the reason for a turned-down call is, because a model
  // that cannot tell one from another makes the same call until the build runs
  // out of steps (`../tool-rejection.ts`).
  assert.match(pressDescription, /detail\.reason/u);
  // And it no longer lists controls it refuses: FluxIQ refuses nothing on its
  // own judgement of what a control looks like, so saying otherwise would be
  // the old rule surviving in the prompt.
  assert.doesNotMatch(pressDescription, /refused|Send, Save|Delete, Confirm/u);
  const validationEvidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    title: "Form",
    interactiveElements: [{ tagName: "button", selector: "#continue", visibleText: "Continue" }],
  });
  const clickAction = { nodeId: "continue", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", visibleText: "Continue" } } };
  // No selector: this packet was built by the test rather than issued by the
  // runtime, so the runtime holds no binding for it and the repair resolves
  // fingerprint-only. The retained-binding path is covered below.
  const resolution = { tagName: "button", visibleText: "Continue" };
  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { handles: { element: "target.1" } }, clickAction), {
    status: "resolved",
    target: { handles: { element: "target.1" }, handleResolution: "named", ...resolution },
    // What the repair names, for a permission request (t059).
    control: { name: "Continue", kind: "button" },
  });
  // A handle nobody minted is refused: nothing is put in its place.
  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { handles: { element: "target.9" } }, clickAction), { status: "absent", reason: "handle_not_issued" });
  const result = await bound!.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  assert.equal(result.effectApplied, false);
  assert.equal(result.resultCode, "web.inspect.succeeded");
  assert.deepEqual((result.evidence as any).location, "https://example.test/right");
  // No silent fallback: a host without the binding seam is a wiring failure, so binding throws.
  assert.throws(() => bindWebAutomationLlmEvidenceRuntime({ programs: { automationStudio: {} } } as never), TypeError);
});

test("captures bounded sanitized post-failure evidence without returning the raw snapshot", async () => {
  const commands: Array<{ actionType: string; parameters: unknown; metadata: any }> = [];
  const privateValue = "PRIVATE_PASSWORD_VALUE";
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command);
      return { status: "succeeded", payload: { snapshot: {
        url: "https://example.test/form?token=private#secret",
        title: "Account form",
        selectedText: "order reference 4471",
        interactiveElements: [
          { tagName: "input", selector: "#password", inputType: "password", value: privateValue, attributes: { autocomplete: "current-password" } },
          ...Array.from({ length: 40 }, (_, index) => ({ tagName: "button", selector: `#safe-${index}`, visibleText: `Safe action ${index}` }))
        ]
      } } };
    },
  });

  const evidence = await runtime.captureSanitizedFailureEvidence({
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.failed",
    failedAction: { attemptId: "attempt.failed", nodeId: "node.click", definitionId: "web.output.dom-click", status: "failed", route: "failed" },
    maxEvidenceBytes: 1_200,
  });

  assert.equal(Buffer.byteLength(JSON.stringify(evidence), "utf8") <= 1_200, true);
  assert.equal(evidence.schemaVersion, "web-llm-evidence.v2");
  assert.equal(evidence.location, "https://example.test/form");
  assert.equal(evidence.truncated, true);
  assert.equal(JSON.stringify(evidence).includes(privateValue), false);
  assert.equal(JSON.stringify(evidence).includes("token"), false);
  assert.equal(evidence.repairCandidates?.action, "known");
  assert.ok((evidence.repairCandidates?.candidates.length ?? 0) <= 8);
  assert.ok(evidence.repairCandidates?.candidates.every(candidate => /^target\.[1-9][0-9]?$/u.test(candidate.target)));
  assert.deepEqual(commands, [{
    actionType: "web.dom.capture_snapshot",
    parameters: {},
    metadata: {
      source: "llm-runtime-failure-evidence",
      domainId: "web-automation",
      projectId: "project.one",
      flowId: "flow.one",
      runId: "run.failed",
      attemptId: "attempt.failed",
      nodeId: "node.click",
      definitionId: "web.output.dom-click",
    },
  }]);
});

test("keeps the whole failure packet within a tight budget after adding candidate envelope bytes", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: {
      url: "https://example.test/form",
      title: "Dense repair form",
      interactiveElements: Array.from({ length: 30 }, (_, index) => ({
        tagName: "button",
        selector: `#action-${index}`,
        visibleText: `Action ${index} ${"x".repeat(80)}`,
        attributes: { type: "button" },
      })),
    } } }),
  });
  const maxEvidenceBytes = 900;
  const evidence = await runtime.captureSanitizedFailureEvidence({
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.failed",
    failedAction: { attemptId: "attempt.failed", nodeId: "node.click", definitionId: "web.output.dom-click", status: "failed" },
    maxEvidenceBytes,
  });

  assert.ok(evidence.repairCandidates);
  assert.equal(Buffer.byteLength(JSON.stringify(evidence), "utf8") <= maxEvidenceBytes, true);
});

test("a repair on a packet this runtime issued gets its selector hint back, without the packet ever carrying one", async () => {
  // The packet an LLM reads carries no selector. The runtime that issued it
  // still holds the binding, so when Core hands that same packet back to be
  // validated, the resolved repair can carry the selector as a hint beside the
  // fingerprint. The hint travels domain-to-domain and is never shown to a model.
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: {
      url: "https://example.test/form",
      interactiveElements: [
        { tagName: "button", selector: "#place-order", visibleText: "Place order" },
        { tagName: "input", selector: "#coupon", name: "Coupon" },
      ],
    } } }),
  });

  const evidence = await runtime.captureSanitizedFailureEvidence({
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.failed",
    failedAction: { attemptId: "attempt.failed", nodeId: "node.click", definitionId: "web.output.dom-click", status: "failed", route: "failed" },
  });
  assert.doesNotMatch(JSON.stringify(evidence), /selector|#place-order|#coupon/u);

  const clickAction = { nodeId: "node.click", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", visibleText: "Place order" } } };
  assert.deepEqual(runtime.validateTargetOverrideEvidence(evidence as unknown as JsonObject, { handles: { element: "target.1" } }, clickAction), {
    status: "resolved",
    target: { handles: { element: "target.1" }, handleResolution: "named", tagName: "button", visibleText: "Place order", selector: "#place-order" },
    control: { name: "Place order", kind: "button" },
  });

  // A packet this runtime never issued has no binding, so the repair is
  // resolved fingerprint-only rather than refused or guessed at.
  const foreign = { ...evidence, location: "https://example.test/other" };
  assert.deepEqual(runtime.validateTargetOverrideEvidence(foreign as unknown as JsonObject, { handles: { element: "target.1" } }, clickAction), {
    status: "resolved",
    target: { handles: { element: "target.1" }, handleResolution: "named", tagName: "button", visibleText: "Place order" },
    control: { name: "Place order", kind: "button" },
  });
});

// Core tells the model to fill one handle per repairable parameter the failure
// evidence offers. Before the packet named one, a live repair of a recorded
// click was refused for naming some other key (`run-mu4tfxld-e78debce`).
test("post-failure evidence names the parameter a repair fills, and nothing for an action that offers none", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: {
      url: "https://example.test/form",
      interactiveElements: [{ tagName: "button", selector: "#place-order", visibleText: "Place order" }],
    } } }),
  });
  const capture = (definitionId: string) => runtime.captureSanitizedFailureEvidence({
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.failed",
    failedAction: { attemptId: "attempt.failed", nodeId: "node.failed", definitionId, status: "failed" },
  });
  const created = await capture("web.output.dom-click");
  assert.deepEqual(Object.keys(created.repairParameters ?? {}), ["element"]);
  assert.match(created.repairParameters?.element ?? "", /target handle/u);
  // A recorded action: Core's capture request does not say which output it
  // dispatches, so the one parameter every repairable action has is offered.
  const recorded = await capture("builtin.policy.action");
  assert.deepEqual(recorded.repairParameters, created.repairParameters);
  assert.equal(recorded.repairCandidates?.action, "recorded_action_unknown");
  assert.deepEqual(recorded.repairCandidates?.candidates, [{ target: "target.1", match: "action_unknown", roles: ["clickable", "keyable", "observable"] }]);
  // An action this domain knows offers nothing says so, rather than inviting a
  // repair the check will refuse.
  assert.deepEqual((await capture("web.output.dom-extract_list")).repairParameters, {});
  assert.deepEqual((await capture("web.output.browser-navigate")).repairParameters, {});
  assert.equal((await capture("web.output.browser-navigate")).repairCandidates?.status, "action_not_repairable");
  // Naming the parameters is not naming the control.
  assert.equal(recorded.failedTargetUnknown, true);
  assert.doesNotMatch(JSON.stringify(recorded), /#place-order|selector/u);
});

test("a packet this domain did not issue is refused as unrecognized, before the target is read", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => [], executeAction: async () => ({ status: "failed" }) });
  // The control this row's own packet describes: what the recording addressed
  // has to be the control the last line expects the repair to resolve to, or
  // the refusal under test is not the one the row is about.
  const clickAction = { nodeId: "node.click", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", visibleText: "Go" } } };
  const issued = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] });
  const unrecognized = { status: "absent", reason: "evidence_unrecognized" };
  const issuedPacket = issued as unknown as JsonObject;
  const packets: JsonObject[] = [
    { ...issuedPacket, schemaVersion: "web-llm-evidence.v1" },
    { ...issuedPacket, elements: "target.1" },
    { schemaVersion: "web-llm-evidence.v2" },
    {},
  ];
  for (const packet of packets) {
    assert.deepEqual(runtime.validateTargetOverrideEvidence(packet, { handles: { element: "target.1" } }, clickAction), unrecognized, JSON.stringify(packet));
  }
  // The issued packet itself is recognized and resolved.
  assert.equal(runtime.validateTargetOverrideEvidence(issuedPacket, { handles: { element: "target.1" } }, clickAction).status, "resolved");
});

test("bounds post-failure evidence to Core's gate when the host names no budget", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => ({ status: "succeeded", payload: { snapshot: {
      url: "https://example.test/form",
      title: "Account form",
      interactiveElements: Array.from({ length: 60 }, (_, index) => ({ tagName: "button", selector: `#safe-${index}`, visibleText: `Safe action ${index} ${"x".repeat(80)}` })),
    } } }),
  });
  const failedAction = { attemptId: "attempt.failed", nodeId: "node.click", definitionId: "web.output.dom-click", status: "failed" };
  const defaulted = await runtime.captureSanitizedFailureEvidence({ projectId: "project.one", flowId: "flow.one", runId: "run.failed", failedAction });
  assert.equal(Buffer.byteLength(JSON.stringify(defaulted), "utf8") <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true);
  const overreached = await runtime.captureSanitizedFailureEvidence({ projectId: "project.one", flowId: "flow.one", runId: "run.failed", failedAction, maxEvidenceBytes: 11_000 });
  assert.equal(Buffer.byteLength(JSON.stringify(overreached), "utf8") <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true);
});

test("presses any observed control, refuses only a handle it never showed, and never exposes form execution tools", async () => {
  const actionTypes: string[] = [];
  const actionParameters: unknown[] = [];
  let detailsExpanded = false;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      actionTypes.push(command.actionType);
      if (command.actionType !== "web.dom.capture_snapshot") {
        actionParameters.push(command.parameters);
        if (command.actionType === "web.dom.click") detailsExpanded = true;
      }
      return command.actionType === "web.dom.capture_snapshot"
        ? { status: "succeeded", payload: { snapshot: {
          url: "https://example.test/form", title: "Form", interactiveElements: [
            { tagName: "button", selector: "#details", visibleText: "Show details", attributes: { type: "button", "aria-expanded": detailsExpanded ? "true" : "false", "aria-controls": "details-panel" } },
            { tagName: "button", selector: "#submit", visibleText: "Submit purchase", attributes: { type: "submit" } },
            { tagName: "button", selector: "#action", visibleText: "Run action", attributes: { type: "button" } },
            { tagName: "input", selector: "#name", inputType: "text", name: "Name" },
            { tagName: "select", selector: "#plan", name: "Plan" },
          ],
        } } }
        : { status: "succeeded" };
    },
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const base = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 } as const;
  const applied = await runtime.executeTool({ ...base, callId: "call.reveal", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.1", consequences: [] } });
  assert.deepEqual({ kind: applied.kind, effectApplied: applied.effectApplied, resultCode: applied.resultCode }, { kind: "llm_evidence_tool_execution", effectApplied: true, resultCode: "web.action.succeeded" });
  assert.deepEqual(actionTypes, [
    "web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot",
  ]);
  assert.deepEqual(actionParameters, [{ selector: "#details" }]);
  const submit = await runtime.executeTool({ ...base, callId: "call.submit", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.2", consequences: [] } });
  const genericAction = await runtime.executeTool({ ...base, callId: "call.action", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.3", consequences: [] } });
  const missing = await runtime.executeTool({ ...base, callId: "call.missing", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.40", consequences: [] } });
  // A submit and a generic action are pressed like anything else. This fake page
  // does not change under them, so each reports no progress -- but each was
  // pressed, which the old rule refused on its own judgement.
  assert.equal(submit.resultCode, "web.action.rejected.no_progress");
  assert.equal(genericAction.resultCode, "web.action.rejected.no_progress");
  assert.deepEqual(actionParameters, [{ selector: "#details" }, { selector: "#submit" }, { selector: "#action" }]);
  // The one refusal left is a handle the model was never shown.
  assert.deepEqual(missing, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unobserved", detail: { reason: "handle_not_in_packet", target: "target.40" } }, effectApplied: false, resultCode: "web.action.rejected.target_unobserved" });
  assert.doesNotMatch(JSON.stringify([submit, genericAction, missing]), /submit|run action|missing-private-value/u);
});

test("keeps an opaque press target bound to the returned element when fresh snapshot ranking changes", async () => {
  let capture = 0;
  let expanded = false;
  const parameters: unknown[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        parameters.push(command.parameters);
        expanded = true;
        return { status: "succeeded" };
      }
      capture += 1;
      const interactiveElements = capture === 1
        ? [
          { tagName: "button", selector: "#details", attributes: { type: "button", "aria-expanded": expanded ? "true" : "false" }, visibleText: "Details" },
          { tagName: "input", selector: "#name", inputType: "text", name: "Name" },
        ]
        : [
          { tagName: "input", selector: "#name", inputType: "text", name: "Name" },
          { tagName: "button", selector: "#details", attributes: { type: "button", "aria-expanded": expanded ? "true" : "false" }, visibleText: "Details" },
        ];
      return { status: "succeeded", payload: { snapshot: { url: "https://example.test/form", title: "Form", interactiveElements } } };
    },
  });
  const base = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 } as const;
  const inspected = await runtime.executeTool({ ...base, callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  assert.deepEqual((inspected.evidence as any).elements[0], { target: "target.1", tag: "button", text: "Details", controlType: "button", revealKind: "disclosure", expanded: false });
  const revealed = await runtime.executeTool({ ...base, callId: "call.reveal", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.1", consequences: [] } });
  assert.equal(revealed.effectApplied, true);
  assert.deepEqual(parameters, [{ selector: "#details" }]);
});

test("reports a successful press with unchanged parsed evidence as no progress", async () => {
  const actionTypes: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      actionTypes.push(command.actionType);
      return command.actionType === "web.dom.capture_snapshot"
        ? { status: "succeeded", payload: { snapshot: { url: "https://example.test/form", interactiveElements: [{ tagName: "button", selector: "#details", visibleText: "Details", attributes: { type: "button", "aria-expanded": "false" } }] } } }
        : { status: "succeeded" };
    },
  });
  const result = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.reveal", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.1", consequences: [] } });
  assert.deepEqual(result, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress", detail: { reason: "page_unchanged_after_action" } }, effectApplied: false, resultCode: "web.action.rejected.no_progress" });
  assert.deepEqual(actionTypes, ["web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot"]);
});

test("refuses an action the page did not take, and keeps disconnect and malformed snapshot failures fatal", async () => {
  const base = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 } as const;
  const failedAction = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: "https://example.test/", interactiveElements: [{ tagName: "button", selector: "#safe", attributes: { type: "button", "aria-expanded": "false" } }] } } }
      : { status: "failed", error: "private gateway detail" },
  });
  // A failure that names no reason is `action_failed`, with the page as it now
  // is, and never the gateway's own words (`page-refusal.test.ts` has the rest).
  const refused = await failedAction.executeTool({ ...base, callId: "call.action", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: "target.1", consequences: [] } });
  assert.equal(refused.resultCode, "web.action.rejected.action_failed");
  assert.equal(refused.effectApplied, false);
  const refusal = refused.evidence as { schemaVersion: string; ok: boolean; code: string };
  assert.deepEqual([refusal.schemaVersion, refusal.ok, refusal.code], ["web-llm-tool-result.v1", false, "action_failed"]);
  assert.equal((refused.evidence as any).page.location, "https://example.test/");
  assert.equal(JSON.stringify(refused).includes("private gateway detail"), false);
  const disconnected = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => [], executeAction: async () => ({ status: "failed" }) });
  await assert.rejects(disconnected.executeTool({ ...base, callId: "call.disconnect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} }), /exactly one/u);
  const malformed = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session.one"], executeAction: async () => ({ status: "succeeded", payload: {} }) });
  await assert.rejects(malformed.executeTool({ ...base, callId: "call.malformed", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} }), /snapshot/u);
});

function snapshot(url: string): JsonObject {
  return { url, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] };
}
