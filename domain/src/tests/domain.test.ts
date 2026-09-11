import assert from "node:assert/strict";
import { AutomationStudioService, automationStudioFlowBootstrapCatalogByteBudget, buildAutomationStudioFlowBootstrapContext, buildAutomationStudioLlmEvidenceLoopDecisionSchema, estimateAutomationStudioDeepSeekInputTokens, runAutomationStudioLlmHarness } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry, validateAutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "..";
import { createWebAutomationFluxIQ } from "..";
import { webAutomationRecordingDomain } from "../recording/domain";
import { createWebAutomationRecordingEvent } from "../client";
import { WEB_AUTOMATION_INPUT_IDS, webAutomationInputIdForRecordedEvent, actionInputDefinitions } from "../io/input-model";
import { webAutomationClientCapabilities } from "../actions/capabilities";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { listWebAutomationOutputNodeDefinitions, webAutomationOutputPayload, outputTargetFromPayload } from "../output-nodes";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../output-nodes";
import { validateWebAutomationRuntime } from "../runtime";
import { mapWebRecordingObservation } from "../web-panel-host";
import { createWebAutomationLlmEvidenceRuntime } from "../runtime";

const service = new AutomationStudioService({ seedFixture: false });
service.registerRecordingDomain(webAutomationRecordingDomain);

const validation = service.validateRecordingDomainEvent({
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  eventType: WEB_AUTOMATION_EVENTS.elementClicked,
  payload: { url: "https://example.test", title: "Example", sequence: 1 }
});
assert.equal(validation.ok, true);

const recordingStartNavigation = mapWebRecordingObservation({
  observationId: "observation.start",
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  type: "domain_event",
  timestamp: 1,
  payload: { eventType: WEB_AUTOMATION_EVENTS.pageNavigated, payload: { url: "https://example.test" } },
  metadata: { reason: "recording_start", transition: "typed" }
});
assert.equal(recordingStartNavigation, null);
const deliberateNavigation = mapWebRecordingObservation({
  observationId: "observation.navigate",
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  type: "domain_event",
  timestamp: 2,
  payload: { eventType: WEB_AUTOMATION_EVENTS.pageNavigated, payload: { url: "https://example.test/next" } },
  metadata: { transition: "typed" }
});
assert.equal(deliberateNavigation?.outputId, "web.browser.navigate");

// The recording -> Subflow mapper and the live input path resolve through one
// mapper: for every recorded row they agree on the output and its parameters.
const recordedRows: Array<{ kind: string; element?: Record<string, string>; inputValue?: string; key?: string; scroll?: { x: number; y: number }; metadata?: Record<string, string> }> = [
  { kind: "content.ready" },
  { kind: "browser.tab" },
  { kind: "browser.navigation", metadata: { transition: "typed" } },
  { kind: "browser.navigation", metadata: { transition: "link" } },
  { kind: "dom.click", element: { selector: "#save", tagName: "button", text: "Save", xpath: "/html/body/button" } },
  { kind: "dom.input", element: { selector: "input[name=q]", tagName: "input" }, inputValue: "ada" },
  { kind: "dom.input", element: { selector: "input[name=q]", tagName: "input" }, inputValue: "" },
  { kind: "dom.change", element: { selector: "select#plan", tagName: "select" }, inputValue: "team" },
  { kind: "dom.change", element: { selector: "input#terms", tagName: "input", inputType: "checkbox" }, inputValue: "on" },
  { kind: "dom.submit", element: { selector: "form", tagName: "form" } },
  { kind: "dom.keydown", element: { selector: "input[name=q]", tagName: "input" }, key: "Enter" },
  { kind: "dom.scroll", scroll: { x: 0, y: 640 } },
  { kind: "dom.wheel", scroll: { x: 0, y: 640 } },
  { kind: "dom.mutation" },
  { kind: "dom.focus", element: { selector: "input[name=q]", tagName: "input" } },
  { kind: "dom.blur", element: { selector: "input[name=q]", tagName: "input" } },
  { kind: "dom.snapshot" },
  { kind: "action.result" },
  { kind: "client.error" }
];
for (const [index, row] of recordedRows.entries()) {
  const recordedPayload = {
    kind: row.kind,
    url: "https://example.test/form",
    title: "Form",
    sequence: index + 1,
    ...(row.element ? { element: row.element } : {}),
    ...(row.inputValue !== undefined ? { inputValue: row.inputValue } : {}),
    ...(row.key ? { key: row.key } : {}),
    ...(row.scroll ? { scroll: row.scroll } : {}),
    ...(row.metadata ? { metadata: row.metadata } : {})
  };
  const liveInputId = webAutomationInputIdForRecordedEvent(recordedPayload);
  const liveOutputId = actionInputDefinitions.find(([id]) => id === liveInputId)?.[2];
  const wire = createWebAutomationRecordingEvent({ ...recordedPayload, eventTimestampMs: 100 + index });
  const wirePayload = wire.payload ?? {};
  const proposed = mapWebRecordingObservation({
    observationId: `observation.row.${index + 1}`,
    recordingId: "recording.test",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    type: "domain_event",
    timestamp: 100 + index,
    payload: { eventType: wire.eventType, payload: wirePayload },
    metadata: wire.metadata ?? {}
  });
  const label = `${row.kind} (row entry ${index + 1})`;
  assert.equal(proposed?.outputId, liveOutputId, `${label}: proposal and live output agree`);
  assert.deepEqual(proposed?.sourceInputIds, liveInputId === undefined ? undefined : [liveInputId], `${label}: proposal cites the live input`);
  if (liveOutputId !== undefined) {
    assert.deepEqual(proposed?.parameters, webAutomationOutputPayload(liveOutputId, wirePayload), `${label}: proposal parameters equal the live output binding payload`);
  }
}

// The proposal path keeps the element fingerprint and visual target (audit-recording Finding 7).
const clickWire = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 40,
  url: "https://example.test/form",
  title: "Form",
  eventTimestampMs: 400,
  element: { selector: "button.save", tagName: "button", text: "Save", xpath: "/html/body/button", id: "save", bounds: { x: 10, y: 20, width: 90, height: 30 } }
});
const proposedClick = mapWebRecordingObservation({
  observationId: "observation.click",
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  type: "observation",
  timestamp: 400,
  payload: { observationType: clickWire.eventType, payload: clickWire.payload ?? {} },
  metadata: clickWire.metadata ?? {}
});
assert.equal(proposedClick?.outputId, "web.dom.click");
assert.equal(proposedClick?.label, "Click");
assert.deepEqual(proposedClick?.expectedConfirmation, { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked, timeoutMs: 5_000 });
assert.equal(proposedClick?.parameters?.selector, "button.save");
assert.equal((proposedClick?.parameters?.element as { xpath?: string } | undefined)?.xpath, "/html/body/button");
assert.equal((proposedClick?.parameters?.element as { id?: string } | undefined)?.id, "save");
assert.notEqual(clickWire.payload?.visualTarget, undefined);
assert.deepEqual(proposedClick?.parameters?.visualTarget, clickWire.payload?.visualTarget);
assert.equal((outputTargetFromPayload(proposedClick?.parameters ?? {})?.element as { xpath?: string } | undefined)?.xpath, "/html/body/button");

// A recorded scroll proposes a scroll node; the never-emitted wheel event type proposes nothing.
const scrollObservation = (eventType: string) => mapWebRecordingObservation({
  observationId: `observation.${eventType}`,
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  type: "domain_event",
  timestamp: 500,
  payload: { eventType, payload: { scroll: { x: 0, y: 640 } } },
  metadata: {}
});
assert.deepEqual(scrollObservation(WEB_AUTOMATION_EVENTS.scrollChanged)?.parameters, { x: 0, y: 640 });
assert.equal(scrollObservation(WEB_AUTOMATION_EVENTS.mouseWheel), null);

const event = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 1,
  url: "https://example.test",
  title: "Example",
  eventTimestampMs: 10,
  element: { selector: "button", tagName: "button", text: "Submit", bounds: { x: 10, y: 20, width: 90, height: 30 } }
});
assert.equal(event.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(event.eventType, WEB_AUTOMATION_EVENTS.elementClicked);
assert.equal((event.payload?.visualTarget as { statePath?: string } | undefined)?.statePath, "web.elements.button");
assert.equal((event.metadata?.visualTarget as { layerId?: string } | undefined)?.layerId, "element.button");

const clickPayload = webAutomationOutputPayload("web.dom.click", {
  element: { selector: "button.save", tagName: "button", text: "Save" },
  visualTarget: { namespace: "web", statePath: "web.elements.button.save", selector: "button.save" }
});
assert.equal(clickPayload.selector, "button.save");
assert.equal((clickPayload.element as { selector?: string }).selector, "button.save");
assert.equal((clickPayload.visualTarget as { statePath?: string }).statePath, "web.elements.button.save");
assert.equal((outputTargetFromPayload(clickPayload)?.visualTarget as { statePath?: string } | undefined)?.statePath, "web.elements.button.save");
assert.equal(outputTargetFromPayload({ ...clickPayload, target: { selector: "button.save-adapted" } })?.selector, "button.save-adapted");
assert.equal(outputTargetFromPayload({
  selector: "button.save-stale",
  target: { kind: "element", fingerprint: { selector: "button.save-adapted" }, source: "runtime" }
})?.selector, "button.save-adapted");
assert.equal(outputTargetFromPayload({
  selector: "button.save-stale",
  target: {
    kind: "element",
    fingerprint: { selector: "button.save-fallback" },
    candidates: [
      { candidateId: "candidate.old", selector: "button.save-old" },
      { candidateId: "candidate.current", selector: "button.save-current" }
    ],
    selectedCandidate: { candidateId: "candidate.current", confidence: 0.98 }
  }
})?.selector, "button.save-current");

const outputNodeDefinitions = listWebAutomationOutputNodeDefinitions();
assert.equal(outputNodeDefinitions.length, 18);
const clickNodeDefinition = outputNodeDefinitions.find((definition) => definition.outputAction?.fixedOutputId === "web.dom.click");
assert.equal(clickNodeDefinition?.requiredRuntimeCapabilities?.includes("web.actions"), true);
assert.equal(validateAutomationStudioNodeDefinition(clickNodeDefinition!).ok, true);
assert.equal(outputNodeDefinitions.every((definition) => validateAutomationStudioNodeDefinition(definition).ok), true);
const bootstrapInstruction = "Using the connected browser page, enter Ada in Name, choose Team for Plan, submit the form, and verify the result says Submitted: Ada / team.";
const bootstrapResolution = {
  scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID },
  runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS
};
const bootstrapRegistry = new AutomationStudioNodeRegistry();
for (const definition of outputNodeDefinitions) bootstrapRegistry.register(definition);
assert.equal(new AutomationStudioNodeRegistry().list(bootstrapResolution).length, 39);
assert.equal(bootstrapRegistry.list(bootstrapResolution).length, 57);
const bootstrapCatalogBudget = automationStudioFlowBootstrapCatalogByteBudget({
  maxInputTokens: 3_000,
  instructionBytes: Buffer.byteLength(bootstrapInstruction, "utf8")
});
const bootstrapContext = buildAutomationStudioFlowBootstrapContext({
  registry: bootstrapRegistry,
  resolution: bootstrapResolution,
  instructionText: bootstrapInstruction,
  maxCatalogBytes: bootstrapCatalogBudget
});
assert.deepEqual(bootstrapContext.catalogSelection.missingRequiredTerms, []);
const bootstrapWithoutHostPermissions = buildAutomationStudioFlowBootstrapContext({
  registry: bootstrapRegistry,
  resolution: { ...bootstrapResolution, permissions: [] },
  instructionText: bootstrapInstruction,
  maxCatalogBytes: bootstrapCatalogBudget
});
assert.deepEqual(
  bootstrapWithoutHostPermissions.catalogSelection.missingRequiredTerms,
  ["submit"],
  "the live catalog projection must retain the web host's granted permissions"
);
assert.equal(bootstrapContext.catalogSelection.usedBytes <= bootstrapCatalogBudget, true);
assert.equal(Buffer.byteLength(JSON.stringify(bootstrapContext), "utf8") + Buffer.byteLength(bootstrapInstruction, "utf8") + 1_800 <= 3_000 * 4, true);const bootstrapHarnessInput = {
  taskKind: "flow_bootstrap" as const,
  projectId: "project.catalog-acceptance",
  flowId: "flow.catalog-acceptance",
  instructions: [{
    schemaVersion: "0.1" as const,
    instructionId: "instruction.catalog-acceptance",
    title: "Build the instruction-only form automation",
    body: bootstrapInstruction,
    scope: { kind: "flow" as const, projectId: "project.catalog-acceptance", flowId: "flow.catalog-acceptance" },
    priority: 100,
    status: "active" as const,
    requirement: "required" as const,
    tags: ["generation" as const],
    createdAt: 1,
    updatedAt: 1
  }],
  flowBootstrap: { registry: bootstrapRegistry, resolution: bootstrapResolution },
  tokenLimits: { maxInputTokens: 3_000, maxOutputTokens: 512, maxTotalTokens: 4_000 },
  maxEstimatedCostUsd: 0.25,
  timeoutMs: 20_000
};
const bootstrapDryRun = await runAutomationStudioLlmHarness({ ...bootstrapHarnessInput, dryRun: true });
assert.equal(bootstrapDryRun.request.estimatedInputTokens <= 3_000, true);
assert.equal(bootstrapDryRun.request.estimatedInputTokens + 512 <= 4_000, true);
assert.equal(bootstrapContext.catalogSelection.usedBytes <= bootstrapCatalogBudget, true);
const bootstrapDeepSeekBodyTokens = estimateAutomationStudioDeepSeekInputTokens(bootstrapDryRun.request);
assert.equal(bootstrapDeepSeekBodyTokens <= 3_000, true);
const evidenceTools = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => [], executeAction: async () => ({ status: "failed" }) }).tools;
const bootstrapPlanSchema = (bootstrapContext.outputSchema.properties as JsonObject | undefined)?.plan;
assert.ok(bootstrapPlanSchema !== undefined, "the bootstrap output schema defines plan");
const evidenceCompletionSchema: JsonObject = {
  type: "object", additionalProperties: false, required: ["summary", "plan"],
  properties: { summary: { type: "string", minLength: 1, maxLength: 2_000 }, plan: bootstrapPlanSchema }
};
const evidencePage = {
  schemaVersion: "web-llm-evidence.v1", trust: "untrusted-page-evidence", location: "https://example.test/products", title: "Products",
  elements: Array.from({ length: 40 }, (_, index) => ({ tag: "button", selector: `[data-product='${index}']`, role: "button", name: `Product ${index}`, text: "Open this bounded product result and inspect its available non-sensitive details." })),
  truncated: false
};
const evidencePageBytes = Buffer.byteLength(JSON.stringify(evidencePage), "utf8");
assert.equal(evidencePageBytes >= 6_500 && evidencePageBytes <= 7_488, true, `max-window evidence bytes ${evidencePageBytes}`);
const evidenceDryRun = await runAutomationStudioLlmHarness({
  ...bootstrapHarnessInput,
  taskKind: "evidence_tool_decision",
  flowBootstrap: { registry: bootstrapRegistry, resolution: bootstrapResolution, maxInputTokens: 5_000 },
  evidenceLoop: {
    iteration: 2,
    tools: evidenceTools,
    evidence: [{ callId: "call.inspect.1", toolId: "web.inspect_current_page", value: evidencePage }],
    completionSchema: evidenceCompletionSchema,
    decisionSchema: buildAutomationStudioLlmEvidenceLoopDecisionSchema(evidenceTools, evidenceCompletionSchema, true),
    canComplete: true
  },
  tokenLimits: { maxInputTokens: 8_000, maxOutputTokens: 4_000, maxTotalTokens: 12_000 },
  timeoutMs: 25_000,
  dryRun: true
});
const evidenceDeepSeekBodyTokens = estimateAutomationStudioDeepSeekInputTokens(evidenceDryRun.request);
assert.equal((evidenceDryRun.request.context.flowBootstrap?.nodeCatalog.length ?? 0) > 0, true);
assert.deepEqual(evidenceDryRun.request.context.flowBootstrap?.catalogSelection.missingRequiredTerms, []);
assert.equal(evidenceDeepSeekBodyTokens <= 8_000, true, `evidence DeepSeek input estimate ${evidenceDeepSeekBodyTokens}; catalog ${evidenceDryRun.request.context.flowBootstrap?.nodeCatalog.length} entries, ${evidenceDryRun.request.context.flowBootstrap?.catalogSelection.usedBytes}/${evidenceDryRun.request.context.flowBootstrap?.catalogSelection.byteBudget} bytes`);
assert.equal(evidenceDeepSeekBodyTokens + 4_000 <= 12_000, true);
const selectedBootstrapActions = new Set(bootstrapContext.nodeCatalog.flatMap((entry) => entry.outputAction?.fixed ? [entry.outputAction.fixed] : []));
for (const action of ["web.dom.type", "web.dom.select", "web.dom.click"]) assert.equal(selectedBootstrapActions.has(action), true, `bootstrap catalog omitted ${action}; selected=${[...selectedBootstrapActions].join(",")}; used=${bootstrapContext.catalogSelection.usedBytes}/${bootstrapContext.catalogSelection.byteBudget}`);
assert.equal(["web.dom.wait_for_text", "web.dom.wait_for_selector", "web.dom.extract"].some((action) => selectedBootstrapActions.has(action)), true, "bootstrap catalog omitted a verify/assert equivalent");

const missingSelectRegistry = new AutomationStudioNodeRegistry(outputNodeDefinitions.filter((definition) => definition.outputAction?.fixedOutputId !== "web.dom.select"));
const incompleteBootstrapContext = buildAutomationStudioFlowBootstrapContext({
  registry: missingSelectRegistry,
  resolution: bootstrapResolution,
  instructionText: bootstrapInstruction,
  maxCatalogBytes: bootstrapCatalogBudget
});
assert.equal(incompleteBootstrapContext.catalogSelection.missingRequiredTerms.includes("choose"), true);let incompleteProviderCalls = 0;
const incompleteHarness = await runAutomationStudioLlmHarness({
  ...bootstrapHarnessInput,
  flowBootstrap: { registry: missingSelectRegistry, resolution: bootstrapResolution },
  provider: { metadata: { provider: "test", model: "test" }, runTask: async () => { incompleteProviderCalls += 1; throw new Error("provider must remain unreachable"); } }
});
assert.equal(incompleteHarness.ok, false);
assert.equal(incompleteHarness.diagnostics.some((diagnostic) => diagnostic.code === "bootstrap.catalog_essentials_missing"), true);
assert.equal(incompleteProviderCalls, 0);

assert.equal(
  outputNodeDefinitions.every((definition) => definition.parameters.every((parameter) => parameter.allowStateBinding === true)),
  true
);
for (const outputId of ["web.dom.type", "web.dom.select", "web.dom.click", "web.dom.clear", "web.dom.wait_for_selector", "web.dom.extract"]) {
  const definition = outputNodeDefinitions.find((candidate) => candidate.outputAction?.fixedOutputId === outputId);
  assert.equal(definition?.parameters.find((parameter) => parameter.id === "selector")?.required, true, `${outputId} must reject targetless generated nodes`);
  assert.equal(definition?.parameters.find((parameter) => parameter.id === "target")?.required, undefined, `${outputId} must accept an optional reviewed target override`);
}
const actionCapability = webAutomationClientCapabilities.find((capability) => capability.id === "web.actions");
assert.equal(actionCapability?.metadata?.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.deepEqual(actionCapability?.metadata?.outputIds, WEB_AUTOMATION_ACTION_TYPES);

const fluxiq = createWebAutomationFluxIQ({ loadEnv: false });
const runtimeValidation = await validateWebAutomationRuntime(fluxiq);
assert.equal(runtimeValidation.ok, true);
assert.equal((await fluxiq.runtime.capabilities()).some((capability) => capability.outputIds?.includes("web.dom.click")), true);

console.log("Web automation domain smoke test passed.");
