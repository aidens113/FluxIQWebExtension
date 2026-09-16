import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AutomationStudioIoRecorder, AutomationStudioNativeNodeRuntime, AutomationStudioService, automationStudioFlowBootstrapCatalogByteBudget, buildAutomationStudioFlowBootstrapContext, buildAutomationStudioLlmEvidenceLoopDecisionSchema, estimateAutomationStudioDeepSeekInputTokens, runAutomationStudioLlmHarness } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry, validateAutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import type { JsonObject } from "fluxiq/core";
import { IoRegistry } from "fluxiq/io";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "..";
import { createWebAutomationFluxIQ } from "..";
import { webAutomationRecordingDomain } from "../recording/domain";
import { createWebAutomationRecordingEvent } from "../client";
import { WEB_AUTOMATION_INPUT_IDS } from "../io/input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "../io/manifest-definitions";
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

// The rows mapping recorded events sent as domain events, the live input path's agreement among them, record through
// Core in `tests/web-panel-host.test.ts`: Core shows a mapper such an event as two entries, which no hand-built row shows.

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

// W19 (design D1): a recorded click claims the path it landed on, the explained navigation after it naming the event id
// the click was sent under. The D1b rows below build from this click and landing; the D1 rows, a click sent as a domain
// event, record through Core in `tests/web-panel-host.test.ts`.
const signInClick = createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 3, url: "https://example.test/scenarios/auth-gate/sign-in", title: "Sign in", eventTimestampMs: 900, element: { selector: "#continue", tagName: "button", text: "Continue" } });
assert.ok(signInClick.eventId, "the builder names every recording event");
const signInLanding = createWebAutomationRecordingEvent({ kind: "browser.navigation", sequence: 4, url: "https://example.test/scenarios/auth-gate/account", title: "", eventTimestampMs: 1_150, metadata: { transition: "explained", explainedBy: 3, explainedByEventId: signInClick.eventId } });

// W25 (option 2 of `i-late-target-wait`): a DOM addition recorded before a click
// proposes waiting for the click's target, from the mutation's own call. Both
// entries are shaped as Core hands them to the mapper: the mutation batch as an
// `input.event` observation, the live click as an `action` entry.
const lateClickWire = createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 8, url: "https://example.test/scenarios/delayed-ui/", title: "Delayed UI", eventTimestampMs: 1_300, element: { selector: "#late-action", tagName: "button", text: "Late action" } });
const lateClickEntry = { observationId: "observation.late-click", recordingId: "recording.test", domainId: WEB_AUTOMATION_DOMAIN_ID, type: "action", timestamp: 1_300, payload: { type: "action", actionType: "web.dom.click", outputId: "web.dom.click", confirmationInputId: WEB_AUTOMATION_INPUT_IDS.elementClicked, confirmationTimeoutMs: 5_000, parameters: webAutomationOutputPayload("web.dom.click", lateClickWire.payload ?? {}), origin: "operator", startedAt: 1_300, completedAt: 1_300 }, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked, inputRole: "action", envelopeId: "envelope.late-click", policyEligible: true } };
const mutationObservation = (added: number) => ({ observationId: `observation.mutation.${added}`, recordingId: "recording.test", domainId: WEB_AUTOMATION_DOMAIN_ID, type: "observation", timestamp: 1_200, payload: { type: "observation", observationType: "input.event", payload: { latestEvidence: { kind: "dom.mutation", url: "https://example.test/scenarios/delayed-ui/", title: "Delayed UI", sequence: 7, timestamp: 1_200, mutation: { added, removed: 0, attributes: 0, text: 0 } } } }, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence, inputRole: "event", envelopeId: `envelope.mutation.${added}`, policyEligible: false } });
assert.deepEqual(mapWebRecordingObservation(mutationObservation(1), { following: [lateClickEntry] }), { outputId: "web.dom.wait_for_selector", parameters: { selector: "#late-action", wait: { condition: "present" } }, confidence: 0.9, label: "Wait for element" }, "W25: a mutation that added nodes proposes waiting for the next click's target");
assert.equal(mapWebRecordingObservation(mutationObservation(0), { following: [lateClickEntry] }), null, "W25: a batch that added nothing proposes nothing");
assert.equal(mapWebRecordingObservation(mutationObservation(1)), null, "W25: a mutation mapped with no following entries proposes nothing");
assert.equal(mapWebRecordingObservation(lateClickEntry, { following: [] }), null, "W25: a click's action entry still maps to null, so Core's fallback click survives");

// W19 (D1b): a click recorded through its action input reaches the mapper as Core's `action` entry, and its landing as Core's `domain_event`, which keeps
// the event's own payload under `{ payload }`. A landing naming the event id Core stored on the entry gives Core's fallback candidate for it, plus the claim.
const coreClickEntry = (wire: typeof signInClick, metadata: JsonObject = {}) => ({ ...lateClickEntry, observationId: `entry.${wire.eventId}`, payload: { ...lateClickEntry.payload, parameters: webAutomationOutputPayload("web.dom.click", wire.payload ?? {}) }, metadata: { ...lateClickEntry.metadata, envelopeId: `envelope.${wire.eventId}`, eventId: wire.eventId ?? "", sourceId: "tab:7:frame:0", ...metadata } });
const coreLanding = (wire: typeof signInLanding) => ({ observationId: wire.eventId ?? "", recordingId: "recording.test", domainId: WEB_AUTOMATION_DOMAIN_ID, type: "domain_event", timestamp: wire.timestamp ?? 0, payload: { type: "domain_event", eventType: wire.eventType, correlationId: wire.eventId ?? "", payload: { payload: wire.payload ?? {} } }, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, clientGatewayMessageId: "message.landing", clientId: "client.test", ...(wire.metadata ?? {}) } });
const signInEntry = coreClickEntry(signInClick);
const accountClaim = { conditions: [{ assert: { kind: "url", expected: "/scenarios/auth-gate/account" } }], mode: "all", timeoutMs: 5_000 };
assert.deepEqual(mapWebRecordingObservation(signInEntry, { following: [coreLanding(signInLanding)] }), { outputId: "web.dom.click", parameters: signInEntry.payload.parameters, sourceInputIds: [WEB_AUTOMATION_INPUT_IDS.elementClicked], expectedConfirmation: { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked, timeoutMs: 5_000 }, expectedState: accountClaim, confidence: 0.95, label: "Web Dom Click" }, "D1b: a linked click's action entry gives Core's fallback candidate plus the claim");
assert.equal(mapWebRecordingObservation(signInEntry, { following: [] }), null, "D1b: an unlinked click's action entry maps to null, so Core's fallback stands");
assert.equal(mapWebRecordingObservation(coreClickEntry(signInClick, { eventId: lateClickWire.eventId ?? "" }), { following: [coreLanding(signInLanding)] }), null, "D1b: a landing naming another click's event id links nothing");
assert.equal(mapWebRecordingObservation(coreClickEntry(signInClick, { policyEligible: false }), { following: [coreLanding(signInLanding)] }), null, "D1b: an entry Core's fallback refuses is not proposed either");
assert.equal(mapWebRecordingObservation({ ...signInEntry, payload: { ...signInEntry.payload, actionType: "web.dom.type", outputId: "web.dom.type" } }, { following: [coreLanding(signInLanding)] }), null, "D1b: only a click's action entry claims its landing");
// ...and recorded through Core: its IO recorder writes each click's action entry and the bridge's domain-event call the landing. A mapper proposing nothing leaves Core's fallback.
const proposalDataDir = await mkdtemp(path.join(os.tmpdir(), "web-d1b-proposals-"));
const proposalIo = new IoRegistry();
proposalIo.registerInput(WEB_AUTOMATION_DOMAIN_ID, { definition: webAutomationManifestInputs.find((input) => input.id === WEB_AUTOMATION_INPUT_IDS.elementClicked)!, mode: "stream", subscribe: () => () => undefined, outputBinding: { outputId: "web.dom.click", toPayload: (event) => webAutomationOutputPayload("web.dom.click", event.payload as JsonObject) } });
proposalIo.registerOutput(WEB_AUTOMATION_DOMAIN_ID, { definition: webAutomationManifestOutputs.find((output) => output.id === "web.dom.click")!, mode: "request", dispatch: (request) => ({ ok: true, domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: request.outputId, payload: {} }) });
const proposalMappers = { web: mapWebRecordingObservation, none: () => null };
const proposalRuntime = new AutomationStudioNativeNodeRuntime().register({ schemaVersion: "0.1", sdkVersion: "0.1", packageId: "web.d1b", packageVersion: "1.0.0", domainId: WEB_AUTOMATION_DOMAIN_ID, nodes: [], recordingMappers: Object.keys(proposalMappers).map((id) => ({ id, version: "1.0.0", description: id, outputIds: ["web.dom.click"] })) }, { packageId: "web.d1b", packageVersion: "1.0.0", implementations: {}, recordingMappers: proposalMappers });
const proposalService = new AutomationStudioService({ dataDir: proposalDataDir }).bindIoRuntime(proposalIo, WEB_AUTOMATION_DOMAIN_ID).bindNativeNodeRuntime(proposalRuntime);
try {
  proposalService.registerRecordingDomain(webAutomationRecordingDomain);
  const { id: projectId } = await proposalService.createProject({ name: "D1b", domainId: WEB_AUTOMATION_DOMAIN_ID });
  const { recordingId } = await proposalService.createRecording({ projectId, recordingId: "recording.d1b", domainId: WEB_AUTOMATION_DOMAIN_ID, initialState: { timestamp: 1, namespaces: {} } });
  const recorder = new AutomationStudioIoRecorder({ automationStudio: proposalService, io: proposalIo, domainId: WEB_AUTOMATION_DOMAIN_ID, projectId });
  const recordClick = (wire: typeof signInClick, sequence: number) => recorder.recordInput(recordingId, WEB_AUTOMATION_INPUT_IDS.elementClicked, { id: `envelope.${sequence}`, ioId: WEB_AUTOMATION_INPUT_IDS.elementClicked, sequence, timestampMs: wire.timestamp ?? 0, payload: wire.payload ?? {}, metadata: { sourceId: "tab:7:frame:0", clientGatewayMessageId: `message.${sequence}`, ...(wire.metadata ?? {}), inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked, eventId: wire.eventId ?? "" } });
  await recordClick(signInClick, 1);
  await proposalService.appendRecordingDomainEvent({ projectId, recordingId, domainId: WEB_AUTOMATION_DOMAIN_ID, eventType: signInLanding.eventType, eventId: signInLanding.eventId ?? "", timestamp: signInLanding.timestamp ?? 0, sourceId: "tab:7", payload: signInLanding.payload ?? {}, metadata: { clientGatewayMessageId: "message.2", clientId: "client.test", ...(signInLanding.metadata ?? {}) } });
  await recordClick(createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 5, url: "https://example.test/scenarios/auth-gate/account", title: "Account", eventTimestampMs: 1_400, element: { selector: "#sign-out", tagName: "button", text: "Sign out" } }), 3);
  const { proposals } = await proposalService.createRecordingFlowProposals({ projectId, recordingId });
  const candidatesOf = (mapperId: string) => (proposals.find((proposal) => proposal.mapper.id === mapperId)?.candidates ?? []).map(({ candidateId: _candidateId, ...candidate }) => candidate);
  assert.deepEqual(candidatesOf("web"), [{ ...candidatesOf("none")[0], expectedState: accountClaim }, candidatesOf("none")[1]], "D1b: through Core, a linked click gives Core's fallback candidate plus the claim, and an unlinked one Core's fallback");
} finally {
  await proposalService.close();
  await rm(proposalDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
}

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
// Derived, never hard-coded: Core adds builtin nodes over time (K6 added For Each and Write
// Records), and a literal here fails the whole file to load without saying anything true. What
// this domain actually guarantees is that registering its output nodes adds exactly that many.
const coreBuiltinNodeCount = new AutomationStudioNodeRegistry().list(bootstrapResolution).length;
assert.ok(coreBuiltinNodeCount > 0);
assert.equal(bootstrapRegistry.list(bootstrapResolution).length, coreBuiltinNodeCount + outputNodeDefinitions.length);
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
