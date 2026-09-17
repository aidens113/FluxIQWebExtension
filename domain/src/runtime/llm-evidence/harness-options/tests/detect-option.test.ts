// `web.recovery.detect_repeating_structure`: the recovery's own look at a list.
//
// Creation has `web.detect_repeating_structure`. A recovery exploring a failed
// scrape needs the same look at the page, bound through the packets *this
// exploration* returned rather than through whatever authoring last showed the
// Flow. These rows prove it is offered exactly where exploring is (`gather`,
// `iterate`), is declared with the authoring tool's input bounds, binds a
// target only through a recovery packet, keeps its extraction handle for the
// project and Flow that asked, and answers with a packet that carries none of
// the domain's denied keys and no selector.

import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioHarnessOptionRegistry, type AutomationStudioHarnessOptionResolution } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID } from "../..";
import type { WebLlmEvidenceGateway } from "../../capture";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandles } from "../../structure";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";
import { webAutomationExplorationRefusalClassifier, webAutomationRecoveryHarnessOptionBundle } from "..";
import { WEB_RECOVERY_DETECT_OPTION_ID } from "../vocabulary";

const DOMAIN = { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID } as const;
const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];
const LINK_SELECTOR = '[data-testid="product-link"]';
const LINK = { tagName: "a", selector: LINK_SELECTOR, accessibleName: "A product", attributes: { href: "/scenarios/product-catalog/products/a", "data-testid": "product-link" } };

type Page = { url: string; elements: JsonObject[]; structure?: unknown };

function harness(initial: Page = { url: CATALOG.url, elements: [LINK], structure: CATALOG.structure }, declares = true): {
  registry: AutomationStudioHarnessOptionRegistry;
  commands: Array<{ actionType: string; parameters: JsonObject }>;
  handles: WebLlmExtractionHandles;
  gateway: WebLlmEvidenceGateway;
  setPage(page: Page): void;
} {
  let page = initial;
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const executeAction: WebLlmEvidenceGateway["executeAction"] = async (_sessionId, command) => {
    commands.push({ actionType: command.actionType, parameters: command.parameters });
    const snapshot: JsonObject = { url: page.url, title: CATALOG.title, interactiveElements: page.elements };
    if (command.parameters.detectStructure === undefined || page.structure === undefined) return { status: "succeeded", payload: { snapshot } };
    return { status: "succeeded", payload: { snapshot, structure: structuredClone(page.structure) as JsonValue } };
  };
  const gateway: WebLlmEvidenceGateway = declares
    ? { eligibleSessionIds: () => ["session.one"], structureDetectionSessionIds: () => ["session.one"], executeAction }
    : { eligibleSessionIds: () => ["session.one"], executeAction };
  const handles = createWebLlmExtractionHandles();
  const registry = new AutomationStudioHarnessOptionRegistry();
  registry.register(webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" }, retainSelectors: () => {}, extractionHandles: handles }));
  return { registry, commands, handles, gateway, setPage: (next) => { page = next; } };
}

const gathering: AutomationStudioHarnessOptionResolution = { scope: DOMAIN, stage: "gather" };
let callSequence = 0;

async function run(registry: AutomationStudioHarnessOptionRegistry, optionId: string, value: JsonObject, flowId = SCOPE.flowId): Promise<{ evidence: JsonObject; effectApplied: boolean; resultCode: string }> {
  callSequence += 1;
  const result = await registry.execute({ projectId: SCOPE.projectId, flowId, callId: `call.${callSequence}`, optionId, value, maxEvidenceBytes: 64_000 }, gathering);
  return result as { evidence: JsonObject; effectApplied: boolean; resultCode: string };
}

function rejection(code: string): { kind: string; evidence: JsonObject; effectApplied: boolean; resultCode: string } {
  return { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code }, effectApplied: false, resultCode: `web.action.rejected.${code}` };
}

function linkHandle(packet: JsonObject): string {
  const link = (packet.elements as Array<{ target: string; tag: string }>).find((element) => element.tag === "a");
  assert.ok(link, "the inspect packet describes the product link");
  return link.target;
}

test("offers structure detection to a recovery while it gathers and iterates, and never to authoring or another domain", () => {
  const { registry } = harness();
  const offered = (resolution: AutomationStudioHarnessOptionResolution): boolean => registry.list(resolution).some((option) => option.toolId === WEB_RECOVERY_DETECT_OPTION_ID);

  // No side-effect permission in either: detection observes, so a policy that
  // forbids changing the page still has it.
  assert.equal(offered({ scope: DOMAIN, stage: "gather" }), true);
  assert.equal(offered({ scope: DOMAIN, stage: "iterate" }), true);
  // Flow authoring names no stage, and has its own detection tool.
  assert.equal(offered({ scope: DOMAIN, allowSideEffectsWithoutPolicy: true }), false);
  for (const stage of ["plan", "implement", "verify"] as const) assert.equal(offered({ scope: DOMAIN, stage, allowSideEffectsWithoutPolicy: true }), false, stage);
  assert.equal(offered({ scope: { kind: "domain", domainId: "other.domain" }, stage: "gather" }), false);
});

test("is declared with the authoring detection's input bounds, observes only, and takes no free look", () => {
  const { registry, gateway } = harness();
  const option = registry.get(WEB_RECOVERY_DETECT_OPTION_ID);
  const authoring = createWebAutomationLlmEvidenceRuntime(gateway).tools.find((tool) => tool.toolId === WEB_LLM_DETECT_STRUCTURE_TOOL_ID);
  assert.ok(option);
  assert.ok(authoring);

  assert.deepEqual(option.inputSchema, authoring.inputSchema);
  assert.equal(option.effect, "observe");
  assert.deepEqual(option.safety, { sideEffect: "observe" });
  assert.deepEqual(option.availability, DOMAIN);
  assert.deepEqual(option.stages, ["gather", "iterate"]);
  // Core refuses an identical repeat on its own; a second target is a
  // different request. The recovery's free look is `web.recovery.inspect`.
  assert.equal(option.repeatPolicy, undefined);
  assert.equal(option.initialObservation, undefined);
});

test("detects around a control a recovery packet showed, and keeps the handle for that project and Flow only", async () => {
  const { registry, commands, handles } = harness();
  const inspected = await run(registry, "web.recovery.inspect", {});

  const detected = await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { target: linkHandle(inspected.evidence) });

  assert.equal(detected.resultCode, "web.structure.detected");
  assert.equal(detected.effectApplied, false);
  assert.deepEqual(commands.at(-1), { actionType: "web.dom.capture_snapshot", parameters: { detectStructure: { selector: LINK_SELECTOR } } });
  assert.equal(detected.evidence.schemaVersion, "web-llm-structure.v1");
  assert.equal(detected.evidence.target, linkHandle(inspected.evidence));
  const extraction = detected.evidence.extraction;
  assert.equal(typeof extraction, "string");
  const resolved = handles.resolve(SCOPE, extraction);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) throw new Error("unreachable");
  assert.equal(resolved.binding.extractList.item, CATALOG.structure.proposal.item);
  assert.deepEqual(handles.resolve({ ...SCOPE, flowId: "flow.two" }, extraction), { ok: false, code: "unknown_handle" });
});

test("refuses a target no recovery packet issued, or whose page has moved on, without asking the page to detect", async () => {
  const { registry, commands, setPage } = harness();
  await run(registry, "web.recovery.inspect", {});

  assert.deepEqual(await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { target: "target.9" }), rejection("target_unobserved"));
  // Another Flow's exploration issued nothing this one can name.
  assert.deepEqual(await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { target: "target.1" }, "flow.two"), rejection("target_unobserved"));
  setPage({ url: `${CATALOG.url}page/2`, elements: [LINK], structure: CATALOG.structure });
  assert.deepEqual(await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { target: "target.1" }), rejection("target_unobserved"));
  assert.equal(commands.some((command) => command.parameters.detectStructure !== undefined), false);

  assert.deepEqual(await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { target: "a" }), rejection("invalid_input"));
  assert.deepEqual(await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, { selector: LINK_SELECTOR }), rejection("invalid_input"));
});

test("answers with a packet Core would carry: none of the domain's denied keys at any depth, and no selector", async () => {
  const { registry, gateway } = harness();
  const detected = await run(registry, WEB_RECOVERY_DETECT_OPTION_ID, {});
  assert.equal(detected.resultCode, "web.structure.detected");

  // Core's own normalization of a key before it is compared with the denied
  // set (`automationStudioEvidenceKey`, not exported by Core's barrel).
  const coreKey = (key: string): string => key.replace(/[_-]/g, "").toLowerCase();
  const denied = new Set(createWebAutomationLlmEvidenceRuntime(gateway).deniedEvidenceKeys.map(coreKey));
  assert.equal(denied.has("selector"), true);
  const keys: string[] = [];
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Array.isArray(value) ? value.map((item) => ["", item] as const) : Object.entries(value)) {
      if (key) keys.push(key);
      walk(child);
    }
  };
  walk(detected.evidence);
  assert.deepEqual(keys.filter((key) => denied.has(coreKey(key))), []);
  // Core's other carry rules for an explored packet.
  assert.equal(typeof detected.evidence.schemaVersion, "string");
  assert.equal(keys.every((key) => key.length <= 100), true);
  assert.equal(strings.every((value) => value.length <= 2_000), true);

  const captureSelectors: string[] = [];
  const collect = (value: unknown, key = ""): void => {
    if (typeof value === "string" && ["selector", "container", "item"].includes(key)) captureSelectors.push(value);
    if (value && typeof value === "object") for (const [childKey, child] of Object.entries(value)) collect(child, Array.isArray(value) ? key : childKey);
  };
  collect(CATALOG.structure);
  assert.equal(captureSelectors.length > 2, true);
  const serialized = JSON.stringify(detected.evidence);
  assert.deepEqual(captureSelectors.filter((selector) => serialized.includes(selector)), []);
});

test("a page with no list there is an answer, not a stop; a client that cannot detect is a fault", async () => {
  const noList = harness({ url: CATALOG.url, elements: [LINK], structure: { ok: false, refused: "no_repeating_run" } });
  const refused = await run(noList.registry, WEB_RECOVERY_DETECT_OPTION_ID, {});
  assert.deepEqual(refused, rejection("no_repeating_structure"));
  assert.equal(webAutomationExplorationRefusalClassifier(refused.resultCode), undefined);

  const unable = harness(undefined, false);
  await assert.rejects(run(unable.registry, WEB_RECOVERY_DETECT_OPTION_ID, {}), /does not declare repeating-structure detection/u);
});
