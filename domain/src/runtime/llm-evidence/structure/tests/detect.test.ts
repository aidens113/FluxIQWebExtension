// `web.detect_repeating_structure` end to end inside the domain, driven by
// structure detections the real content script produced on Scenario Lab pages
// (`captured-detections.ts`).
//
// What these rows are really proving:
// - every real detection becomes a packet that carries no selector and no
//   value -- asserted on the serialized payload against a key allowlist, as the
//   evidence packet's own tests do -- and an extraction handle;
// - the handle resolves, through `resolveExtractionHandle` alone, to exactly
//   the `web.dom.extract_list` request the page proposed, which the request
//   reader accepts unchanged;
// - a target handle an inspect issued is bound through its selector, even one
//   every card shares, and is refused once the page or the element has moved on;
// - the page's refusals, sensitive fields and a producer's stray keys reach the
//   model as nothing but bare codes and fewer fields;
// - unknown, foreign and stale handles are refused, and each is told apart;
// - a client that cannot detect is a fault, not a refusal.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestValue, WEB_AUTOMATION_EXTRACT_MAX_PAGES, type WebAutomationExtractFieldSpec } from "../../../../actions/extraction";
import { webAutomationStructureDetectionValue, type WebAutomationStructureDetection } from "../../../../extraction";
import { WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID } from "../../../capabilities";
import {
  bindWebAutomationLlmEvidenceRuntime,
  createWebAutomationLlmEvidenceRuntime,
  RETAINED_EXTRACTION_HANDLES,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmEvidenceGateway,
  type WebLlmRepeatingStructure,
  type WebLlmStructurePaginationMode
} from "../..";
import { CAPTURED_DETECTIONS, type CapturedDetectionName } from "./captured-detections";

const SCOPE: { projectId: string; flowId: string } = { projectId: "project.one", flowId: "flow.one" };

/** Every key the model-facing packet may carry, at any depth. Anything else is a leak. */
const PACKET_KEYS = new Set([
  "schemaVersion", "trust", "location", "extraction", "target", "itemCount", "fields", "pagination", "confidence", "fieldsTruncated",
  "key", "label", "kind", "coverage"
]);

const EXPECTED_PAGINATION: Record<CapturedDetectionName, WebLlmStructurePaginationMode> = {
  "product-catalog-largest": "next_link",
  "data-table-largest": "none",
  "member-directory-largest": "none",
  "infinite-feed-largest": "infinite_scroll",
  "infinite-feed-load-more": "load_more_button"
};

type FakePage = { url: string; title?: string; elements?: JsonObject[]; structure?: unknown };

function fakeGateway(page: () => FakePage, declares = true): { gateway: WebLlmEvidenceGateway; commands: Array<{ actionType: string; parameters: JsonObject }> } {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const executeAction: WebLlmEvidenceGateway["executeAction"] = async (_sessionId, command) => {
    commands.push({ actionType: command.actionType, parameters: command.parameters });
    if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
    const current = page();
    const snapshot: JsonObject = { url: current.url, title: current.title ?? "Fixture", interactiveElements: current.elements ?? [] };
    if (command.parameters.detectStructure === undefined || current.structure === undefined) return { status: "succeeded", payload: { snapshot } };
    return { status: "succeeded", payload: { snapshot, structure: current.structure as JsonValue } };
  };
  const gateway: WebLlmEvidenceGateway = declares
    ? { eligibleSessionIds: () => ["session.one"], structureDetectionSessionIds: () => ["session.one"], executeAction }
    : { eligibleSessionIds: () => ["session.one"], executeAction };
  return { gateway, commands };
}

function captured(name: CapturedDetectionName): FakePage {
  const capture = CAPTURED_DETECTIONS[name];
  return { url: capture.url, title: capture.title, structure: structuredClone(capture.structure) };
}

/** A captured page with the elements a test needs, every property written by name. */
function withElements(page: FakePage, elements: JsonObject[]): FakePage {
  const next: FakePage = { url: page.url, elements };
  if (page.title !== undefined) next.title = page.title;
  if (page.structure !== undefined) next.structure = page.structure;
  return next;
}

function proposalOf(structure: WebAutomationStructureDetection) {
  assert.equal(structure.ok, true);
  if (!structure.ok) throw new Error("not a detection");
  return structure;
}

let callCount = 0;
async function detect(runtime: WebAutomationLlmEvidenceRuntime, value: JsonObject = {}, options: { maxEvidenceBytes?: number; scope?: typeof SCOPE } = {}) {
  callCount += 1;
  const scope = options.scope ?? SCOPE;
  const callId = `call.detect.${callCount}`;
  return await runtime.executeTool(options.maxEvidenceBytes === undefined
    ? { projectId: scope.projectId, flowId: scope.flowId, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value }
    : { projectId: scope.projectId, flowId: scope.flowId, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value, maxEvidenceBytes: options.maxEvidenceBytes });
}

function rejection(code: string) {
  return { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code }, effectApplied: false, resultCode: `web.action.rejected.${code}` };
}

/** Every key at every depth of a JSON value. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const entry of value) keysOf(entry, into);
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      into.add(key);
      keysOf(entry, into);
    }
  }
  return into;
}

/** Every selector the page's detection holds: what must never reach the model. */
function selectorsOf(structure: WebAutomationStructureDetection): string[] {
  const detection = proposalOf(structure);
  const pagination = detection.proposal.pagination;
  const paginationSelectors = pagination === undefined ? [] : "next" in pagination ? [pagination.next] : "control" in pagination ? [pagination.control] : "pages" in pagination ? [pagination.pages] : [];
  return [
    detection.proposal.container,
    detection.proposal.item,
    ...detection.proposal.fields.flatMap((field) => field.spec.selector === undefined ? [] : [field.spec.selector]),
    ...paginationSelectors
  ];
}

/** Every string at every depth of a JSON value. */
function stringsOf(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const entry of value) stringsOf(entry, into);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) stringsOf(entry, into);
  return into;
}

function assertNothingAddressable(packet: unknown, structure: WebAutomationStructureDetection): void {
  const unexpected = [...keysOf(packet)].filter((key) => !PACKET_KEYS.has(key));
  assert.deepEqual(unexpected, [], "the packet carries only allowlisted keys");
  const wire = JSON.stringify(packet);
  for (const selector of selectorsOf(structure)) assert.equal(wire.includes(selector), false, `the packet does not quote ${selector}`);
  for (const text of stringsOf(packet)) assert.equal(/data-testid|[[\]#>=]/u.test(text), false, `the packet holds nothing selector-shaped: ${text}`);
}

function readableSpec(spec: WebAutomationExtractFieldSpec): WebAutomationExtractFieldSpec {
  const copy: WebAutomationExtractFieldSpec = { kind: spec.kind };
  if (spec.selector !== undefined) copy.selector = spec.selector;
  if (spec.attribute !== undefined) copy.attribute = spec.attribute;
  if (spec.header !== undefined) copy.header = spec.header;
  if (spec.required !== undefined) copy.required = spec.required;
  return copy;
}

test("every real detection becomes a selector-free packet and a handle that resolves to the request the page proposed", async () => {
  // The captures are what the page sent, and the wire copy keeps them exactly.
  for (const [name, capture] of Object.entries(CAPTURED_DETECTIONS)) {
    assert.deepEqual(webAutomationStructureDetectionValue(capture.structure), capture.structure, `${name} survives the wire copy unchanged`);
  }
  for (const name of Object.keys(CAPTURED_DETECTIONS) as CapturedDetectionName[]) {
    const page = captured(name);
    const detection = proposalOf(page.structure as WebAutomationStructureDetection);
    const { gateway, commands } = fakeGateway(() => page);
    const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
    const result = await detect(runtime);

    assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE, name);
    assert.equal(result.effectApplied, false, name);
    assert.deepEqual(commands, [{ actionType: "web.dom.capture_snapshot", parameters: { detectStructure: {} } }], name);
    const packet = result.evidence as WebLlmRepeatingStructure;
    assertNothingAddressable(packet, page.structure as WebAutomationStructureDetection);
    assert.equal(packet.schemaVersion, "web-llm-structure.v1");
    assert.equal(packet.trust, "untrusted-page-evidence");
    assert.equal(packet.location, page.url, name);
    assert.match(packet.extraction, /^extraction\.[1-9][0-9]*$/u);
    assert.equal(packet.itemCount, detection.proposal.itemCount, name);
    assert.equal(packet.pagination, EXPECTED_PAGINATION[name], name);
    assert.equal(packet.confidence, detection.proposal.confidence, name);
    assert.deepEqual(packet.fields, detection.proposal.fields.map((field) => ({ key: field.key, label: field.label, kind: field.spec.kind, coverage: field.coverage })), name);
    assert.equal(packet.target, undefined);
    assert.equal(packet.fieldsTruncated, undefined);

    const resolved = runtime.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
    assert.equal(resolved.ok, true, name);
    if (!resolved.ok) continue;
    const expectedPaginate = detection.proposal.pagination ?? (detection.infiniteScroll ? { mode: "scroll", maxScrolls: WEB_AUTOMATION_EXTRACT_MAX_PAGES } : undefined);
    const item = detection.proposal.item;
    const fields = Object.fromEntries(detection.proposal.fields.map((field) => [field.key, readableSpec(field.spec)]));
    const expected = expectedPaginate === undefined ? { item, fields } : { item, fields, paginate: expectedPaginate };
    assert.deepEqual(resolved.binding, { handle: packet.extraction, location: page.url, extractList: expected, itemCount: detection.proposal.itemCount }, name);
    // Executable as it stands: the reader the parameter lift refuses a Flow by takes it unchanged.
    assert.deepEqual(webAutomationExtractListRequestValue(resolved.binding.extractList), resolved.binding.extractList, name);
  }
});

test("a target handle an inspect issued is bound through its selector, even one every card shares", async () => {
  const link = (frame?: number): JsonObject => frame === undefined
    ? { tagName: "a", selector: '[data-testid="product-link"]', accessibleName: "A product", attributes: { href: "/scenarios/product-catalog/products/a", "data-testid": "product-link" } }
    : { tagName: "a", selector: `frame[${frame}] >> [data-testid="product-link"]`, accessibleName: "A product", attributes: { href: "/p", "data-testid": "product-link", "data-fluxiq-frame-id": String(frame) } };
  const next: JsonObject = { tagName: "button", selector: '[data-testid="pagination-next"]', visibleText: "Next" };
  let page: FakePage = withElements(captured("product-catalog-largest"), [next, link(), link()]);
  const { gateway, commands } = fakeGateway(() => page);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const handles = (inspected.evidence as { elements: Array<{ target: string; tag: string }> }).elements;
  assert.deepEqual(handles.map((element) => [element.target, element.tag]), [["target.1", "button"], ["target.2", "a"], ["target.3", "a"]]);

  commands.length = 0;
  const around = await detect(runtime, { target: "target.2" });
  assert.equal(around.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  assert.equal((around.evidence as WebLlmRepeatingStructure).target, "target.2");
  assert.deepEqual(commands, [
    { actionType: "web.dom.capture_snapshot", parameters: {} },
    { actionType: "web.dom.capture_snapshot", parameters: { detectStructure: { selector: '[data-testid="product-link"]' } } }
  ]);
  assertNothingAddressable(around.evidence, page.structure as WebAutomationStructureDetection);

  // A handle the model was never shown.
  assert.deepEqual(await detect(runtime, { target: "target.9" }), rejection("target_unobserved"));
  // The element has left the page.
  page = { ...page, elements: [next] };
  assert.deepEqual(await detect(runtime, { target: "target.2" }), rejection("target_unobserved"));
  // The page itself has moved on.
  page = { ...page, url: "http://127.0.0.1:4173/scenarios/product-catalog/page/2", elements: [next, link(), link()] };
  assert.deepEqual(await detect(runtime, { target: "target.2" }), rejection("target_unobserved"));

  // An element in a child frame is detected in that frame, and the handle remembers it.
  // The handle is read out of the packet rather than assumed: a page keeps a
  // control's number across recaptures and never hands it to another, so a
  // control this page has not addressed before takes the next number it has
  // not spent, whatever position it is in (see ../../stable-handles.ts).
  page = withElements(captured("product-catalog-largest"), [link(7)]);
  const framedPacket = await runtime.executeTool({ ...SCOPE, callId: "call.inspect.frame", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const framedHandle = (framedPacket.evidence as { elements: Array<{ target: string }> }).elements[0]!.target;
  commands.length = 0;
  const framed = await detect(runtime, { target: framedHandle });
  assert.equal(framed.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  assert.deepEqual(commands[1], { actionType: "web.dom.capture_snapshot", parameters: { detectStructure: { selector: '[data-testid="product-link"]' }, browserFrameId: 7 } });
  const binding = runtime.resolveExtractionHandle({ ...SCOPE, handle: (framed.evidence as WebLlmRepeatingStructure).extraction });
  assert.equal(binding.ok && binding.binding.frameId, 7);
});

test("the page's refusals and a malformed call reach the model as bare codes", async () => {
  const cases = [
    ["target_not_found", "target_unobserved"],
    ["ambiguous_target", "target_unobserved"],
    ["no_repeating_run", "no_repeating_structure"],
    ["sensitive_region", "sensitive_value"]
  ] as const;
  for (const [refused, code] of cases) {
    const { gateway } = fakeGateway(() => ({ url: "https://example.test/list", structure: { ok: false, refused } }));
    assert.deepEqual(await detect(createWebAutomationLlmEvidenceRuntime(gateway)), rejection(code), refused);
  }
  const { gateway, commands } = fakeGateway(() => captured("data-table-largest"));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  for (const value of [{ extra: 1 }, { target: "nope" }, { target: 3 }, { target: "target.1", extra: true }] as JsonObject[]) {
    assert.deepEqual(await detect(runtime, value), rejection("invalid_input"), JSON.stringify(value));
  }
  assert.deepEqual(commands, [], "a malformed call reaches no page");
});

test("sensitive fields are dropped from both halves, and a producer's stray text never reaches the model", async () => {
  const page = captured("data-table-largest");
  const structure = page.structure as { ok: true; proposal: { fields: Array<Record<string, unknown>> } & Record<string, unknown> } & Record<string, unknown>;
  const hostile = "Hostile sample value 4111 1111 1111 1111";
  structure.note = hostile;
  structure.proposal.sample = hostile;
  structure.proposal.fields[0]!.sample = hostile;
  structure.proposal.fields[1]!.label = `Category ${"x".repeat(300)}`;
  structure.proposal.fields.push({ key: "secret", label: "secret", spec: { kind: "value", selector: 'input[type="password"]', handling: "exclude", required: true }, coverage: 1 });
  const { gateway } = fakeGateway(() => page);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const result = await detect(runtime);
  const packet = result.evidence as WebLlmRepeatingStructure;

  assert.deepEqual(packet.fields.map((field) => field.key), ["product", "category", "price", "stock"]);
  assert.equal(JSON.stringify(result).includes("Hostile"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(packet.fields[1]!.label.length, 80);
  const resolved = runtime.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.deepEqual(Object.keys(resolved.binding.extractList.fields), ["product", "category", "price", "stock"]);

  // A run whose every field is sensitive is not a detection on the wire; the page refuses it as `sensitive_region` instead.
  const allSensitive = captured("data-table-largest");
  for (const field of (allSensitive.structure as { proposal: { fields: Array<{ spec: Record<string, unknown> }> } }).proposal.fields) field.spec.handling = "exclude";
  assert.equal(webAutomationStructureDetectionValue(allSensitive.structure), undefined);
  const faulty = createWebAutomationLlmEvidenceRuntime(fakeGateway(() => allSensitive).gateway);
  await assert.rejects(detect(faulty), /without a structure detection/u);
});

test("the byte budget cuts fields from both halves together, and a packet that cannot fit is refused", async () => {
  const { gateway } = fakeGateway(() => captured("product-catalog-largest"));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const result = await detect(runtime, {}, { maxEvidenceBytes: 600 });
  const packet = result.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.fieldsTruncated, true);
  assert.ok(packet.fields.length >= 1 && packet.fields.length < 7, `${packet.fields.length} fields kept`);
  assert.ok(new TextEncoder().encode(JSON.stringify(packet)).byteLength <= 600);
  const resolved = runtime.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.deepEqual(Object.keys(resolved.binding.extractList.fields), packet.fields.map((field) => field.key));

  assert.deepEqual(await detect(runtime, {}, { maxEvidenceBytes: 120 }), rejection("evidence_budget_exhausted"));
});

test("unknown, foreign and stale handles are refused, and a resolved binding cannot be changed from outside", async () => {
  const { gateway } = fakeGateway(() => captured("infinite-feed-largest"));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const issued: string[] = [];
  for (let index = 0; index <= RETAINED_EXTRACTION_HANDLES; index += 1) {
    issued.push(((await detect(runtime)).evidence as WebLlmRepeatingStructure).extraction);
  }
  assert.equal(new Set(issued).size, issued.length, "every detection issues its own handle");
  const [oldest, ...kept] = issued;
  const newest = kept.at(-1)!;

  for (const handle of ["", "target.1", "extraction.0", "extraction.01", "extraction.999", " extraction.1", 42, null]) {
    assert.deepEqual(runtime.resolveExtractionHandle({ ...SCOPE, handle: handle as string }), { ok: false, code: "unknown_handle" }, String(handle));
  }
  assert.deepEqual(runtime.resolveExtractionHandle({ ...SCOPE, handle: oldest! }), { ok: false, code: "stale_handle" });
  assert.equal(runtime.resolveExtractionHandle({ ...SCOPE, handle: newest }).ok, true);
  // Another Flow, or another project, is told nothing about this one's handles -- not even that one went stale.
  for (const scope of [{ ...SCOPE, flowId: "flow.two" }, { ...SCOPE, projectId: "project.two" }]) {
    assert.deepEqual(runtime.resolveExtractionHandle({ ...scope, handle: newest }), { ok: false, code: "unknown_handle" });
    assert.deepEqual(runtime.resolveExtractionHandle({ ...scope, handle: oldest! }), { ok: false, code: "unknown_handle" });
  }
  // A handle issued to another Flow is that Flow's alone.
  const foreign = ((await detect(runtime, {}, { scope: { ...SCOPE, flowId: "flow.two" } })).evidence as WebLlmRepeatingStructure).extraction;
  assert.deepEqual(runtime.resolveExtractionHandle({ ...SCOPE, handle: foreign }), { ok: false, code: "unknown_handle" });
  assert.equal(runtime.resolveExtractionHandle({ ...SCOPE, flowId: "flow.two", handle: foreign }).ok, true);

  const first = runtime.resolveExtractionHandle({ ...SCOPE, handle: newest });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  first.binding.extractList.item = "body";
  first.binding.extractList.paginate = undefined;
  const second = runtime.resolveExtractionHandle({ ...SCOPE, handle: newest });
  assert.equal(second.ok && second.binding.extractList.item, '[data-testid="feed-item"]');
  assert.deepEqual(second.ok && second.binding.extractList.paginate, { mode: "scroll", maxScrolls: WEB_AUTOMATION_EXTRACT_MAX_PAGES });
});

test("a client that cannot detect is a fault rather than a refusal", async () => {
  const undeclared = createWebAutomationLlmEvidenceRuntime(fakeGateway(() => captured("data-table-largest"), false).gateway);
  await assert.rejects(detect(undeclared), /does not declare repeating-structure detection/u);

  const silent = createWebAutomationLlmEvidenceRuntime(fakeGateway(() => ({ url: "https://example.test/list" })).gateway);
  await assert.rejects(detect(silent), /without a structure detection/u);
});

test("a page the client could not capture is a refusal the model can work around", async () => {
  const failing = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async () => ({ status: "failed" }),
  });
  assert.deepEqual(await detect(failing), rejection("page_unreadable"));
});

test("the production binding offers detection only to a client that declares it", async () => {
  let bound: WebAutomationLlmEvidenceRuntime | undefined;
  const actions = { id: "web.actions", actionTypes: ["web.dom.capture_snapshot"] };
  let capabilities: Array<Record<string, unknown>> = [actions];
  const fluxiq = {
    programs: {
      automationStudio: { bindLlmEvidenceRuntime: (runtime: WebAutomationLlmEvidenceRuntime) => { bound = runtime; } },
      clientGateway: { snapshot: () => ({ sessions: [{ sessionId: "web", status: "ready", clientType: "extension", capabilities }] }) },
      automationStudioClientGateway: {
        executeAction: async () => {
          const page = captured("data-table-largest");
          return { status: "succeeded", payload: { snapshot: { url: page.url, title: page.title, interactiveElements: [] }, structure: page.structure } };
        },
      },
    },
  };
  bindWebAutomationLlmEvidenceRuntime(fluxiq as never);
  await assert.rejects(detect(bound!), /does not declare repeating-structure detection/u);
  capabilities = [actions, { id: WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID, kind: "snapshot" }];
  assert.equal((await detect(bound!)).resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
});
