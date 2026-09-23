// `resolvePlanNodeParameters`: the handles a model wrote into a plan node,
// made real through the runtime that showed them to it.
//
// What these rows are really proving:
// - a `selector` handle becomes the selector behind it -- the real one, which
//   the packet the model read never contained -- and a child frame's element
//   also names its frame. The node also carries its element's identity, which
//   `plan-node-identity.test.ts` covers; here it is only part of the expected
//   parameters;
// - an extraction handle becomes the request the detection kept, with the
//   plan's own bounds, held to the reader a dispatch is refused by;
// - a node with no handle is `unchanged`: a literal selector is never passed
//   off as resolved;
// - every way a handle cannot be made real refuses the node with a named code:
//   unknown, another Flow's, another project's, let go, ambiguous across pages,
//   misplaced, malformed, and in a different frame from the node -- followed by
//   where a handle of that kind goes, when the refusal is about where or how it
//   was written, and the position each reason applied at. The extraction
//   node's own placements and refusals are `extraction-slot.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  WEB_PLAN_HANDLE_ISSUE_CODES,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure,
  WEB_LLM_RUN_NODE_TOOL_ID
} from "../..";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const SELECT_NODE = webAutomationOutputNodeId("web.dom.select");
const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const NAVIGATE_NODE = webAutomationOutputNodeId("web.browser.navigate");
const SNAPSHOT_NODE = webAutomationOutputNodeId("web.dom.capture_snapshot");

const FORM_URL = "https://example.test/form";
const NAME_SELECTOR = 'input[name="name"]';
const nameField: JsonObject = { tagName: "input", selector: NAME_SELECTOR, inputType: "text", accessibleName: "Name", attributes: { name: "name", type: "text" } };
const submit: JsonObject = { tagName: "button", selector: "#submit", visibleText: "Submit" };
/** Who those two are, as a resolved node carries them. */
const NAME_IDENTITY: JsonObject = { tagName: "input", accessibleName: "Name", selector: NAME_SELECTOR };
const SUBMIT_IDENTITY: JsonObject = { tagName: "button", visibleText: "Submit", selector: "#submit" };

/** A click node resolved onto a described control that has only a tag, a selector and its text. */
function clickResolvedTo(selector: string, tagName: string, visibleText: string) {
  return { status: "resolved", parameters: { selector, element: { tagName, visibleText, selector } } };
}

type Page = { url: string; elements: JsonObject[]; structure?: JsonValue };

/** A runtime whose page is whatever the test says it is now, answering every capture with it. */
function runtimeOver(page: () => Page, onAction: (actionType: string) => void = () => undefined): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      onAction(command.actionType);
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const current = page();
      const snapshot: JsonObject = { url: current.url, title: "Fixture", interactiveElements: current.elements };
      return { status: "succeeded", payload: current.structure === undefined ? { snapshot } : { snapshot, structure: current.structure } };
    },
  });
}

let calls = 0;
async function inspect(runtime: WebAutomationLlmEvidenceRuntime, flowId = "flow.one") {
  calls += 1;
  return await runtime.executeTool({ projectId: "project.one", flowId, callId: `call.inspect.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject, scope: { projectId?: string; flowId?: string } = {}) {
  return await runtime.resolvePlanNodeParameters({ projectId: scope.projectId ?? "project.one", flowId: scope.flowId ?? "flow.one", nodeDefinitionId, parameters, declaredConsequences: NOTHING_LASTING });
}

const EXTRACTION_HINT = "web.handle.expected.extract_list.handle_fields_paginate";
const TARGET_HINT = "web.handle.expected.selector.handle_location";

function refusedWith(...issueCodes: string[]) {
  return { status: "refused", issueCodes };
}

/** A refusal for one reason at one position, with the placement it points to when it has one. */
function refusedAt(reason: string, position: string, hint?: string) {
  return refusedWith(reason, ...(hint ? [hint] : []), `${reason}:${position}`);
}

/**
 * These rows are about handles, not permission. Every step they stand for
 * declared that it causes nothing lasting, which is what a build writes for a
 * press that only reveals: `plan-step-permission.test.ts` holds the rest.
 */
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

test("a selector handle becomes the selector the exploration was shown, which the packet never held", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameField, submit] }));
  const shown = await inspect(runtime);
  assert.equal(JSON.stringify(shown).includes(NAME_SELECTOR), false, "the model never saw the selector");
  assert.equal(JSON.stringify(shown).includes("#submit"), false);

  // The live failure this exists for: the model guessed `input[name="Name"]`. Given the handle instead, the plan gets the real one.
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.1" }, text: "Ada", timeoutMs: 5_000 }), {
    status: "resolved",
    parameters: { selector: NAME_SELECTOR, text: "Ada", timeoutMs: 5_000, element: NAME_IDENTITY }
  });
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2", location: FORM_URL } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  // A node already naming the top frame keeps doing so.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2" }, browserFrameId: 0 }), { status: "resolved", parameters: { selector: "#submit", browserFrameId: 0, element: SUBMIT_IDENTITY } });
});

test("a target handle under the node's `target` or `element` parameter names its element as one under `selector` does", async () => {
  // The live refusal this exists for (`run-mu4vk93o-5f6675d7`): every web
  // element node lists a `target` parameter, the evidence names each element by
  // its `target`, and the model wrote the handle there on all three nodes. The
  // resolver accepted it only under `selector`, so each plan was refused
  // `web.handle.misplaced` and nothing was built.
  const planField: JsonObject = { tagName: "select", selector: 'select[name="plan"]', accessibleName: "Plan", attributes: { name: "plan" } };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameField, submit, planField] }));
  await inspect(runtime);

  assert.deepEqual(await resolve(runtime, TYPE_NODE, { target: { handle: "target.1" }, text: "Ada" }), {
    status: "resolved",
    parameters: { selector: NAME_SELECTOR, text: "Ada", element: NAME_IDENTITY }
  });
  const selected = await resolve(runtime, SELECT_NODE, { target: { handle: "target.3", location: FORM_URL }, value: "team" });
  assert.equal(selected.status, "resolved");
  assert.equal(selected.status === "resolved" && selected.parameters.selector, 'select[name="plan"]');
  assert.equal(selected.status === "resolved" && selected.parameters.value, "team");
  assert.equal(selected.status === "resolved" && "target" in selected.parameters, false, "the handle's slot does not stay behind as an adapted target");
  // The handle is the authority on the element: a selector the model wrote beside it is replaced, as its `element` is.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "target.2", location: FORM_URL }, selector: "button.guessed-submit" }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  // Both slots may name the element, only if they name the same one.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "target.2" }, selector: { handle: "target.2" } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "target.1" }, selector: { handle: "target.2" } }), refusedAt("web.handle.ambiguous", "target"));
  // `element` names the element too, and was refused live on its own and beside a `selector` handle (the campaign after `run-mu4vs7j1-aca950d7`).
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { element: { handle: "target.2" } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2" }, element: { handle: "target.2", location: FORM_URL } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { element: { handle: "target.1" }, target: { handle: "target.2" }, text: "Ada" }), refusedAt("web.handle.ambiguous", "element"));
  // It is a handle slot like `selector`, judged the same way.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "target.9" } }), refusedAt("web.handle.unknown", "target"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { element: { handle: "extraction.1" } }), refusedAt("web.handle.misplaced", "element", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "extraction.1" } }), refusedAt("web.handle.misplaced", "target", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { target: { handle: "target.2", extra: true } }), refusedAt("web.handle.malformed", "target", TARGET_HINT));
  // Only on a node that has an element to name; and an adapted target that names no handle is not this resolver's.
  assert.deepEqual(await resolve(runtime, NAVIGATE_NODE, { url: "https://example.test/", target: { handle: "target.1" } }), refusedAt("web.handle.misplaced", "target", TARGET_HINT));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: "#submit", target: { kind: "element", fingerprint: { tagName: "button" } } }), { status: "unchanged" });
});

test("a node with no handle is unchanged, and a literal selector is never passed off as resolved", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameField] }));
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: 'input[name="Name"]', text: "Ada" }), { status: "unchanged" });
  assert.deepEqual(await resolve(runtime, CLICK_NODE, {}), { status: "unchanged" });
  assert.deepEqual(await resolve(runtime, "builtin.data.write-records", { records: [{ handle: "a-user-handle" }] }), { status: "unchanged" });
  // An unrecognisable `handle` outside a handle slot is not this resolver's to judge.
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: NAME_SELECTOR, text: { handle: "not-a-handle" } }), { status: "unchanged" });
});

test("an extraction handle becomes the request the detection kept, with the plan's own bounds", async () => {
  const capture = CAPTURED_DETECTIONS["data-table-largest"];
  const runtime = runtimeOver(() => ({ url: capture.url, elements: [], structure: structuredClone(capture.structure) as JsonValue }));
  const detected = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const item = capture.structure.ok ? capture.structure.proposal.item : "";
  assert.equal(JSON.stringify(detected).includes(item), false, "the model never saw the item selector");

  const resolved = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle, minItems: 0 }, timeoutMs: 20_000 });
  assert.equal(resolved.status, "resolved");
  if (resolved.status !== "resolved") return;
  assert.deepEqual(resolved.parameters, {
    extractList: {
      item,
      fields: {
        product: { kind: "column", header: "Product", required: true },
        category: { kind: "column", header: "Category", required: true },
        price: { kind: "column", header: "Price", required: true },
        stock: { kind: "column", header: "Stock", required: true }
      },
      minItems: 0
    },
    timeoutMs: 20_000
  });
  assert.deepEqual((await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle, maxItems: 50 } })).status, "resolved");

  // Bounds the page would refuse, or clamp, are refused here instead.
  const malformed: Array<[JsonObject, string]> = [
    [{ handle, minItems: -1 }, "extractList"],
    [{ handle, maxItems: 5_000 }, "extractList.maxItems"],
    [{ handle, minItems: 20, maxItems: 10 }, "extractList"],
    [{ handle, fields: {} }, "extractList.fields"],
    [{ handle: 7 }, "extractList.handle"]
  ];
  for (const [extractList, position] of malformed) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), refusedAt("web.handle.malformed", position, EXTRACTION_HINT), JSON.stringify(extractList));
  }
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle }, }, { flowId: "flow.two" }), refusedAt("web.handle.unknown", "extractList"));
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: "extraction.999" } }), refusedAt("web.handle.unknown", "extractList"));
  // A literal request written after the list was detected can only be a guess at selectors the model was never shown.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { item: "tr", fields: { name: "td" } } }), refusedAt("web.handle.extraction_required", "extractList", EXTRACTION_HINT));
});

test("a let-go extraction handle is stale", async () => {
  const capture = CAPTURED_DETECTIONS["infinite-feed-largest"];
  const runtime = runtimeOver(() => ({ url: capture.url, elements: [], structure: structuredClone(capture.structure) as JsonValue }));
  const handles: string[] = [];
  for (let index = 0; index < 17; index += 1) {
    const result = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: `call.detect.${index}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
    handles.push((result.evidence as WebLlmRepeatingStructure).extraction);
  }
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: handles[0]! } }), refusedAt("web.handle.stale", "extractList"));
  const newest = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: handles[16]! } });
  assert.equal(newest.status, "resolved");
  assert.deepEqual(newest.status === "resolved" && (newest.parameters.extractList as JsonObject).paginate, { mode: "scroll", maxScrolls: 50 });
});

test("handles are resolved per page and numbered per Flow: a recapture replaces a page, and no bare handle names two controls", async () => {
  let page: Page = { url: "https://example.test/a", elements: [{ tagName: "button", selector: "#first", visibleText: "First" }] };
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  // A recapture of the same page is the model's new view of it -- but a
  // control it does not still hold is not quietly replaced by whatever now
  // stands where it stood. #first is gone, so its handle names nothing, and
  // #renamed is a control this Flow has not addressed before, so it is given a
  // number the Flow has never spent (see stable-handles.ts).
  page = { url: "https://example.test/a", elements: [{ tagName: "button", selector: "#renamed", visibleText: "Renamed" }] };
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" } }), refusedAt("web.handle.unknown", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2" } }), clickResolvedTo("#renamed", "button", "Renamed"));

  // Another page's control is given its own number, even at the same selector,
  // and both resolve bare: the plan writes them bare.
  page = { url: "https://example.test/b", elements: [{ tagName: "button", selector: "#renamed", visibleText: "Renamed" }] };
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.3" } }), clickResolvedTo("#renamed", "button", "Renamed"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2" } }), clickResolvedTo("#renamed", "button", "Renamed"));

  // A third page's control is another number again: nothing is ambiguous bare,
  // and a location beside a handle confirms the page that issued it.
  page = { url: "https://example.test/c", elements: [{ tagName: "a", selector: "#other", visibleText: "Other" }] };
  await inspect(runtime);
  for (const handle of ["target.2", "target.3", "target.4"]) {
    assert.equal((await resolve(runtime, CLICK_NODE, { selector: { handle } })).status, "resolved", handle);
  }
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.4" } }), clickResolvedTo("#other", "a", "Other"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.4", location: "https://example.test/c" } }), clickResolvedTo("#other", "a", "Other"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2", location: "https://example.test/a" } }), clickResolvedTo("#renamed", "button", "Renamed"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.4", location: "https://example.test/never" } }), refusedAt("web.handle.unknown", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2", location: "https://example.test/c" } }), refusedAt("web.handle.unknown", "selector"));

  // A page let go by the bounded store makes its handles stale, by location and bare.
  for (let index = 0; index < 8; index += 1) {
    page = { url: `https://example.test/more/${index}`, elements: [{ tagName: "button", selector: "#other", visibleText: "Other" }] };
    await inspect(runtime);
  }
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2", location: "https://example.test/a" } }), refusedAt("web.handle.stale", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.3" } }), refusedAt("web.handle.stale", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.12" } }), clickResolvedTo("#other", "button", "Other"));
});

test("a handle is this project and Flow's alone, and a reveal's recapture is what the plan resolves against", async () => {
  const more: JsonObject = { tagName: "button", selector: "#more", visibleText: "More", attributes: { "aria-expanded": "false" } };
  let expanded = false;
  const runtime = runtimeOver(
    () => ({ url: FORM_URL, elements: expanded ? [more, nameField] : [more] }),
    (actionType) => { if (actionType === "web.dom.click") expanded = true; }
  );
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" } }, { flowId: "flow.two" }), refusedAt("web.handle.unknown", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" } }, { projectId: "project.two" }), refusedAt("web.handle.unknown", "selector"));

  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" } }), refusedAt("web.handle.unknown", "selector"));
  const revealed = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.reveal", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });
  assert.equal(revealed.resultCode, "web.action.succeeded");
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" } }), { status: "resolved", parameters: { selector: NAME_SELECTOR, element: NAME_IDENTITY } });
});

test("a misplaced or malformed handle refuses the whole node, by name", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameField, submit] }));
  await inspect(runtime);
  // A target handle goes in an element node's selector; on the extraction node any handle was meant for its list.
  const misplaced: Array<[string, JsonObject, string, string]> = [
    [TYPE_NODE, { selector: NAME_SELECTOR, text: { handle: "target.1" } }, "text", TARGET_HINT],
    [NAVIGATE_NODE, { url: { handle: "target.1" } }, "url", TARGET_HINT],
    [SNAPSHOT_NODE, { selector: { handle: "target.1" } }, "selector", TARGET_HINT],
    [EXTRACT_LIST_NODE, { selector: { handle: "target.1" } }, "selector", EXTRACTION_HINT],
    [EXTRACT_LIST_NODE, { extractList: { handle: "target.1" } }, "extractList", EXTRACTION_HINT],
    [EXTRACT_LIST_NODE, { extractList: { item: { handle: "target.1" }, fields: { name: "td" } } }, "extractList.item", EXTRACTION_HINT],
    [CLICK_NODE, { selector: { handle: "extraction.1" } }, "selector", EXTRACTION_HINT],
    ["builtin.policy.action", { outputId: "web.dom.click", parameters: { selector: { handle: "target.2" } }, recordOutput: { handle: "target.1" } }, "recordOutput", TARGET_HINT]
  ];
  for (const [node, parameters, position, hint] of misplaced) {
    assert.deepEqual(await resolve(runtime, node, parameters), refusedAt("web.handle.misplaced", position, hint), `${node} ${JSON.stringify(parameters)}`);
  }
  // Core's Run Output node runs its payload as the named web output, so a handle there is resolved as that output's node resolves it.
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.click", parameters: { selector: { handle: "target.2" } } }), {
    status: "resolved",
    parameters: { outputId: "web.dom.click", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } }
  });
  const malformed: JsonObject[] = [
    { selector: { handle: "target.x" } },
    // Past the widest number a Flow issues (`stable-handles.ts`).
    { selector: { handle: "target.10000" } },
    { selector: { handle: "target.0" } },
    { selector: { handle: 5 } },
    { selector: { handle: "target.1", extra: true } },
    { selector: { handle: "target.1", location: 3 } },
    { selector: { handle: "target.1", location: "" } }
  ];
  for (const parameters of malformed) {
    assert.deepEqual(await resolve(runtime, CLICK_NODE, parameters), refusedAt("web.handle.malformed", "selector", TARGET_HINT), JSON.stringify(parameters));
  }
  // Nothing of a refused node is resolved, and every reason is named once, in a fixed order, before where each applied.
  assert.deepEqual(
    await resolve(runtime, TYPE_NODE, { selector: { handle: "target.9" }, text: { handle: "target.1" } }),
    refusedWith("web.handle.misplaced", "web.handle.unknown", TARGET_HINT, "web.handle.unknown:selector", "web.handle.misplaced:text")
  );
  assert.deepEqual([...WEB_PLAN_HANDLE_ISSUE_CODES], [
    "web.handle.malformed",
    "web.handle.misplaced",
    "web.handle.unknown",
    "web.handle.stale",
    "web.handle.ambiguous",
    "web.handle.not_unique",
    "web.handle.frame_mismatch",
    "web.handle.unknown_field",
    "web.handle.extraction_required",
    "web.handle.wrong_control",
    EXTRACTION_HINT,
    TARGET_HINT
  ]);
});

test("a handle naming a control this step cannot act on refuses the node here, not on the page", async () => {
  // Live, a created Flow chose an option in a button and the run failed at
  // verification with "expected a select element to choose value 5 in, actual
  // the target is a <button>" (`run-mu6cedna-3dd46e49`). The packet named both
  // controls' tags, so the mistake was correctable while the evidence was
  // still in front of the model.
  const chooser: JsonObject = { tagName: "select", selector: "#band", accessibleName: "Price band" };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [submit, chooser] }));
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, SELECT_NODE, { selector: { handle: "target.1" }, value: "5" }), refusedAt("web.handle.wrong_control", "selector"));
  assert.deepEqual(await resolve(runtime, SELECT_NODE, { selector: { handle: "target.2" }, value: "5" }), {
    status: "resolved",
    parameters: { selector: "#band", value: "5", element: { tagName: "select", accessibleName: "Price band", selector: "#band" } }
  });
  // Entering text into something that can never hold any is refused the same way.
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.1" }, text: "Ada" }), refusedAt("web.handle.wrong_control", "selector"));
  // A click names no kind of control, so nothing here constrains it.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
});

test("a selector the page gave to several controls is refused rather than acted on at the first of them", async () => {
  // What the real product catalog does: every card's link is captured under one selector.
  const link = (name: string): JsonObject => ({ tagName: "a", selector: '[data-testid="product-link"]', accessibleName: name, attributes: { href: `/p/${name}`, "data-testid": "product-link" } });
  let page: Page = { url: "https://example.test/catalog", elements: [submit, link("one"), link("two")] };
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.3" } }), refusedAt("web.handle.not_unique", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2", location: "https://example.test/catalog" } }), refusedAt("web.handle.not_unique", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" } }), { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  // A page that describes the link alone does not make the other page's shared
  // selector unique; its own link is its own control, with a number of its own.
  page = { url: "https://example.test/other", elements: [submit, link("one")] };
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.2" } }), refusedAt("web.handle.not_unique", "selector"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.5", location: "https://example.test/other" } }), {
    status: "resolved",
    parameters: { selector: '[data-testid="product-link"]', element: { tagName: "a", accessibleName: "one", selector: '[data-testid="product-link"]' } }
  });
  // In another frame, the same selector is a different address.
  const framedLink: JsonObject = { tagName: "a", selector: 'frame[4] >> [data-testid="product-link"]', accessibleName: "framed", attributes: { href: "/p/framed", "data-testid": "product-link", "data-fluxiq-frame-id": "4" } };
  page = { url: "https://example.test/framed", elements: [link("top"), framedLink] };
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.7", location: "https://example.test/framed" } }), {
    status: "resolved",
    parameters: { selector: '[data-testid="product-link"]', element: { tagName: "a", accessibleName: "framed", selector: '[data-testid="product-link"]' }, browserFrameId: 4 }
  });
});

test("a child frame's element names its frame, and a node naming another frame is refused", async () => {
  const framed: JsonObject = { tagName: "input", selector: `frame[7] >> ${NAME_SELECTOR}`, inputType: "text", accessibleName: "Name", attributes: { name: "name", type: "text", "data-fluxiq-frame-id": "7" } };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [submit, framed] }));
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" }, text: "Ada" }), {
    status: "resolved",
    parameters: { selector: NAME_SELECTOR, text: "Ada", element: NAME_IDENTITY, browserFrameId: 7 }
  });
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" }, browserFrameId: 7 }), { status: "resolved", parameters: { selector: NAME_SELECTOR, browserFrameId: 7, element: NAME_IDENTITY } });
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" }, browserFrameId: 3 }), refusedAt("web.handle.frame_mismatch", "browserFrameId"));
  assert.deepEqual(await resolve(runtime, TYPE_NODE, { selector: { handle: "target.2" }, browserFrameId: 0 }), refusedAt("web.handle.frame_mismatch", "browserFrameId"));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: "target.1" }, browserFrameId: 7 }), refusedAt("web.handle.frame_mismatch", "browserFrameId"));
});
