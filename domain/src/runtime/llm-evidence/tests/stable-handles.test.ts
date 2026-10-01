// A target handle keeps naming one control while a page is recaptured, and
// names no other control anywhere in the Flow.
//
// The first measurement: with `[banner, beds, band, search]`, `t2`
// resolved to the Bedrooms select; the banner was dismissed, the page
// recaptured, and the same `t2` resolved to the Price-band select with no
// refusal anywhere. Live, a created Flow chose a filter's handle and the run
// failed with `expected a select element to choose value "5" in, actual the
// target is a <button>` (`run-mu6btt9u-8ba762fd`).
//
// The second: every page numbered its controls from `t1`, so once an
// exploration had seen two pages a bare `target: t7` in the plan named a
// different control on each, and the resolver refused it `web.handle.ambiguous`
// -- in 6 of E1 lane B's 12 builds on the realistic stores. The rows below hold
// both halves: what the model is shown, and what the plan resolver answers.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_PRESS_TOOL_ID, type WebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID
} from "..";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../sanitize";
import { createWebLlmStableTargetHandles, WEB_LLM_TARGET_HANDLE_MAX_NUMBER, WEB_LLM_TARGET_HANDLE_PATTERN } from "../stable-handles";
import { shownPageLines } from "../page-view/tests/shown-page-lines";

const PAGE_URL = "https://example.test/search";
const OTHER_URL = "https://example.test/other";
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");

const banner: JsonObject = { tagName: "button", selector: "#cookies", visibleText: "Got it" };
const beds: JsonObject = { tagName: "select", selector: "#beds", accessibleName: "Bedrooms" };
const band: JsonObject = { tagName: "select", selector: "#band", accessibleName: "Price band" };
const search: JsonObject = { tagName: "button", selector: "#search", visibleText: "Search" };

/** A runtime whose page is whatever the test says it is now. */
function runtimeOver(page: () => { url: string; elements: JsonObject[] }): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const current = page();
      return { status: "succeeded", payload: { snapshot: { url: current.url, title: "Fixture", interactiveElements: current.elements } } };
    }
  });
}

let calls = 0;
async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<Array<{ target: string; name: string }>> {
  calls += 1;
  const result = await runtime.executeTool({ projectId: "p", flowId: "f", callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  return shownPageLines(result.evidence).map((line) => ({ target: line.target, name: line.words ?? "" }));
}

async function selectorFor(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<string | undefined> {
  const resolved = await runtime.resolvePlanNodeParameters({ projectId: "p", flowId: "f", nodeDefinitionId: CLICK_NODE, parameters: { target: { handle } }, declaredConsequences: NOTHING_LASTING });
  return resolved.status === "resolved" ? resolved.parameters.selector as string : undefined;
}

/**
 * These rows are about handles, not permission. Every step they stand for
 * declared that it causes nothing lasting, which is what a build writes for a
 * press that only reveals: `plan-step-permission.test.ts` holds the rest.
 */
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

test("a control keeps its handle when the page around it is recaptured", async () => {
  let elements = [banner, beds, band, search];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));

  const first = await inspect(runtime);
  assert.deepEqual(first, [
    { target: "t1", name: "Got it" },
    { target: "t2", name: "Bedrooms" },
    { target: "t3", name: "Price band" },
    { target: "t4", name: "Search" }
  ]);
  assert.equal(await selectorFor(runtime, "t2"), "#beds");

  // The banner is dismissed, exactly as a successful reveal leaves the page,
  // and the page is captured again.
  elements = [beds, band, search];
  const second = await inspect(runtime);
  assert.deepEqual(second, [
    { target: "t2", name: "Bedrooms" },
    { target: "t3", name: "Price band" },
    { target: "t4", name: "Search" }
  ], "the surviving controls keep the numbers the model already read");
  assert.equal(await selectorFor(runtime, "t2"), "#beds", "and the plan resolver still answers with the same control");
  assert.equal(await selectorFor(runtime, "t4"), "#search");
});

test("a control the page adds is given a number the page has never spent", async () => {
  let elements = [beds, search];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t1", "t2"]);

  elements = [beds, band, search];
  const grown = await inspect(runtime);
  assert.deepEqual(grown, [
    { target: "t1", name: "Bedrooms" },
    { target: "t3", name: "Price band" },
    { target: "t2", name: "Search" }
  ], "the new control takes the next free number rather than one already read");
  assert.equal(await selectorFor(runtime, "t2"), "#search");
  assert.equal(await selectorFor(runtime, "t3"), "#band");
});

test("another page's controls are given numbers no page has spent, so a bare handle names one control", async () => {
  let page = { url: PAGE_URL, elements: [banner, beds] };
  const runtime = runtimeOver(() => page);
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t1", "t2"]);
  page = { url: OTHER_URL, elements: [search, band] };
  assert.deepEqual(await inspect(runtime), [
    { target: "t3", name: "Search" },
    { target: "t4", name: "Price band" }
  ]);
  // The plan names them bare, as the Flow script format writes a step's target,
  // and every one of them resolves -- none is `web.handle.ambiguous`.
  assert.equal(await selectorFor(runtime, "t1"), "#cookies");
  assert.equal(await selectorFor(runtime, "t2"), "#beds");
  assert.equal(await selectorFor(runtime, "t3"), "#search");
  assert.equal(await selectorFor(runtime, "t4"), "#band");
  // Back on the first page, its controls still have the numbers the model read.
  page = { url: PAGE_URL, elements: [banner, beds] };
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t1", "t2"]);
});

test("the same selector on two pages is two pages' controls, each with its own number", async () => {
  // The header's search box: one selector on every page of the store.
  let page = { url: PAGE_URL, elements: [search] };
  const runtime = runtimeOver(() => page);
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t1"]);
  page = { url: OTHER_URL, elements: [search] };
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t2"]);
  assert.equal(await selectorFor(runtime, "t1"), "#search");
  assert.equal(await selectorFor(runtime, "t2"), "#search");
});

test("numbers belong to one Flow: another Flow's first control is t1 again", async () => {
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements: [banner, beds] }));
  await inspect(runtime);
  const result = await runtime.executeTool({ projectId: "p", flowId: "another", callId: "call.other", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const targets = shownPageLines(result.evidence).map((line) => line.target);
  assert.deepEqual(targets, ["t1", "t2"]);
});

/** Forty controls on one page of their own. */
function crowdedPage(page: number): { url: string; elements: JsonObject[] } {
  return {
    url: `https://example.test/page-${page}`,
    elements: Array.from({ length: 40 }, (_, index) => ({ tagName: "button", selector: `#p${page}-b${index}`, visibleText: `Page ${page} button ${index}` }))
  };
}

test("an exploration that sees more than ninety-nine controls is handed numbers past 99, and every tool and the plan take them", async () => {
  let page = crowdedPage(1);
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  page = crowdedPage(2);
  await inspect(runtime);
  page = crowdedPage(3);
  const third = await inspect(runtime);
  assert.deepEqual([third[0]?.target, third.at(-1)?.target], ["t81", "t120"]);
  assert.equal(await selectorFor(runtime, "t120"), "#p3-b39");
  assert.equal(await selectorFor(runtime, "t1"), "#p1-b0", "the first page's controls still resolve, bare");

  // Every authoring tool that names a target declares the same pattern.
  for (const tool of runtime.tools) {
    const properties = tool.inputSchema.properties as Record<string, { pattern?: string }> | undefined;
    if (properties?.target !== undefined) assert.equal(properties.target.pattern, WEB_LLM_TARGET_HANDLE_PATTERN, tool.toolId);
  }
  const pattern = new RegExp(WEB_LLM_TARGET_HANDLE_PATTERN, "u");
  assert.ok(pattern.test("t120") && pattern.test(`t${WEB_LLM_TARGET_HANDLE_MAX_NUMBER}`));
  assert.ok(!pattern.test(`t${WEB_LLM_TARGET_HANDLE_MAX_NUMBER + 1}`) && !pattern.test("t0") && !pattern.test("t07"));
  // The old spelling is still read, over the same numbers (t223).
  assert.ok(pattern.test("target.120") && !pattern.test("target.0") && !pattern.test(`target.${WEB_LLM_TARGET_HANDLE_MAX_NUMBER + 1}`));

  // A press on a three-digit handle is bound and pressed: the fixture page does
  // not change, so it comes back `no_progress` -- not `invalid_input`, which is
  // a handle the tool would not read, nor `target_unobserved`, one it could not bind.
  const pressed = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "t120" } }, consequences: [] } });
  // The press runs: a node that ran and succeeded is a step of the Flow
  // whatever the packet then looks like.
  assert.equal((pressed as { resultCode?: string }).resultCode, "web.action.succeeded");
});

test("a Flow that has spent every number starts again rather than handing one control's number to another", () => {
  const handles = createWebLlmStableTargetHandles();
  const scope = { projectId: "p", flowId: "f" };
  // A packet is the whole page now, so pages are large: five thousand
  // elements each, bound by hand rather than sanitized, since what is under
  // test is the numbering.
  const perPage = 5_000;
  const pages = Math.ceil(WEB_LLM_TARGET_HANDLE_MAX_NUMBER / perPage);
  let last: string[] = [];
  for (let page = 1; page <= pages; page += 1) {
    last = handles.restamp(scope, largeBinding(page, perPage)).evidence.elements.map((element) => element.target);
    for (const target of [last[0]!, last.at(-1)!]) assert.ok(Number(target.slice(1)) <= WEB_LLM_TARGET_HANDLE_MAX_NUMBER, target);
  }
  // 199 pages spent 995,000 numbers; the 200th page's 5,000 would pass 999,999.
  assert.deepEqual([last[0], last.at(-1)], ["t1", "t5000"]);
});

/** A binding of `count` elements on its own page, as `sanitize.ts` would issue it. */
function largeBinding(page: number, count: number): WebLlmSnapshotBinding {
  const selectors = new Map<string, string>();
  const elements = Array.from({ length: count }, (_, index) => {
    selectors.set(`t${index + 1}`, `#p${page}-e${index}`);
    return { target: `t${index + 1}`, tag: "button" };
  });
  return {
    evidence: { schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: `https://example.test/page-${page}`, elements, truncated: false },
    selectors,
    records: new Map()
  };
}

test("a page of twelve thousand elements is numbered past four digits, and a five-digit handle is taken and pressed", async () => {
  const page = { url: "https://example.test/huge", elements: Array.from({ length: 12_000 }, (_, index): JsonObject => ({ tagName: "button", selector: `#huge-${index}`, visibleText: `Huge ${index}` })) };
  const runtime = runtimeOver(() => page);
  const seen = await inspect(runtime);
  assert.equal(seen.length, 12_000);
  assert.deepEqual([seen[0]?.target, seen.at(-1)?.target], ["t1", "t12000"]);
  assert.equal(await selectorFor(runtime, "t12000"), "#huge-11999");
  const pressed = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.press.huge", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "t12000" } }, consequences: [] } });
  assert.equal((pressed as { resultCode?: string }).resultCode, "web.action.succeeded");
});

// A row control's selector is positional: row one's checkbox is
// `tr:nth-of-type(1) > td:nth-of-type(1) > input` whichever post is in row one.
// Filtering the social scheduler's queue puts another post there, and keyed by
// the selector alone the first post's number went to the second post's
// checkbox. The snapshot now shows one row per repeated control
// (`apps/extension/src/content/repeat-exemplars.ts`), and that row is the first
// one -- the row a filter replaces -- so the record rides in the address too.
const ROW_ONE_CHECKBOX = '[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input';

function rowOneCheckbox(key: string, slot: string): JsonObject {
  return {
    tagName: "input",
    inputType: "checkbox",
    selector: ROW_ONE_CHECKBOX,
    accessibleName: `Select the post for ${slot}`,
    repeatCount: 280,
    context: { tablePosition: { row: 2, column: 1 }, record: { keyAttribute: "data-post-id", key } }
  };
}

const retry: JsonObject = { tagName: "button", selector: "#retry", visibleText: "Retry" };

test("a row control whose row now holds another record is given a number of its own", async () => {
  let elements = [retry, rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  assert.deepEqual(await inspect(runtime), [
    { target: "t1", name: "Retry" },
    { target: "t2", name: "Select the post for Mon 21 Sep 2026, 09:00" }
  ]);

  // The queue is filtered: another post is in row one, at the same selector.
  elements = [retry, rowOneCheckbox("pst_b", "Mon 21 Sep 2026, 06:00")];
  assert.deepEqual(await inspect(runtime), [
    { target: "t1", name: "Retry" },
    { target: "t3", name: "Select the post for Mon 21 Sep 2026, 06:00" }
  ], "the second post's checkbox is not handed the first post's number");
  assert.equal(await selectorFor(runtime, "t2"), undefined, "the first post's number now resolves to nothing, not to the second post");
  assert.equal(await selectorFor(runtime, "t3"), ROW_ONE_CHECKBOX);

  // The filter is cleared and the first post is back in row one: it has its own number back.
  elements = [retry, rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t1", "t2"]);
  assert.equal(await selectorFor(runtime, "t2"), ROW_ONE_CHECKBOX);
});

test("a row control that stays in its record keeps its number, as every other control does", async () => {
  let elements = [retry, rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  await inspect(runtime);
  // The bulk bar comes and goes above the table; the row does not change.
  elements = [rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["t2"]);
  assert.equal(await selectorFor(runtime, "t2"), ROW_ONE_CHECKBOX);
});

// A hidden element never changes a visible element's handle (t223). A search
// captures hidden elements as well, and a model that searched and then looked,
// or looked and then searched, must find every visible control under the
// number it was already given.

const HIDDEN_PAGE = "https://shop.test/results";
const HIDDEN_SCOPE = { projectId: "p", flowId: "f" };

/** The page as a look captures it: rendered elements only. */
const lookCapture = [
  { tagName: "main", selector: "main" },
  { tagName: "a", selector: "#first", visibleText: "First", href: "/first", parent: 0 },
  // Two rendered copies share one selector, so the occurrence is part of their address.
  { tagName: "button", selector: ".add", visibleText: "Add", parent: 0 },
  { tagName: "button", selector: ".add", visibleText: "Add", parent: 0 },
  { tagName: "a", selector: "#second", visibleText: "Second", href: "/second", parent: 0 }
];

/** The same page as a search captures it: hidden elements interleaved, one of them sharing the rendered buttons' selector and coming first. */
const searchCapture = [
  lookCapture[0],
  { tagName: "div", selector: "#menu", hidden: true, parent: 0 },
  { tagName: "a", selector: "#first", visibleText: "First", href: "/first", parent: 1 },
  { tagName: "button", selector: ".add", visibleText: "Add", hidden: true, parent: 0 },
  lookCapture[2],
  lookCapture[3],
  { tagName: "input", selector: "#trap", hidden: true, parent: 0 },
  lookCapture[4]
];

function handlesByWords(binding: WebLlmSnapshotBinding): Array<[string, string]> {
  return binding.evidence.elements.filter((element) => element.hidden !== true)
    .map((element) => [element.target, `${element.tag} ${element.text ?? ""} ${binding.selectors.get(element.target) ?? ""}`]);
}

test("the same page captured with and without hidden elements gives every visible element the same handle, whichever comes first", () => {
  for (const order of [["look", "search"], ["search", "look"]] as const) {
    const handles = createWebLlmStableTargetHandles();
    const captured = new Map<string, WebLlmSnapshotBinding>();
    for (const which of order) {
      const raw = { url: HIDDEN_PAGE, interactiveElements: which === "look" ? lookCapture : searchCapture };
      captured.set(which, handles.restamp(HIDDEN_SCOPE, sanitizeWebLlmSnapshotWithBindings(raw)));
    }
    const lookHandles = handlesByWords(captured.get("look") as WebLlmSnapshotBinding);
    const searchHandles = handlesByWords(captured.get("search") as WebLlmSnapshotBinding);
    assert.deepEqual(searchHandles, lookHandles, `${order.join(" then ")}: every visible element keeps its handle`);
    assert.deepEqual(lookHandles.map(([handle]) => handle), ["t1", "t2", "t3", "t4", "t5"], `${order.join(" then ")}: visible elements are numbered first`);
  }
});

test("a renumbered parent still names the element's ancestor", () => {
  const handles = createWebLlmStableTargetHandles();
  // Spend t1 on another page so this page's numbers are not its positions.
  handles.restamp(HIDDEN_SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: "https://shop.test/", interactiveElements: [{ tagName: "a", selector: "#home", visibleText: "Home", href: "/" }] }));
  const binding = handles.restamp(HIDDEN_SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: HIDDEN_PAGE, interactiveElements: searchCapture }));
  const byHandle = new Map(binding.evidence.elements.map((element) => [element.target, element]));
  for (const element of binding.evidence.elements) {
    if (element.parent === undefined) continue;
    const parent = byHandle.get(element.parent);
    assert.ok(parent !== undefined, `${element.target}'s parent ${element.parent} is an element of the packet`);
  }
  const first = binding.evidence.elements.find((element) => element.text === "First");
  assert.equal(byHandle.get(first?.parent ?? "")?.tag, "div", "the link inside the hidden menu still names the menu");
  const main = binding.evidence.elements.find((element) => element.tag === "main");
  assert.equal(main?.target, "t2");
  assert.equal(binding.evidence.elements.find((element) => element.text === "Second")?.parent, "t2");
});

// Layers that come and go (C1, `run-mup2i28c-6c7fc209`). A popup, a dialog or a
// cookie banner the page puts beside its main column is one more `div` under
// `body`, and every positional selector behind it moves. The controls behind it
// keep their handles; the layer's own controls get handles of their own.

const STORE_URL = "https://shop.example/store";

/** The page's main column under `prefix`, its selectors written as the extension generates them. */
function mainColumn(prefix: string): JsonObject[] {
  return [
    { tagName: "button", selector: `${prefix} > header > button:nth-of-type(1)`, visibleText: "Pickup or delivery?" },
    { tagName: "a", selector: `${prefix} > main > a`, visibleText: "Wireless earbuds", attributes: { href: "/p/1" } },
    { tagName: "button", selector: `${prefix} > main > button`, visibleText: "Add to cart" }
  ];
}

function handlesOf(shown: Array<{ target: string; name: string }>, names: string[]): string[] {
  return names.map((name) => {
    const found = shown.find((line) => line.name === name);
    assert.ok(found, `${name} is shown: ${JSON.stringify(shown)}`);
    return found.target;
  });
}

const MAIN = ["Pickup or delivery?", "Wireless earbuds", "Add to cart"];

test("a popup inserted before the main column moves every position, and every control behind it keeps its handle", async () => {
  let elements = mainColumn("body > div");
  const runtime = runtimeOver(() => ({ url: STORE_URL, elements }));
  const before = handlesOf(await inspect(runtime), MAIN);

  const popup = [
    { tagName: "h2", selector: "body > div:nth-of-type(1) > h2", visibleText: "Get $10 off your first pickup order" },
    { tagName: "button", selector: "body > div:nth-of-type(1) > button", visibleText: "No thanks" }
  ];
  elements = [...popup, ...mainColumn("body > div:nth-of-type(2)")];
  const during = await inspect(runtime);
  assert.deepEqual(handlesOf(during, MAIN), before, "the controls behind the popup keep their handles");
  const [noThanks] = handlesOf(during, ["No thanks"]);
  assert.equal(before.includes(noThanks!), false, "the popup's own control is a control of its own");
  // The handle the model was shown still resolves, to where the control is now.
  assert.equal(await selectorFor(runtime, before[0]!), "body > div:nth-of-type(2) > header > button:nth-of-type(1)");

  elements = mainColumn("body > div");
  assert.deepEqual(handlesOf(await inspect(runtime), MAIN), before, "and keep them once it has closed");
  assert.equal(await selectorFor(runtime, before[0]!), "body > div > header > button:nth-of-type(1)");
});

test("a dialog that takes the main column's old position never takes its controls' handles", async () => {
  // The page already has two divs, so the main column's selectors are
  // positional from the start; the dialog opens first in the body and its
  // header button lands on exactly the main column's old selector.
  const footer = { tagName: "a", selector: "body > div:nth-of-type(2) > a", visibleText: "Help", attributes: { href: "/help" } };
  let elements: JsonObject[] = [...mainColumn("body > div:nth-of-type(1)"), footer];
  const runtime = runtimeOver(() => ({ url: STORE_URL, elements }));
  const before = handlesOf(await inspect(runtime), [...MAIN, "Help"]);

  const dialog = [
    { tagName: "div", selector: "body > div:nth-of-type(1)", role: "dialog", accessibleName: "Choose a store" },
    { tagName: "button", selector: "body > div:nth-of-type(1) > header > button:nth-of-type(1)", visibleText: "Close" }
  ];
  elements = [...dialog, ...mainColumn("body > div:nth-of-type(2)"), { ...footer, selector: "body > div:nth-of-type(3) > a" }];
  const during = await inspect(runtime);
  assert.deepEqual(handlesOf(during, [...MAIN, "Help"]), before);
  const [close] = handlesOf(during, ["Close"]);
  assert.equal(before.includes(close!), false, "the dialog's Close is not the store button that was at its selector");
  assert.equal(await selectorFor(runtime, close!), "body > div:nth-of-type(1) > header > button:nth-of-type(1)");
  assert.equal(await selectorFor(runtime, before[0]!), "body > div:nth-of-type(2) > header > button:nth-of-type(1)");
});

test("a cookie banner appended after the main column, and dismissed, leaves every handle where it was", async () => {
  let elements = mainColumn("body > div");
  const runtime = runtimeOver(() => ({ url: STORE_URL, elements }));
  const before = handlesOf(await inspect(runtime), MAIN);
  elements = [...mainColumn("body > div:nth-of-type(1)"), { tagName: "button", selector: "body > div:nth-of-type(2) > button", visibleText: "Accept all" }];
  const during = await inspect(runtime);
  assert.deepEqual(handlesOf(during, MAIN), before);
  const [accept] = handlesOf(during, ["Accept all"]);
  assert.equal(before.includes(accept!), false);
  elements = mainColumn("body > div");
  const after = await inspect(runtime);
  assert.deepEqual(handlesOf(after, MAIN), before);
  assert.equal(after.some((line) => line.target === accept), false, "the banner's handle left with it");
});

test("a control inside a shadow root keeps its handle when an overlay moves its host's position (the store button of run 34)", async () => {
  const storeButton = (hosts: string): JsonObject => ({ tagName: "button", selector: "button", visibleText: "Pickup or delivery?Carden Falls Supercenter", context: { shadowHosts: [hosts] } });
  let elements: JsonObject[] = [storeButton("body > div > header > div > vr-fulfillment-picker")];
  const runtime = runtimeOver(() => ({ url: STORE_URL, elements }));
  const [store] = handlesOf(await inspect(runtime), ["Pickup or delivery?Carden Falls Supercenter"]);
  elements = [storeButton("body > div:nth-of-type(1) > header > div > vr-fulfillment-picker"), { tagName: "button", selector: "body > div:nth-of-type(2) > button", visibleText: "Reject all" }];
  assert.deepEqual(handlesOf(await inspect(runtime), ["Pickup or delivery?Carden Falls Supercenter"]), [store]);
});

test("a button whose label a press changed keeps its handle, but a list whose items changed is not paired up by count", async () => {
  let elements: JsonObject[] = [
    { tagName: "button", selector: "main > button", visibleText: "Add to cart" },
    ...["Kinetra Buds", "Lumo Air", "Pulsebud Neo"].map((title, index) => ({ tagName: "a", selector: `ul > li:nth-of-type(${index + 1}) > a`, visibleText: title, attributes: { href: `/p/${index}` } }))
  ];
  const runtime = runtimeOver(() => ({ url: STORE_URL, elements }));
  const before = await inspect(runtime);
  const [add] = handlesOf(before, ["Add to cart"]);
  const oldItems = handlesOf(before, ["Kinetra Buds", "Lumo Air", "Pulsebud Neo"]);
  elements = [
    { tagName: "button", selector: "main > button", visibleText: "Added" },
    ...["Voltbay One", "Soundcore X", "Aria Mini"].map((title, index) => ({ tagName: "a", selector: `ul > li:nth-of-type(${index + 1}) > a`, visibleText: title, attributes: { href: `/p/${index + 10}` } }))
  ];
  const after = await inspect(runtime);
  assert.deepEqual(handlesOf(after, ["Added"]), [add]);
  const newItems = handlesOf(after, ["Voltbay One", "Soundcore X", "Aria Mini"]);
  for (const handle of newItems) assert.equal(oldItems.includes(handle), false, `${handle} was another product's`);
});
