// A handle a tool's result printed is one a candidate may name (t378, W13).
//
// W6 made a candidate step naming a handle no evidence printed refused
// `web.handle.unknown`, and fed the printed handles from the page views, a
// failure packet's repair candidates, and a WeakMap mark that a search and a
// description put on their capture. A detection's columns were left out: each
// field's `at` is the handle of its element in the first item, read from the
// packet the model was shown (`../../structure/first-item/locate.ts`), and an
// element with no words of its own -- a product image, a thumbnail wrapper --
// has a handle there that the page view never prints. A candidate step naming
// that `at` was refused for a handle the detection had printed to it.
//
// Held here: whatever a tool's result printed at the start of a line -- a page
// view, a search's matches, a description, a detection's `at`, a node run's
// answer -- is printed, read once where every tool's answer leaves the runtime
// (`../../tools.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownPageText } from "../../page-view/tests/shown-page-lines";
import { createWebLlmTargetPackets } from "..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";

const SCOPE = { projectId: "project.printed-results", flowId: "flow.printed-results" };
const URL_ = "https://bigbox.test/search?q=paper+towels";
const CONTAINER = "#results";
const CHECK = webAutomationOutputNodeId("web.dom.check");

/** The detection the page answers: each card's title link and its wordless thumbnail. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > div.card`,
    itemCount: 2,
    fields: [
      { key: "title", label: "a.title", spec: { kind: "text", selector: ":scope > a.title", required: true }, coverage: 1 },
      { key: "thumb", label: "div.thumb", spec: { kind: "text", selector: ":scope > div.thumb", required: true }, coverage: 1 }
    ],
    confidence: 0.8
  }
};

/** Two product cards under the container: a wordless thumbnail, then the title link. */
function results(): JsonObject[] {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "div", selector: CONTAINER, attributes: { id: "results" } }) - 1;
  for (const [position, title] of [[1, "ValueRidge Paper Towels, 6 Rolls"], [2, "Brightway Paper Towels, 12 Rolls"]] as const) {
    const item = `${CONTAINER} > div:nth-of-type(${position})`;
    const listPosition = { index: position, total: 2 };
    const card = elements.push({ tagName: "div", selector: item, attributes: { class: "card" }, parent: container, context: { listPosition } }) - 1;
    elements.push({ tagName: "div", selector: `${item} > div`, attributes: { class: "thumb" }, parent: card, context: { listPosition } });
    elements.push({ tagName: "a", selector: `${item} > a`, visibleText: title, attributes: { class: "title", href: `/ip/${position}` }, parent: card, context: { listPosition } });
  }
  return elements;
}

function runtimeOver(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Search", interactiveElements: results() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

test("a detection's column `at` that the page view never printed is one a candidate may name", async () => {
  const runtime = runtimeOver();
  const looked = await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detected.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE, JSON.stringify(detected.evidence));
  const thumb = (detected.evidence as WebLlmRepeatingStructure).fields.find((field) => field.key === "thumb")?.at;
  assert.ok(thumb, "the detection points the thumbnail column at its element");
  assert.doesNotMatch(shownPageText(looked.evidence), new RegExp(`\\b${thumb}\\b`, "u"), "the page view leaves the wordless thumbnail out");

  const candidate = await runtime.resolvePlanNodeParameters({
    ...SCOPE,
    nodeDefinitionId: CHECK,
    parameters: { target: { handle: thumb }, checked: true },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: "view_history"
  });
  assert.equal(candidate.status, "resolved", JSON.stringify(candidate));
  if (candidate.status === "resolved") assert.equal(candidate.parameters.selector, `${CONTAINER} > div:nth-of-type(1) > div`);
});

test("a held handle a search only echoed mid-line is not printed by it", async () => {
  const runtime = runtimeOver();
  const looked = await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const resolve = (handle: string, reach: "view_history" | undefined) => runtime.resolvePlanNodeParameters({
    ...SCOPE,
    nodeDefinitionId: CHECK,
    parameters: { target: { handle }, checked: true },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: reach
  });
  // A handle the capture holds (exploration resolves it) that the view left out.
  const printed = new Set([...shownPageText(looked.evidence).matchAll(/^t[0-9]+/gmu)].map((match) => match[0]));
  let unprinted: string | undefined;
  for (let index = 1; index <= 12 && unprinted === undefined; index += 1) {
    const handle = `t${index}`;
    if (!printed.has(handle) && (await resolve(handle, undefined)).status === "resolved") unprinted = handle;
  }
  assert.ok(unprinted, "some held handle is left out of the view");

  // A search for its spelling echoes it in "N matches for '...'", mid-line, and prints nothing of it.
  const found = await runtime.executeTool({ ...SCOPE, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: unprinted } });
  assert.match(JSON.stringify(found.evidence), new RegExp(unprinted, "u"), "the search echoed the query");
  const answer = await resolve(unprinted, "view_history");
  assert.equal(answer.status, "refused", `${unprinted}: ${JSON.stringify(answer)}`);
  if (answer.status === "refused") assert.equal(answer.issueCodes[0], "web.handle.unknown");
});

test("a refusal's echo of the handle its call named does not print it; the same handle in an answer that worked does", () => {
  const targets = createWebLlmTargetPackets();
  const capture = createWebLlmStableTargetHandles().restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: URL_, interactiveElements: results() }));
  targets.remember(SCOPE, capture);
  const thumb = capture.evidence.elements.find((element) => capture.selectors.get(element.target) === `${CONTAINER} > div:nth-of-type(2) > div`)?.target;
  assert.ok(thumb);
  assert.deepEqual(targets.resolve(SCOPE, thumb, undefined, "view_history"), { ok: false, code: "not_shown" });

  // A description refused for a handle not on the page names it back as `target`.
  targets.printed(SCOPE, { error: "target_unobserved", detail: { reason: "handle_not_in_packet", target: thumb } }, { target: thumb });
  assert.deepEqual(targets.resolve(SCOPE, thumb, undefined, "view_history"), { ok: false, code: "not_shown" });
  // Words that only mention it mid-line print nothing either.
  targets.printed(SCOPE, { found: `0 matches for "${thumb}"` });
  assert.deepEqual(targets.resolve(SCOPE, thumb, undefined, "view_history"), { ok: false, code: "not_shown" });

  targets.printed(SCOPE, { fields: [{ key: "thumb", at: thumb }] });
  assert.equal(targets.resolve(SCOPE, thumb, undefined, "view_history").ok, true);
});
