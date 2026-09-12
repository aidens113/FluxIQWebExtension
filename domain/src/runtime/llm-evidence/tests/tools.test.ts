import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  bindWebAutomationLlmEvidenceRuntime,
  createWebAutomationLlmEvidenceRuntime,
  sanitizeWebLlmSnapshot,
  WEB_LLM_EVIDENCE_BYTE_BUDGETS,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_REVEAL_TOOL_ID,
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
  assert.deepEqual(result, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress" }, effectApplied: false, resultCode: "web.action.rejected.no_progress" });
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
  assert.deepEqual(await one.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.two", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://outside.test/private-value" } }), { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "cross_origin" }, effectApplied: false, resultCode: "web.action.rejected.cross_origin" });
  assert.deepEqual(await one.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.three", toolId: WEB_LLM_INSPECT_TOOL_ID, value: { extra: "private-value" } }), { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "invalid_input" }, effectApplied: false, resultCode: "web.action.rejected.invalid_input" });
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
  assert.deepEqual(bound?.tools.map(tool => tool.toolId), [WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_NAVIGATE_TOOL_ID, WEB_LLM_REVEAL_TOOL_ID]);
  assert.deepEqual(bound?.tools.map(tool => ({ toolId: tool.toolId, effect: tool.effect, repeatPolicy: tool.repeatPolicy, initialObservation: tool.initialObservation })), [
    { toolId: WEB_LLM_INSPECT_TOOL_ID, effect: "observe", repeatPolicy: "after_mutation", initialObservation: { input: {} } },
    { toolId: WEB_LLM_NAVIGATE_TOOL_ID, effect: "mutate", repeatPolicy: undefined, initialObservation: undefined },
    { toolId: WEB_LLM_REVEAL_TOOL_ID, effect: "mutate", repeatPolicy: undefined, initialObservation: undefined },
  ]);
  const revealDescription = bound?.tools.find(tool => tool.toolId === WEB_LLM_REVEAL_TOOL_ID)?.description ?? "";
  assert.match(revealDescription, /otherwise unavailable page structure/u);
  assert.match(revealDescription, /Form entry, option selection, submission/u);
  const validationEvidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    title: "Form",
    interactiveElements: [{ tagName: "button", selector: "#continue", visibleText: "Continue" }],
  });
  const clickAction = { nodeId: "continue", definitionId: "web.output.dom-click" };
  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { selector: "#continue" }, clickAction), { status: "matched" });
  assert.deepEqual(bound?.validateTargetOverrideEvidence(validationEvidence, { selector: "#missing" }, clickAction), { status: "resolved", target: { selector: "#continue" } });
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
  assert.equal(evidence.schemaVersion, "web-llm-evidence.v1");
  assert.equal(evidence.location, "https://example.test/form");
  assert.equal(evidence.truncated, true);
  assert.equal(JSON.stringify(evidence).includes(privateValue), false);
  assert.equal(JSON.stringify(evidence).includes("token"), false);
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

test("executes only observed semantic reveal interactions and never exposes form execution tools", async () => {
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
  const applied = await runtime.executeTool({ ...base, callId: "call.reveal", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.1" } });
  assert.deepEqual({ kind: applied.kind, effectApplied: applied.effectApplied, resultCode: applied.resultCode }, { kind: "llm_evidence_tool_execution", effectApplied: true, resultCode: "web.action.succeeded" });
  assert.deepEqual(actionTypes, [
    "web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot",
  ]);
  assert.deepEqual(actionParameters, [{ selector: "#details" }]);
  const submit = await runtime.executeTool({ ...base, callId: "call.submit", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.2" } });
  const genericAction = await runtime.executeTool({ ...base, callId: "call.action", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.3" } });
  const missing = await runtime.executeTool({ ...base, callId: "call.missing", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.40" } });
  assert.deepEqual(submit, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unsafe" }, effectApplied: false, resultCode: "web.action.rejected.target_unsafe" });
  assert.deepEqual(genericAction, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unsafe" }, effectApplied: false, resultCode: "web.action.rejected.target_unsafe" });
  assert.deepEqual(missing, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unobserved" }, effectApplied: false, resultCode: "web.action.rejected.target_unobserved" });
  assert.doesNotMatch(JSON.stringify([submit, genericAction, missing]), /submit|run action|missing-private-value/u);
});

test("keeps an opaque reveal target bound to the returned element when fresh snapshot ranking changes", async () => {
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
  assert.deepEqual((inspected.evidence as any).elements[0], { target: "target.1", tag: "button", selector: "#details", text: "Details", controlType: "button", revealKind: "disclosure", expanded: false });
  const revealed = await runtime.executeTool({ ...base, callId: "call.reveal", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.1" } });
  assert.equal(revealed.effectApplied, true);
  assert.deepEqual(parameters, [{ selector: "#details" }]);
});

test("reports a successful reveal click with unchanged parsed evidence as no progress", async () => {
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
  const result = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.reveal", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.1" } });
  assert.deepEqual(result, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress" }, effectApplied: false, resultCode: "web.action.rejected.no_progress" });
  assert.deepEqual(actionTypes, ["web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot"]);
});

test("keeps gateway action, disconnect, and malformed snapshot failures fatal", async () => {
  const base = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 } as const;
  const failedAction = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: "https://example.test/", interactiveElements: [{ tagName: "button", selector: "#safe", attributes: { type: "button", "aria-expanded": "false" } }] } } }
      : { status: "failed", error: "private gateway detail" },
  });
  await assert.rejects(failedAction.executeTool({ ...base, callId: "call.action", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.1" } }), /interaction failed/u);
  const disconnected = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => [], executeAction: async () => ({ status: "failed" }) });
  await assert.rejects(disconnected.executeTool({ ...base, callId: "call.disconnect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} }), /exactly one/u);
  const malformed = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session.one"], executeAction: async () => ({ status: "succeeded", payload: {} }) });
  await assert.rejects(malformed.executeTool({ ...base, callId: "call.malformed", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} }), /snapshot/u);
});

function snapshot(url: string): JsonObject {
  return { url, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] };
}
