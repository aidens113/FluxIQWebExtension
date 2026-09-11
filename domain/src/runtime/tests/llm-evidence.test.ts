import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { bindWebAutomationLlmEvidenceRuntime, createWebAutomationLlmEvidenceRuntime, sanitizeWebLlmSnapshot, validateWebRuntimeTargetOverrideEvidence, WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_NAVIGATE_TOOL_ID, WEB_LLM_REVEAL_TOOL_ID, type WebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "..";

test("sanitizes extension snapshots without values, sensitive controls, or URL secrets", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form?token=private#secret",
    title: "Example",
    selectedText: "private selection",
    interactiveElements: [
      { tagName: "input", selector: "#name", name: "Name", inputType: "text", value: "Ada", attributes: { type: "text" } },
      { tagName: "input", selector: "#password", name: "Password", inputType: "password", value: "private" },
      { tagName: "a", selector: "#next", visibleText: "Next", href: "/next?ticket=private" },
      { tagName: "a", selector: "#away", visibleText: "Away", href: "https://outside.test/" },
    ],
  });
  assert.deepEqual(evidence, {
    schemaVersion: "web-llm-evidence.v1", trust: "untrusted-page-evidence", location: "https://example.test/form", title: "Example", truncated: false,
    elements: [
      { target: "target.1", tag: "input", selector: "#name", name: "Name" },
      { target: "target.2", tag: "a", selector: "#next", text: "Next", href: "https://example.test/next" },
      { target: "target.3", tag: "a", selector: "#away", text: "Away" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(evidence), /Ada|private|token|ticket|selectedText/u);
});

test("retains compact semantic labels, types, select options, and result text needed for instruction-only generation", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/scenarios/instruction-only-form/",
    title: "Instruction-only automation",
    interactiveElements: [
      { tagName: "input", selector: "[data-testid=instruction-name]", name: "Name", inputType: "text", hasValue: true, value: "Ada", attributes: { autocomplete: "off" } },
      { tagName: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", value: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
      { tagName: "button", selector: "[data-testid=instruction-submit]", name: "Submit", text: "Submit", attributes: { type: "submit" } },
      { tagName: "p", selector: "[data-testid=result]", text: "Not submitted", attributes: { "aria-live": "polite" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", selector: "[data-testid=instruction-name]", name: "Name", hasValue: true },
    { target: "target.2", tag: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
    { target: "target.3", tag: "button", selector: "[data-testid=instruction-submit]", name: "Submit", controlType: "submit" },
    { target: "target.4", tag: "p", selector: "[data-testid=result]", text: "Not submitted" },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /Ada/u);
});

test("validates target overrides only when one exact selector has semantics compatible with the failed action", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#name", name: "Name" },
      { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
      { tagName: "button", selector: "#unique", name: "Unique" },
      { tagName: "button", selector: ".duplicate", name: "First" },
      { tagName: "button", selector: ".duplicate", name: "Second" },
    ],
  });
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#name" }, typeAction), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#missing" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: ".duplicate" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "ambiguous" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, { nodeId: "plan", definitionId: "web.output.dom-select" }), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "matched" });

  const noTypeableTarget = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeableTarget, { selector: "#missing" }, typeAction), { status: "absent" });
  const multipleTypeableTargets = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(multipleTypeableTargets, { selector: "#missing" }, typeAction), { status: "ambiguous" });
});

test("exposes only bounded non-secret completion state", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#notes", hasValue: false, value: "private notes" },
      { tagName: "input", selector: "#hidden", inputType: "hidden", hasValue: true, value: "private hidden" },
      { tagName: "select", selector: "#plan", selectedValue: "unlisted", options: [{ value: "team", label: "Team" }] },
      { tagName: "select", selector: "#secret", selectedValue: "team", options: [{ value: "team", label: "Team" }], attributes: { "data-sensitive": "true" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "textarea", selector: "#notes", hasValue: false },
    { target: "target.2", tag: "input", selector: "#hidden", inputType: "hidden" },
    { target: "target.3", tag: "select", selector: "#plan", options: [{ value: "team", label: "Team" }] },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /private|unlisted/u);
});

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

test("honors Core's requested per-result evidence ceiling", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/large",
    title: "Large fixture",
    interactiveElements: Array.from({ length: 40 }, (_, index) => ({
      tagName: "button",
      selector: `[data-index=\"${index}\"]`,
      visibleText: `Item ${index} ${"x".repeat(300)}`,
    })),
  }, { maxEvidenceBytes: 8_000 });
  assert.equal(new TextEncoder().encode(JSON.stringify(evidence)).byteLength <= 8_000, true);
  assert.equal(evidence.truncated, true);
  assert.equal(evidence.elements.length < 40, true);
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
        selectedText: "PRIVATE_SELECTED_TEXT",
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
  assert.equal(JSON.stringify(evidence).includes("PRIVATE_SELECTED_TEXT"), false);
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

test("deduplicates representative 50-element semantic evidence without dropping executable selectors", () => {
  const interactiveElements = Array.from({ length: 50 }, (_, index) => ({
    tagName: "button",
    selector: `[data-component="global-navigation-item-${index}"][data-instance="${"x".repeat(72)}"]`,
    name: `Open workspace section ${index}`,
    visibleText: `Open workspace section ${index}`,
    attributes: { type: "button" },
  }));
  const evidence = sanitizeWebLlmSnapshot({ url: "https://example.test/workspace", title: "Workspace", interactiveElements }, { maxEvidenceBytes: 12_000 });
  const compactBytes = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  const legacyBytes = new TextEncoder().encode(JSON.stringify({ ...evidence, elements: evidence.elements.map((element) => ({ ...element, text: element.name })) })).byteLength;
  assert.equal(evidence.elements.length, 40);
  assert.equal(evidence.truncated, true);
  assert.equal(compactBytes <= 10_500, true, `compact evidence used ${compactBytes} bytes`);
  assert.equal(compactBytes < legacyBytes, true, `compact ${compactBytes} bytes versus duplicate-semantic ${legacyBytes} bytes`);
  assert.match(JSON.stringify(evidence), /selector/u);
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

function snapshot(url: string): JsonObject { return { url, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] }; }
