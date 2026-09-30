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
// - each way a page can have no readable list is its own refusal, carrying the
//   counts behind it and not one word of the page;
// - sensitive fields and a producer's stray keys reach the model as fewer
//   fields and nothing else;
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
  WEB_LLM_RUN_NODE_TOOL_ID,
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

/**
 * `structure` is the page's answer to a detection; `aroundTarget`, when set, is
 * its answer to a detection that names a selector, so a page can refuse around
 * a target and still hold a list elsewhere.
 */
type FakePage = { url: string; title?: string; elements?: JsonObject[]; structure?: unknown; aroundTarget?: unknown; evidence?: JsonObject; elementTotal?: number };

function fakeGateway(page: () => FakePage, declares = true): { gateway: WebLlmEvidenceGateway; commands: Array<{ actionType: string; parameters: JsonObject }> } {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const executeAction: WebLlmEvidenceGateway["executeAction"] = async (_sessionId, command) => {
    commands.push({ actionType: command.actionType, parameters: command.parameters });
    if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
    const current = page();
    const snapshot: JsonObject = { url: current.url, title: current.title ?? "Fixture", interactiveElements: current.elements ?? [] };
    // Written by name rather than spread, as every producer of this contract is.
    if (current.evidence !== undefined) snapshot.evidence = current.evidence;
    if (current.elementTotal !== undefined) snapshot.elementTotal = current.elementTotal;
    const request = command.parameters.detectStructure;
    const named = request !== undefined && request !== null && typeof request === "object" && !Array.isArray(request) && "selector" in request;
    const structure = named && current.aroundTarget !== undefined ? current.aroundTarget : current.structure;
    if (request === undefined || structure === undefined) return { status: "succeeded", payload: { snapshot } };
    return { status: "succeeded", payload: { snapshot, structure: structure as JsonValue } };
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
/**
 * One detection, without the states it saw. Those are digests of each fixture
 * page, held to their own contract in `../../tests/call-state-digests.test.ts`;
 * restating a hash of every fixture here would test nothing about detection.
 */
async function detect(runtime: WebAutomationLlmEvidenceRuntime, value: JsonObject = {}, options: { maxEvidenceBytes?: number; scope?: typeof SCOPE } = {}) {
  callCount += 1;
  const scope = options.scope ?? SCOPE;
  const callId = `call.detect.${callCount}`;
  const result = await runtime.executeTool(options.maxEvidenceBytes === undefined
    ? { projectId: scope.projectId, flowId: scope.flowId, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value }
    : { projectId: scope.projectId, flowId: scope.flowId, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value, maxEvidenceBytes: options.maxEvidenceBytes });
  delete result.stateDigests;
  return result;
}

/**
 * The refusal as the model receives it, with the reason that says what to do
 * next -- and as the run's own record keeps it, which is the same reason said
 * once more beside the code.
 *
 * The second half is what makes a failed run readable afterwards. Core traces
 * `resultCode`, and every refusal of a kind reads the same there:
 * `run-mug776kx-0214b287` published 14 identical
 * `web.action.rejected.invalid_input` rows for what were several different
 * mistakes. `resultReason` is the word that tells them apart, so a refusal that
 * carries a reason for the model and not for the record is a defect, and these
 * expectations name both rather than either.
 */
function rejection(code: string, detail?: JsonObject) {
  const evidence: JsonObject = detail === undefined
    ? { schemaVersion: "web-llm-tool-result.v1", ok: false, code }
    : { schemaVersion: "web-llm-tool-result.v1", ok: false, code, detail };
  const resultCode = `web.action.rejected.${code}`;
  const reason = detail?.reason;
  // A repeated refusal also says how many times in a row, as a count Core's
  // stall guard reads (`../repeated-refusal.ts`), beside the reason.
  const repeated = detail?.repeatedAnswer;
  const counted = typeof repeated === "number" ? { repeatedAnswer: repeated } : {};
  return typeof reason === "string"
    ? { kind: "llm_evidence_tool_execution", evidence, effectApplied: false, resultCode, resultReason: reason, ...counted }
    : { kind: "llm_evidence_tool_execution", evidence, effectApplied: false, resultCode };
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
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
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
  assert.deepEqual(await detect(runtime, { target: "target.9" }), rejection("target_unobserved", { reason: "handle_not_in_packet", target: "target.9" }));
  // The element has left the page.
  page = { ...page, elements: [next] };
  assert.deepEqual(await detect(runtime, { target: "target.2" }), rejection("target_unobserved", { reason: "handle_no_longer_on_page", target: "target.2" }));
  // The page itself has moved on.
  page = { ...page, url: "http://127.0.0.1:4173/scenarios/product-catalog/page/2", elements: [next, link(), link()] };
  assert.deepEqual(await detect(runtime, { target: "target.2" }), rejection("target_unobserved", { reason: "page_moved_since_packet", target: "target.2" }));

  // An element in a child frame is detected in that frame, and the handle remembers it.
  // The handle is read out of the packet rather than assumed: a page keeps a
  // control's number across recaptures and never hands it to another, so a
  // control this page has not addressed before takes the next number it has
  // not spent, whatever position it is in (see ../../stable-handles.ts).
  page = withElements(captured("product-catalog-largest"), [link(7)]);
  const framedPacket = await runtime.executeTool({ ...SCOPE, callId: "call.inspect.frame", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const framedHandle = (framedPacket.evidence as { elements: Array<{ target: string }> }).elements[0]!.target;
  commands.length = 0;
  const framed = await detect(runtime, { target: framedHandle });
  assert.equal(framed.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  assert.deepEqual(commands[1], { actionType: "web.dom.capture_snapshot", parameters: { detectStructure: { selector: '[data-testid="product-link"]' }, browserFrameId: 7 } });
  const binding = runtime.resolveExtractionHandle({ ...SCOPE, handle: (framed.evidence as WebLlmRepeatingStructure).extraction });
  assert.equal(binding.ok && binding.binding.frameId, 7);
});

/** A control, with whatever the case under test needs the capture to say about it. */
function control(name: string, extra: JsonObject = {}): JsonObject {
  const element: JsonObject = { tagName: "button", selector: `#${name.toLowerCase().replaceAll(" ", "-")}`, accessibleName: name };
  for (const [key, value] of Object.entries(extra)) element[key] = value;
  return element;
}

/** A control the page put in a record -- a row, a card -- named by that record's own words. */
function inRecord(name: string, record: string): JsonObject {
  return control(name, { context: { record: { text: record } } });
}

/** A page whose detection refuses, with the elements and page facts the case needs. */
function refusing(refused: string, page: Omit<FakePage, "structure">): FakePage {
  const next: FakePage = { url: page.url, structure: { ok: false, refused } };
  if (page.title !== undefined) next.title = page.title;
  if (page.elements !== undefined) next.elements = page.elements;
  if (page.evidence !== undefined) next.evidence = page.evidence;
  if (page.elementTotal !== undefined) next.elementTotal = page.elementTotal;
  return next;
}

const LISTING = "https://example.test/list";

/**
 * The defect this pins is `run-mug25fdp-21ba8385`: 24 of 30 build decisions
 * were this tool answered `no_repeating_structure`, 85 bytes each and
 * identical, and the build ended having executed nothing. One word stood for
 * four situations with four different next moves, so a model that had just
 * been told "no" had nothing to change and asked again.
 */
test("each way a page can have no readable list is its own refusal, with the counts behind it", async () => {
  const cases: ReadonlyArray<readonly [string, FakePage, JsonObject]> = [
    // The page repeats -- its controls sit in two records -- and the detection
    // would read none of it. Naming one of those rows is the move.
    ["records", refusing("no_repeating_run", { url: LISTING, elements: [control("Search"), control("Filter"), inRecord("Open", "First listing"), inRecord("Open", "Second listing")] }),
      { reason: "repeating_groups_not_readable", instead: ["target.3", "target.4"], groupsSeen: 2, rowsSeen: 0, controlsSeen: 4 }],
    // The same answer from the other repetition signal: one control the page
    // says it drew twelve times.
    ["repeats", refusing("no_repeating_run", { url: LISTING, elements: [control("Search"), control("Filter"), control("Sort"), control("Open", { repeatCount: 12 })] }),
      { reason: "repeating_groups_not_readable", instead: ["target.4"], groupsSeen: 0, rowsSeen: 12, controlsSeen: 4 }],
    // A working page with nothing on it that repeats: this is not where the list is.
    ["nothing repeats", refusing("no_repeating_run", { url: LISTING, elements: [control("Search"), control("Filter"), control("Sort"), control("Help")], elementTotal: 9 }),
      { reason: "nothing_repeats_on_page", groupsSeen: 0, rowsSeen: 0, controlsSeen: 9 }],
    // Almost nothing on it at all: the shape of a robot check.
    ["bare", refusing("no_repeating_run", { url: LISTING, elements: [control("Verify you are human")] }),
      { reason: "page_is_not_the_content", groupsSeen: 0, rowsSeen: 0, controlsSeen: 1 }],
    // A modal stands over it, so nothing behind the modal was readable.
    ["modal", refusing("no_repeating_run", {
      url: LISTING,
      elements: [control("Search"), control("Filter"), control("Sort"), inRecord("Open", "First listing")],
      evidence: { dialogs: { open: [{ selector: "#consent", role: "dialog", modal: true, native: false, label: "Before you continue" }] } }
    }), { reason: "page_is_not_the_content", instead: ["target.4"], groupsSeen: 1, rowsSeen: 0, controlsSeen: 4 }],
    // Something is painted over the controls, which is the same answer for the
    // same reason: what was captured is not the content.
    ["overlay", refusing("no_repeating_run", {
      url: LISTING,
      elements: [control("Search"), control("Filter"), control("Sort"), control("Help")],
      evidence: { overlays: { blockers: [{ selector: "#wall", role: "banner", label: "Checking your browser", blocks: 12, blocked: [] }] } }
    }), { reason: "page_is_not_the_content", groupsSeen: 0, rowsSeen: 0, controlsSeen: 4 }]
  ];
  for (const [name, page, detail] of cases) {
    const { gateway } = fakeGateway(() => page);
    const refusal = await detect(createWebAutomationLlmEvidenceRuntime(gateway));
    assert.deepEqual(refusal, rejection("no_repeating_structure", detail), name);
    // The counts are all a refusal may add: no word of the page rides with them.
    const wire = JSON.stringify(refusal);
    for (const word of ["listing", "Search", "Filter", "consent", "wall", "Checking", "Before you", "#"]) {
      assert.equal(wire.includes(word), false, `${name} refusal quotes ${word}`);
    }
  }
});

test("a page refusal about the target says which way the handle stopped naming one list, and a sensitive run stays a bare code", async () => {
  const card = (name: string): JsonObject => ({ tagName: "a", selector: '[data-testid="card-link"]', accessibleName: name, attributes: { href: "/listings/1", "data-testid": "card-link" } });
  let page: FakePage = refusing("no_repeating_run", { url: LISTING, elements: [control("Search"), control("Filter"), control("Sort"), card("A listing")] });
  const { gateway, commands } = fakeGateway(() => page);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.inspect.refusals", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const target = (inspected.evidence as { elements: Array<{ target: string; tag: string }> }).elements.find((element) => element.tag === "a")!.target;

  // The page looked where the call pointed and found no repeating children
  // there, so it was asked again as a whole, and found none there either. The
  // refusal is then about the page, not the target, and says so.
  commands.length = 0;
  assert.deepEqual(await detect(runtime, { target }), rejection("no_repeating_structure", {
    reason: "nothing_repeats_on_page", target, groupsSeen: 0, rowsSeen: 0, controlsSeen: 4
  }), "no repeating run around the target, nor anywhere on the page");
  assert.deepEqual(commands.map((command) => command.parameters), [
    {},
    { detectStructure: { selector: '[data-testid="card-link"]' } },
    { detectStructure: {} }
  ], "the page was searched as a whole before anything was refused");

  // The selector the handle stands for names nothing in the frame the capture
  // ran in, and the selector it names elements of several runs, are the two
  // reasons this domain already has for a handle that stopped naming one
  // control. Both were a bare `target_unobserved` until now.
  page = refusing("target_not_found", { url: LISTING, elements: page.elements! });
  assert.deepEqual(await detect(runtime, { target }), rejection("target_unobserved", { reason: "handle_no_longer_on_page", target }));
  page = refusing("ambiguous_target", { url: LISTING, elements: page.elements! });
  assert.deepEqual(await detect(runtime, { target }), rejection("target_unobserved", { reason: "handle_names_several_now", target }));

  // A run whose every field is a sensitive control: the code is the whole of
  // what the model can act on, and nothing is added to it.
  page = refusing("sensitive_region", { url: LISTING, elements: page.elements! });
  assert.deepEqual(await detect(runtime, { target }), rejection("sensitive_value"));
  // Asking a second time is answered the same, and now says that it is the same
  // answer. One thing is added to a bare code after all, and it is the one
  // thing the code cannot say: that the model has already been told this. A
  // detection refused identically four times in a row is what ended
  // `run-mulryg6h-ff241a12` (`../../repeated-refusal.ts`).
  assert.deepEqual(await detect(runtime), rejection("sensitive_value", { reason: "answered_the_same_again", repeatedAnswer: 2 }));
});

/**
 * The defect this pins is `run-mulum3x7-18ceeb75`: on the everything store's
 * cart the model aimed the detection at the heading, the subtotal, the rows and
 * the buttons in turn, was refused `nothing_repeats_around_target` a dozen
 * times, and the build ended with no Flow. A target is where the page starts
 * looking, not a condition of finding anything
 * (`docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`).
 */
test("a target with no list around it gets the page's list, which names no target, rather than a refusal", async () => {
  const heading: JsonObject = { tagName: "h1", selector: "main h1", accessibleName: "Shopping Cart" };
  const page: FakePage = withElements(captured("product-catalog-largest"), [heading]);
  page.aroundTarget = { ok: false, refused: "no_repeating_run" };
  const { gateway, commands } = fakeGateway(() => page);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ ...SCOPE, callId: "call.inspect.outward", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const target = (inspected.evidence as { elements: Array<{ target: string }> }).elements[0]!.target;

  commands.length = 0;
  const found = await detect(runtime, { target });
  assert.equal(found.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  const packet = found.evidence as WebLlmRepeatingStructure;
  assert.equal(packet.target, undefined, "the list was found on the page, not around the target, and the packet does not claim otherwise");
  assert.equal(packet.itemCount, proposalOf(page.structure as WebAutomationStructureDetection).proposal.itemCount);
  assert.deepEqual(commands.map((command) => command.parameters), [
    {},
    { detectStructure: { selector: "main h1" } },
    { detectStructure: {} }
  ]);
  assertNothingAddressable(packet, page.structure as WebAutomationStructureDetection);
  const binding = runtime.resolveExtractionHandle({ ...SCOPE, handle: packet.extraction });
  assert.equal(binding.ok && binding.binding.extractList.item, proposalOf(page.structure as WebAutomationStructureDetection).proposal.item);
});

test("a malformed call reaches no page and is told which way it was malformed", async () => {
  const { gateway, commands } = fakeGateway(() => captured("data-table-largest"));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  // Each malformed call is told which way it was malformed, and a call whose
  // keys are wrong is told the keys the tool takes.
  const malformed: ReadonlyArray<readonly [JsonObject, JsonObject]> = [
    [{ extra: 1 }, { reason: "unexpected_input_keys", instead: ["target"] }],
    [{ target: "nope" }, { reason: "malformed_handle", target: "nope" }],
    [{ target: 3 }, { reason: "malformed_handle" }],
    [{ target: "target.1", extra: true }, { reason: "unexpected_input_keys", instead: ["target"] }]
  ];
  for (const [value, detail] of malformed) {
    assert.deepEqual(await detect(runtime, value), rejection("invalid_input", detail), JSON.stringify(value));
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
