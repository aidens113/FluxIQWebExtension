// A Next page step naming the list a detection found, made into the request
// the page runs (contract C2 of `s45-next-page.md`).
//
// What these rows are really proving:
// - `nextPage: {list: "extraction.N"}` becomes `{item, pagination}`: the list's
//   item selector the model was never shown, and the way to its next page the
//   detection found, without the read's page bound -- one step moves one page;
// - `control: "tN"` names the site's own Next control instead, by the selector
//   behind the handle;
// - a list detected with no pager resolves to its item alone, and the page
//   finds the way live;
// - a literal `{item, next?}` is the request written short;
// - an unknown, foreign or let-go handle refuses the node exactly as the read's
//   does, at the position it was written in, and nothing of it is resolved.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationNextPageRequestValue } from "../../../../actions/next-page";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";
import { CAPTURED_DETECTIONS, type CapturedDetectionName } from "../../structure/tests/captured-detections";

const NEXT_PAGE_NODE = webAutomationOutputNodeId("web.dom.next_page");
const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const NEXT_PAGE_SHAPE = "web.handle.expected.next_page.list_control";
const testId = (id: string) => `[data-testid="${id}"]`;
const CARD = testId("product-card");
/** The site's own Next control, as an inspect shows it. */
const PAGER_NEXT: JsonObject = { tagName: "a", selector: "nav.pager a.pager-next", accessibleName: "Next page", visibleText: "Next page", attributes: { href: "?page=2" } };

/** These rows are about handles, not permission (`plan-step-permission.test.ts`). */
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

function runtimeOver(name: CapturedDetectionName): WebAutomationLlmEvidenceRuntime {
  const capture = CAPTURED_DETECTIONS[name];
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: capture.url, title: capture.title, interactiveElements: [PAGER_NEXT] };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(capture.structure) as JsonValue } };
    }
  });
}

let calls = 0;
async function detect(runtime: WebAutomationLlmEvidenceRuntime, flowId = SCOPE.flowId): Promise<WebLlmRepeatingStructure> {
  calls += 1;
  const result = await runtime.executeTool({ projectId: SCOPE.projectId, flowId, callId: `call.detect.${calls}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return result.evidence as WebLlmRepeatingStructure;
}

async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<unknown> {
  calls += 1;
  return (await runtime.executeTool({ ...SCOPE, callId: `call.look.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).evidence;
}

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject, flowId = SCOPE.flowId) {
  return await runtime.resolvePlanNodeParameters({ projectId: SCOPE.projectId, flowId, nodeDefinitionId, parameters, declaredConsequences: NOTHING_LASTING });
}

function resolvedTo(nextPage: JsonObject, rest: JsonObject = {}) {
  return { status: "resolved", parameters: { nextPage, ...rest } };
}

function refusedAt(reason: string, position: string, hint?: string) {
  return { status: "refused", issueCodes: [reason, ...(hint ? [hint] : []), `${reason}:${position}`] };
}

test("a Next page step naming a detected list resolves to its item and the detected pager, without a page bound", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  const { extraction } = await detect(runtime);
  // The catalog's pager was detected as `{next, maxPages: 3}`; one step moves one page, so the bound goes.
  const expected = { item: CARD, pagination: { next: testId("pagination-next") } };
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction } }), resolvedTo(expected));
  // The handle written as the read writes it is the same list.
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: { handle: extraction } }, timeoutMs: 30_000 }), resolvedTo(expected, { timeoutMs: 30_000 }));
  // What runs is a request the page reads as written.
  const resolved = await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction } });
  const request = resolved.status === "resolved" ? resolved.parameters.nextPage : undefined;
  assert.deepEqual(webAutomationNextPageRequestValue(request), expected);
});

test("each detected way to the next page keeps its control and loses its bound; no pager leaves the way to the page", async () => {
  const feed = runtimeOver("infinite-feed-largest");
  const posts = await detect(feed);
  assert.deepEqual(await resolve(feed, NEXT_PAGE_NODE, { nextPage: { list: posts.extraction } }), resolvedTo({ item: testId("feed-item"), pagination: { mode: "scroll" } }));

  const loadMore = runtimeOver("infinite-feed-load-more");
  const more = await detect(loadMore);
  const capture = CAPTURED_DETECTIONS["infinite-feed-load-more"].structure;
  const detected = capture.ok ? capture.proposal.pagination : undefined;
  assert.equal(detected?.mode, "loadMore");
  const control = detected?.mode === "loadMore" ? detected.control : "";
  const item = capture.ok ? capture.proposal.item : "";
  assert.deepEqual(await resolve(loadMore, NEXT_PAGE_NODE, { nextPage: { list: more.extraction } }), resolvedTo({ item, pagination: { mode: "loadMore", control } }));

  const table = runtimeOver("data-table-largest");
  const rows = await detect(table);
  const tableItem = CAPTURED_DETECTIONS["data-table-largest"].structure.ok ? CAPTURED_DETECTIONS["data-table-largest"].structure.proposal.item : "";
  assert.deepEqual(await resolve(table, NEXT_PAGE_NODE, { nextPage: { list: rows.extraction } }), resolvedTo({ item: tableItem }));
});

test("control names the site's own Next control by its handle, in place of the detected pager", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  const shown = await look(runtime);
  const { extraction } = await detect(runtime);
  const next = shownHandle(shown, "Next page");
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction, control: next } }), resolvedTo({ item: CARD, pagination: { next: "nav.pager a.pager-next" } }));
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction, control: { handle: next } } }), resolvedTo({ item: CARD, pagination: { next: "nav.pager a.pager-next" } }));
  // An unknown control refuses the step, saying where.
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction, control: "t99" } }), refusedAt("web.handle.unknown", "nextPage.control"));
  // A list handle where the control goes, or a control handle where the list goes, is misplaced.
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction, control: extraction } }), refusedAt("web.handle.misplaced", "nextPage.control", NEXT_PAGE_SHAPE));
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: next } }), refusedAt("web.handle.misplaced", "nextPage.list", NEXT_PAGE_SHAPE));
});

test("a literal {item, next?} is the request written short, and a whole request is left as written", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { item: "li.result", next: "a.next" } }), resolvedTo({ item: "li.result", pagination: { next: "a.next" } }));
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { item: "li.result" } }), { status: "unchanged" });
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { item: "li.result", pagination: { mode: "loadMore", control: "button.more" } } }), { status: "unchanged" });
});

test("a list handle that names no list this Flow was shown refuses the step as the read's does", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  const { extraction } = await detect(runtime);
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: "extraction.999" } }), refusedAt("web.handle.unknown", "nextPage.list"));
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction } }, "flow.two"), refusedAt("web.handle.unknown", "nextPage.list"));
  // Let go by the bounded store: stale, so the model can tell "detect it again" from "never a handle".
  const handles: string[] = [extraction];
  for (let index = 0; index < 16; index += 1) handles.push((await detect(runtime)).extraction);
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: handles[0]! } }), refusedAt("web.handle.stale", "nextPage.list"));
  assert.equal((await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: handles[16]! } })).status, "resolved");
});

test("a Next page step in any other shape is refused at the key, naming the shape it goes in", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  const { extraction } = await detect(runtime);
  const malformed: Array<[JsonValue, string]> = [
    // One step moves one page: a bound means a read's paging was copied here.
    [{ list: extraction, maxPages: 3 }, "nextPage.maxPages"],
    [{ list: extraction, pagination: { next: "a.next" } }, "nextPage.pagination"],
    [{ list: 7 }, "nextPage.list"],
    [{ control: "t1" }, "nextPage"],
    [{ item: "li.result", next: "a.next", maxPages: 2 }, "nextPage.maxPages"],
    [{ item: "li.result", next: "a.next", pagination: { next: "a.more" } }, "nextPage.next"],
    ["extraction.1", "nextPage"]
  ];
  for (const [nextPage, position] of malformed) {
    assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage }), refusedAt("web.handle.malformed", position, NEXT_PAGE_SHAPE), JSON.stringify(nextPage));
  }
  // A handle anywhere else on the step is misplaced, and it belongs in nextPage.
  assert.deepEqual(await resolve(runtime, NEXT_PAGE_NODE, { nextPage: { list: extraction }, selector: { handle: extraction } }), refusedAt("web.handle.misplaced", "selector", NEXT_PAGE_SHAPE));
});

test("a Run Output node naming Next page resolves its payload as the step itself would", async () => {
  const runtime = runtimeOver("product-catalog-largest");
  const { extraction } = await detect(runtime);
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.next_page", parameters: { nextPage: { list: extraction } } }), {
    status: "resolved",
    parameters: { outputId: "web.dom.next_page", parameters: { nextPage: { item: CARD, pagination: { next: testId("pagination-next") } } } }
  });
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.next_page", parameters: { nextPage: { list: "extraction.999" } } }), refusedAt("web.handle.unknown", "parameters.nextPage.list"));
});
