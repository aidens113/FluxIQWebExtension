// A target handle keeps naming one control while a page is recaptured, and
// names no other control anywhere in the Flow.
//
// The first measurement: with `[banner, beds, band, search]`, `target.2`
// resolved to the Bedrooms select; the banner was dismissed, the page
// recaptured, and the same `target.2` resolved to the Price-band select with no
// refusal anywhere. Live, a created Flow chose a filter's handle and the run
// failed with `expected a select element to choose value "5" in, actual the
// target is a <button>` (`run-mu6btt9u-8ba762fd`).
//
// The second: every page numbered its controls from `target.1`, so once an
// exploration had seen two pages a bare `target: target.7` in the plan named a
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
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";
import { createWebLlmStableTargetHandles, WEB_LLM_TARGET_HANDLE_MAX_NUMBER, WEB_LLM_TARGET_HANDLE_PATTERN } from "../stable-handles";

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
  const elements = (result as unknown as { evidence: { elements: Array<{ target: string; name?: string; text?: string }> } }).evidence.elements;
  return elements.map((element) => ({ target: element.target, name: element.name ?? element.text ?? "" }));
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
    { target: "target.1", name: "Got it" },
    { target: "target.2", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.4", name: "Search" }
  ]);
  assert.equal(await selectorFor(runtime, "target.2"), "#beds");

  // The banner is dismissed, exactly as a successful reveal leaves the page,
  // and the page is captured again.
  elements = [beds, band, search];
  const second = await inspect(runtime);
  assert.deepEqual(second, [
    { target: "target.2", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.4", name: "Search" }
  ], "the surviving controls keep the numbers the model already read");
  assert.equal(await selectorFor(runtime, "target.2"), "#beds", "and the plan resolver still answers with the same control");
  assert.equal(await selectorFor(runtime, "target.4"), "#search");
});

test("a control the page adds is given a number the page has never spent", async () => {
  let elements = [beds, search];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1", "target.2"]);

  elements = [beds, band, search];
  const grown = await inspect(runtime);
  assert.deepEqual(grown, [
    { target: "target.1", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.2", name: "Search" }
  ], "the new control takes the next free number rather than one already read");
  assert.equal(await selectorFor(runtime, "target.2"), "#search");
  assert.equal(await selectorFor(runtime, "target.3"), "#band");
});

test("another page's controls are given numbers no page has spent, so a bare handle names one control", async () => {
  let page = { url: PAGE_URL, elements: [banner, beds] };
  const runtime = runtimeOver(() => page);
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1", "target.2"]);
  page = { url: OTHER_URL, elements: [search, band] };
  assert.deepEqual(await inspect(runtime), [
    { target: "target.3", name: "Search" },
    { target: "target.4", name: "Price band" }
  ]);
  // The plan names them bare, as the Flow script format writes a step's target,
  // and every one of them resolves -- none is `web.handle.ambiguous`.
  assert.equal(await selectorFor(runtime, "target.1"), "#cookies");
  assert.equal(await selectorFor(runtime, "target.2"), "#beds");
  assert.equal(await selectorFor(runtime, "target.3"), "#search");
  assert.equal(await selectorFor(runtime, "target.4"), "#band");
  // Back on the first page, its controls still have the numbers the model read.
  page = { url: PAGE_URL, elements: [banner, beds] };
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1", "target.2"]);
});

test("the same selector on two pages is two pages' controls, each with its own number", async () => {
  // The header's search box: one selector on every page of the store.
  let page = { url: PAGE_URL, elements: [search] };
  const runtime = runtimeOver(() => page);
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1"]);
  page = { url: OTHER_URL, elements: [search] };
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.2"]);
  assert.equal(await selectorFor(runtime, "target.1"), "#search");
  assert.equal(await selectorFor(runtime, "target.2"), "#search");
});

test("numbers belong to one Flow: another Flow's first control is target.1 again", async () => {
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements: [banner, beds] }));
  await inspect(runtime);
  const result = await runtime.executeTool({ projectId: "p", flowId: "another", callId: "call.other", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const targets = (result as unknown as { evidence: { elements: Array<{ target: string }> } }).evidence.elements.map((element) => element.target);
  assert.deepEqual(targets, ["target.1", "target.2"]);
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
  assert.deepEqual([third[0]?.target, third.at(-1)?.target], ["target.81", "target.120"]);
  assert.equal(await selectorFor(runtime, "target.120"), "#p3-b39");
  assert.equal(await selectorFor(runtime, "target.1"), "#p1-b0", "the first page's controls still resolve, bare");

  // Every authoring tool that names a target declares the same pattern.
  for (const tool of runtime.tools) {
    const properties = tool.inputSchema.properties as Record<string, { pattern?: string }> | undefined;
    if (properties?.target !== undefined) assert.equal(properties.target.pattern, WEB_LLM_TARGET_HANDLE_PATTERN, tool.toolId);
  }
  const pattern = new RegExp(WEB_LLM_TARGET_HANDLE_PATTERN, "u");
  assert.ok(pattern.test("target.120") && pattern.test(`target.${WEB_LLM_TARGET_HANDLE_MAX_NUMBER}`));
  assert.ok(!pattern.test(`target.${WEB_LLM_TARGET_HANDLE_MAX_NUMBER + 1}`) && !pattern.test("target.0") && !pattern.test("target.07"));

  // A press on a three-digit handle is bound and pressed: the fixture page does
  // not change, so it comes back `no_progress` -- not `invalid_input`, which is
  // a handle the tool would not read, nor `target_unobserved`, one it could not bind.
  const pressed = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.120" } }, consequences: [] } });
  // The press runs: a node that ran and succeeded is a step of the Flow
  // whatever the packet then looks like.
  assert.equal((pressed as { resultCode?: string }).resultCode, "web.action.succeeded");
});

test("a Flow that has spent every number starts again rather than handing one control's number to another", () => {
  const handles = createWebLlmStableTargetHandles();
  const scope = { projectId: "p", flowId: "f" };
  const pages = Math.ceil(WEB_LLM_TARGET_HANDLE_MAX_NUMBER / 40);
  let last: string[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const { url, elements } = crowdedPage(page);
    const binding = sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: elements });
    last = handles.restamp(scope, binding).evidence.elements.map((element) => element.target);
    for (const target of last) assert.ok(Number(target.slice("target.".length)) <= WEB_LLM_TARGET_HANDLE_MAX_NUMBER, target);
  }
  // 249 pages spent 9,960 numbers; the 250th page's forty would pass 9,999.
  assert.deepEqual([last[0], last.at(-1)], ["target.1", "target.40"]);
});

test("a packet renumbered with the widest handles still fits the budget it was built for", async () => {
  // Spend numbers into four digits first.
  let page = crowdedPage(1);
  const runtime = runtimeOver(() => page);
  for (let index = 1; index <= 26; index += 1) {
    page = crowdedPage(index);
    await inspect(runtime);
  }
  page = crowdedPage(99);
  const maxEvidenceBytes = 2_000;
  const result = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.budget", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] }, maxEvidenceBytes });
  const evidence = (result as unknown as { evidence: { elements: Array<{ target: string }>; budgetTruncated?: boolean } }).evidence;
  assert.equal(evidence.budgetTruncated, true);
  assert.ok(evidence.elements.every((element) => element.target.length === "target.1041".length), "every handle here has four digits");
  assert.ok(new TextEncoder().encode(JSON.stringify(evidence)).byteLength <= maxEvidenceBytes);
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
    { target: "target.1", name: "Retry" },
    { target: "target.2", name: "Select the post for Mon 21 Sep 2026, 09:00" }
  ]);

  // The queue is filtered: another post is in row one, at the same selector.
  elements = [retry, rowOneCheckbox("pst_b", "Mon 21 Sep 2026, 06:00")];
  assert.deepEqual(await inspect(runtime), [
    { target: "target.1", name: "Retry" },
    { target: "target.3", name: "Select the post for Mon 21 Sep 2026, 06:00" }
  ], "the second post's checkbox is not handed the first post's number");
  assert.equal(await selectorFor(runtime, "target.2"), undefined, "the first post's number now resolves to nothing, not to the second post");
  assert.equal(await selectorFor(runtime, "target.3"), ROW_ONE_CHECKBOX);

  // The filter is cleared and the first post is back in row one: it has its own number back.
  elements = [retry, rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1", "target.2"]);
  assert.equal(await selectorFor(runtime, "target.2"), ROW_ONE_CHECKBOX);
});

test("a row control that stays in its record keeps its number, as every other control does", async () => {
  let elements = [retry, rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  await inspect(runtime);
  // The bulk bar comes and goes above the table; the row does not change.
  elements = [rowOneCheckbox("pst_a", "Mon 21 Sep 2026, 09:00")];
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.2"]);
  assert.equal(await selectorFor(runtime, "target.2"), ROW_ONE_CHECKBOX);
});
