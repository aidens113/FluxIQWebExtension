import assert from "node:assert/strict";
import { AutomationStudioService, automationStudioFlowBootstrapCatalogByteBudget, buildAutomationStudioFlowBootstrapContext, estimateAutomationStudioDeepSeekInputTokens, runAutomationStudioLlmHarness, validateStateSnapshot } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry, validateAutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "./constants";
import { createWebAutomationFluxIQ } from "./host";
import { webAutomationRecordingDomain } from "./recording/domain";
import { createWebAutomationInitialState } from "./recording/state";
import { createWebAutomationRecordingEvent } from "./client/gateway-mapping";
import { WEB_AUTOMATION_INPUT_IDS, webAutomationInputIdForRecordedEvent, actionInputDefinitions, stateInputDefinitions } from "./io/input-model";
import { createWebAutomationStateFromSnapshot, filterStateElements, webAutomationActionVisualTargetFromElement } from "./recording/web-state";
import { webAutomationClientCapabilities } from "./actions/capabilities";
import { WEB_AUTOMATION_ACTION_TYPES } from "./actions/types";
import { listWebAutomationOutputNodeDefinitions, webAutomationOutputPayload, outputTargetFromPayload } from "./output-nodes";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "./output-nodes/native-runtime";
import { validateWebAutomationRuntime } from "./runtime";
import { mapWebRecordingObservation } from "./web-panel-host";

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
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "browser.navigation", url: "https://example.test", title: "Example", sequence: 1, metadata: { reason: "recording_start" } }), undefined);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "browser.navigation", url: "https://example.test/history", title: "Example", sequence: 2 }), undefined);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "browser.navigation", url: "https://example.test/typed", title: "Example", sequence: 3, metadata: { transition: "typed" } }), WEB_AUTOMATION_INPUT_IDS.navigationRequested);

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
assert.equal((event.payload.visualTarget as { statePath?: string } | undefined)?.statePath, "web.elements.button");
assert.equal((event.metadata?.visualTarget as { layerId?: string } | undefined)?.layerId, "element.button");

const initialState = createWebAutomationInitialState(1);
assert.equal(initialState.namespaces.web?.schemaId, WEB_AUTOMATION_DOMAIN_ID);

const filteredElements = filterStateElements([
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
]);
assert.deepEqual(filteredElements.map((item) => item.selector), ["button.save", "a.home", "input[name=search]"]);
const saveVisualTarget = webAutomationActionVisualTargetFromElement(filteredElements[0]!);
assert.equal(saveVisualTarget?.statePath, "web.elements.button.save");
assert.equal(saveVisualTarget?.documentLayerId, "document.element.button.save");

const prioritizedElements = filterStateElements([
  { tagName: "section", selector: "section.hero", attributes: { id: "hero" }, bounds: { x: 0, y: 0, width: 800, height: 300 } },
  { tagName: "p", selector: "p.summary", text: "Account summary", bounds: { x: 20, y: 120, width: 220, height: 24 } },
  { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false },
  { tagName: "button", selector: "button.deposit", text: "Deposit", bounds: { x: 20, y: 40, width: 90, height: 36 } },
  { tagName: "div", selector: "div.empty", bounds: { x: 20, y: 180, width: 100, height: 20 } }
]);
assert.equal(prioritizedElements[0]?.selector, "button.deposit");
assert.equal(prioritizedElements.some((item) => item.selector === "p.summary"), true);
assert.equal(prioritizedElements.some((item) => item.selector === "p.disclaimer"), true);

const noisyElements = Array.from({ length: 1_600 }, (_, index) => ({
  tagName: "div",
  selector: `div.wrapper-${index}`,
  text: `Wrapper ${index}`,
  bounds: { x: 0, y: index * 20, width: 800, height: 18 }
}));
const prioritySurvivors = filterStateElements([
  ...noisyElements,
  { tagName: "a", selector: "a.billing", href: "https://example.test/billing", text: "Billing", bounds: { x: 20, y: 20, width: 80, height: 24 } },
  { tagName: "p", selector: "p.balance", text: "Available balance", bounds: { x: 20, y: 60, width: 160, height: 24 } },
  { tagName: "h2", selector: "h2.accounts", text: "Accounts", bounds: { x: 20, y: 100, width: 140, height: 32 } }
]);
assert.equal(prioritySurvivors.some((item) => item.selector === "a.billing"), true);
assert.equal(prioritySurvivors.some((item) => item.selector === "p.balance"), true);
assert.equal(prioritySurvivors.some((item) => item.selector === "h2.accounts"), true);

const repeatedNamedControlsState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/preferences",
  title: "Preferences",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
  interactiveElements: [
    { tagName: "input", selector: "form > label:nth-of-type(1) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 10, width: 16, height: 16 } },
    { tagName: "input", selector: "form > label:nth-of-type(2) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 40, width: 16, height: 16 } }
  ]
}, { timestamp: 18 });
assert.equal(repeatedNamedControlsState.namespaces.web?.values["elements.count"]?.value, 2);

const snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/search",
  title: "Search",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 25 },
  interactiveElements: filteredElements
}, {
  timestamp: 20,
  sourceId: "tab:1",
  projectId: "project.test",
  screenContentRef: "automation-object://project/project.test/0000000000000000000000000000000000000000000000000000000000000000"
});
const webValues = snapshotState.namespaces.web?.values ?? {};
assert.equal(webValues["page.url"]?.value, "https://example.test/search");
assert.equal(webValues["scroll.position"]?.type, "point");
assert.equal(webValues["elements.count"]?.value, 3);
assert.equal(Object.keys(webValues).some((path) => path.includes("button.icon")), false);
assert.equal(Object.keys(webValues).some((path) => path.endsWith(".selector")), false);
assert.equal(snapshotState.presentation?.defaultFrameId, "screen");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.rendererId, "web-automation.viewport");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers[0]?.id, "screenshot");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.kind === "region"), true);
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.metadata?.frameKind, "viewport-screenshot");
assert.equal(snapshotState.presentation?.visualFrames?.[1]?.id, "document");
assert.equal(snapshotState.presentation?.visualFrames?.[1]?.metadata?.frameKind, "document-map");
assert.equal(webValues["elements.button.save"]?.type, "json");
assert.equal((webValues["elements.button.save"]?.value as { selector?: string; isVisibleOnViewport?: boolean } | undefined)?.selector, "button.save");
assert.equal((webValues["elements.button.save"]?.value as { selector?: string; isVisibleOnViewport?: boolean } | undefined)?.isVisibleOnViewport, true);
assert.equal(webValues["elements.button.save"]?.presentation?.anchor?.type, "bounds");
assert.equal(webValues["elements.button.save"]?.presentation?.metadata?.boundsKind, "document");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers.find((layer) => layer.id.includes("button.save"))?.statePath, "web.elements.button.save");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers.find((layer) => layer.id.includes("button.save"))?.metadata?.boundsKind, "screenshot");
assert.equal(validateStateSnapshot(snapshotState).ok, true);

const scaledScreenshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/scaled",
  title: "Scaled",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 900 },
  interactiveElements: [
    { tagName: "a", selector: "a.statement", text: "Statement", bounds: { x: 100, y: 50, width: 80, height: 20 }, documentBounds: { x: 100, y: 50, width: 80, height: 20 } }
  ]
}, {
  timestamp: 25,
  screenContentRef: "automation-object://project/project.test/2222222222222222222222222222222222222222222222222222222222222222",
  screenImageSize: { width: 1600, height: 1200 }
});
const scaledScreenFrame = scaledScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "screen");
const scaledDocumentFrame = scaledScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "document");
assert.equal(scaledScreenFrame?.coordinateSpace.width, 1600);
assert.equal(scaledScreenFrame?.coordinateSpace.height, 1200);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id === "screenshot")?.bounds.width, 1600);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds.x, 200);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds.width, 160);
assert.equal(scaledDocumentFrame?.coordinateSpace.width, 800);
assert.equal(scaledDocumentFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds.x, 100);
assert.equal(validateStateSnapshot(scaledScreenshotState).ok, true);

const iframeScreenshotState = createWebAutomationStateFromSnapshot({
  url: "https://widget.example.test",
  title: "Widget",
  viewport: { width: 400, height: 300, scrollX: 0, scrollY: 0, documentWidth: 400, documentHeight: 300 },
  frame: {
    isTop: false,
    viewportOffset: { x: 900, y: 120, width: 400, height: 300 }
  },
  interactiveElements: [
    { tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 30, width: 100, height: 40 }, documentBounds: { x: 20, y: 30, width: 100, height: 40 } }
  ]
}, {
  timestamp: 26,
  screenContentRef: "automation-object://project/project.test/3333333333333333333333333333333333333333333333333333333333333333",
  screenImageSize: { width: 1534, height: 945 }
});
const iframeScreenFrame = iframeScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "screen");
const iframeDocumentFrame = iframeScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "document");
assert.equal(iframeScreenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds.x, 3528.2);
assert.equal(iframeScreenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds.y, 472.5);
assert.equal(iframeDocumentFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds.x, 20);
assert.equal(iframeScreenFrame?.metadata?.frameViewportOffset?.x, 900);
assert.equal(validateStateSnapshot(iframeScreenshotState).ok, true);

const fullPageState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/long",
  title: "Long page",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 1400 },
  interactiveElements: [
    { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false }
  ]
}, {
  timestamp: 30,
  screenContentRef: "automation-object://project/project.test/1111111111111111111111111111111111111111111111111111111111111111"
});
assert.equal(fullPageState.presentation?.visualFrames?.[0]?.coordinateSpace.height, 600);
assert.equal(fullPageState.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.id.includes("p.disclaimer")), false);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.coordinateSpace.width, 800);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.coordinateSpace.height, 1400);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.metadata?.screenCoordinateSpace, "document-map");
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.metadata?.documentMapWidth, 800);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.bounds.y, 1200);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.metadata?.renderKind, "direct-rendered");
assert.equal(validateStateSnapshot(fullPageState).ok, true);

assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.click", url: "https://example.test", title: "Example", sequence: 2 }), WEB_AUTOMATION_INPUT_IDS.elementClicked);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.input", url: "https://example.test", title: "Example", sequence: 3, inputValue: "hello" }), WEB_AUTOMATION_INPUT_IDS.textEntered);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.input", url: "https://example.test", title: "Example", sequence: 4, inputValue: "" }), WEB_AUTOMATION_INPUT_IDS.fieldCleared);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.change", url: "https://example.test", title: "Example", sequence: 5, element: { tagName: "select" }, inputValue: "two" }), WEB_AUTOMATION_INPUT_IDS.optionSelected);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.submit", url: "https://example.test", title: "Example", sequence: 6 }), undefined);

assert.deepEqual(actionInputDefinitions.find(([id]) => id === WEB_AUTOMATION_INPUT_IDS.elementClicked), [WEB_AUTOMATION_INPUT_IDS.elementClicked, "Element clicked", "web.dom.click"]);
assert.equal(stateInputDefinitions.every((input) => input.role !== "action"), true);

const clickPayload = webAutomationOutputPayload("web.dom.click", {
  element: { selector: "button.save", tagName: "button", text: "Save" },
  visualTarget: { namespace: "web", statePath: "web.elements.button.save", selector: "button.save" }
});
assert.equal(clickPayload.selector, "button.save");
assert.equal((clickPayload.element as { selector?: string }).selector, "button.save");
assert.equal((clickPayload.visualTarget as { statePath?: string }).statePath, "web.elements.button.save");
assert.equal((outputTargetFromPayload(clickPayload)?.visualTarget as { statePath?: string } | undefined)?.statePath, "web.elements.button.save");

const outputNodeDefinitions = listWebAutomationOutputNodeDefinitions();
assert.equal(outputNodeDefinitions.length, 11);
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
assert.equal(bootstrapRegistry.list(bootstrapResolution).length, 50);
const bootstrapCatalogBudget = automationStudioFlowBootstrapCatalogByteBudget({
  maxInputTokens: 2_000,
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
assert.equal(Buffer.byteLength(JSON.stringify(bootstrapContext), "utf8") + Buffer.byteLength(bootstrapInstruction, "utf8") + 1_800 <= 2_000 * 4, true);const bootstrapHarnessInput = {
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
    tags: ["generation"],
    createdAt: 1,
    updatedAt: 1
  }],
  flowBootstrap: { registry: bootstrapRegistry, resolution: bootstrapResolution },
  tokenLimits: { maxInputTokens: 2_000, maxOutputTokens: 512, maxTotalTokens: 3_000 },
  maxEstimatedCostUsd: 0.25,
  timeoutMs: 20_000
};
const bootstrapDryRun = await runAutomationStudioLlmHarness({ ...bootstrapHarnessInput, dryRun: true });
assert.equal(bootstrapDryRun.request.estimatedInputTokens <= 2_000, true);
assert.equal(bootstrapDryRun.request.estimatedInputTokens + 512 <= 3_000, true);assert.equal(bootstrapCatalogBudget, 5_326);
assert.equal(bootstrapContext.catalogSelection.usedBytes, 4_959);
assert.equal(bootstrapDryRun.request.estimatedInputTokens, 1_753);const bootstrapDeepSeekBodyTokens = estimateAutomationStudioDeepSeekInputTokens(bootstrapDryRun.request);
assert.equal(bootstrapDeepSeekBodyTokens, 1_996);
assert.equal(bootstrapDeepSeekBodyTokens <= 2_000, true);
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
const actionCapability = webAutomationClientCapabilities.find((capability) => capability.id === "web.actions");
assert.equal(actionCapability?.metadata?.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.deepEqual(actionCapability?.metadata?.outputIds, WEB_AUTOMATION_ACTION_TYPES);

const fluxiq = createWebAutomationFluxIQ({ loadEnv: false });
const runtimeValidation = await validateWebAutomationRuntime(fluxiq);
assert.equal(runtimeValidation.ok, true);
assert.equal((await fluxiq.runtime.capabilities()).some((capability) => capability.outputIds?.includes("web.dom.click")), true);

console.log("Web automation domain smoke test passed.");
