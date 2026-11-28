// The page-read effect check (t1096): a lasting act whose answer was lost, and
// whose step declared no expected state, is settled by comparing the page the
// call found with the page the act left -- the address with its query, the
// controls marked current, the first row's identity.
//
// The pages are synthetic, shaped as the recorded manual run's were (a list of
// cards, a pager marking its page current, `?page=2` added by the turn); none of
// that run's page text is here. The page is stubbed at the gateway: a look
// answers `before` until the act has been sent `landsOn` times, then `after`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { captureEvidence, type WebLlmAfterActionTiming } from "../../../capture";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { webNodeDispatchWithRetries, webNodePageEffectCheck, type WebNodeDispatchResult } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const NEXT_PAGE = { definitionId: "web.output.dom-next_page", actionType: "web.dom.next_page", parameters: { nextPage: { item: "#grid > a" } } };
const CLICK = { definitionId: "web.output.dom-click", actionType: "web.dom.click", parameters: { selector: "#pager > button.next" } };
const SNAPSHOT = "web.output.dom-capture_snapshot";
const PERMITTED = async () => ({ permitted: true as const });

/** An act whose answer was lost after it was dispatched: retryable, and not stated `unacted`. */
const LOST: WebNodeDispatchResult = {
  status: "failed",
  failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, { expected: "the act", actual: "the page changed" }) as unknown as JsonObject,
  error: "web.page.changed"
};

/** One page of a four-card list: the address carries `page=2` from the second page on, and the pager marks its page current. */
function listPage(page: 1 | 2): JsonObject {
  const cards = page === 1 ? ["a1", "a2", "a3", "a4"] : ["b1", "b2", "b3", "b4"];
  return {
    url: `https://listings.example.test/catalog?pageSize=4${page === 2 ? "&page=2" : ""}`,
    title: "Catalog",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      ...cards.map((key, index) => ({ tagName: "a", selector: `#grid > a:nth-of-type(${index + 1})`, visibleText: `Listing ${key}`, context: { record: { keyAttribute: "href", key: `/item/${key}` } } })),
      { tagName: "button", selector: "#pager > button.prev", visibleText: "Previous page", attributes: page === 1 ? { "aria-label": "Previous page", disabled: "" } : { "aria-label": "Previous page" } },
      { tagName: "button", selector: "#pager > button:nth-of-type(2)", visibleText: "1", attributes: page === 1 ? { "aria-current": "page" } : {} },
      { tagName: "button", selector: "#pager > button:nth-of-type(3)", visibleText: "2", attributes: page === 2 ? { "aria-current": "page" } : {} },
      { tagName: "button", selector: "#pager > button.next", visibleText: "Next page", attributes: { "aria-label": "Next page" } }
    ]
  };
}

/** A page whose look answers `before` until the act was sent `landsOn` times, then `after`; `unreadable` looks time out after the act. */
function site(options: { before: JsonObject; after?: JsonObject; landsOn?: number; unreadable?: boolean; acts?: readonly WebNodeDispatchResult[] }) {
  const sent: string[] = [];
  let looks = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        looks += 1;
        if (options.unreadable === true && sent.length > 0) return { status: "timed_out" };
        const landed = sent.length >= (options.landsOn ?? Number.POSITIVE_INFINITY);
        return { status: "succeeded", payload: { snapshot: landed ? options.after ?? options.before : options.before } };
      }
      sent.push(command.actionType);
      return options.acts?.[sent.length - 1] ?? { status: "succeeded", payload: {} };
    }
  };
  return { gateway, sent, looks: () => looks };
}

function runOn(gateway: WebLlmEvidenceGateway) {
  return { gateway, sessionId: "session.one", request: { ...PROJECT, callId: "turn", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } };
}

/** The page as a call finds it, read as the run reads it before acting. */
async function found(page: JsonObject) {
  const s = site({ before: page });
  return await captureEvidence(s.gateway, "session.one", runOn(s.gateway).request);
}

/** The after-action wait on a clock that moves only when it sleeps: its own window, without waiting it out for real. */
function fakeTiming(): WebLlmAfterActionTiming {
  let now = 0;
  return { windowMs: 5_000, retryMs: 250, now: () => now, sleep: async (ms) => { now += ms; } };
}

test("a page turn whose found page was the first and whose page now is the second landed", async () => {
  const before = await found(listPage(1));
  const s = site({ before: listPage(2) });
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => before)(LOST, 1), "landed");
});

test("a page turn whose page still shows the same address, pager and rows did not land", async () => {
  const before = await found(listPage(1));
  const s = site({ before: listPage(1) });
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => before)(LOST, 1), "not_landed");
});

test("a page turn after which no page could be read is unknown, never not_landed", async () => {
  const before = await found(listPage(1));
  const s = site({ before: listPage(1), unreadable: true });
  s.sent.push(NEXT_PAGE.actionType);
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => before, undefined, fakeTiming())(LOST, 1), "unknown");
  assert.ok(s.looks() > 1, "the page between documents was waited out, not read once");
});

test("a page turn whose found page is unknown asks the page nothing", async () => {
  const s = site({ before: listPage(1) });
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => undefined)(LOST, 1), "unknown");
  assert.equal(s.looks(), 0);
});

test("a press that changed nothing proves nothing; a press whose page moved landed", async () => {
  const before = await found(listPage(1));
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: listPage(1) }).gateway), { actionType: CLICK.actionType }, () => before)(LOST, 1), "unknown");
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: listPage(2) }).gateway), { actionType: CLICK.actionType }, () => before)(LOST, 1), "landed");
});

test("each of the three moves alone is a landing: the address, the current mark, the first row", async () => {
  const before = await found(listPage(1));
  const page = (change: (snapshot: JsonObject & { interactiveElements: JsonObject[] }) => void): JsonObject => {
    const snapshot = structuredClone(listPage(1)) as JsonObject & { interactiveElements: JsonObject[] };
    change(snapshot);
    return snapshot;
  };
  const moved = {
    address: page((snapshot) => { snapshot.url = "https://listings.example.test/catalog?pageSize=4&page=2"; }),
    mark: page((snapshot) => {
      snapshot.interactiveElements[5]!.attributes = {};
      snapshot.interactiveElements[6]!.attributes = { "aria-current": "page" };
    }),
    firstRow: page((snapshot) => { snapshot.interactiveElements[0]!.context = { record: { keyAttribute: "href", key: "/item/b1" } }; })
  };
  for (const [name, after] of Object.entries(moved)) {
    assert.equal(await webNodePageEffectCheck(runOn(site({ before: after }).gateway), { actionType: NEXT_PAGE.actionType }, () => before)(LOST, 1), "landed", name);
  }
});

test("rows that differ past the first, on the same address and pager, prove neither for a page turn", async () => {
  const before = await found(listPage(1));
  const after = structuredClone(listPage(1)) as JsonObject & { interactiveElements: JsonObject[] };
  after.interactiveElements[3]!.context = { record: { keyAttribute: "href", key: "/item/a9" } };
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: after }).gateway), { actionType: NEXT_PAGE.actionType }, () => before)(LOST, 1), "unknown");
});

test("a page with no rows in a record never says a page turn did not land", async () => {
  const bare = structuredClone(listPage(1)) as JsonObject & { interactiveElements: JsonObject[] };
  for (const element of bare.interactiveElements) delete element.context;
  const before = await found(bare);
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: bare }).gateway), { actionType: NEXT_PAGE.actionType }, () => before)(LOST, 1), "unknown");
});

test("the step's declared check answers first; the page is read only when it cannot say", async () => {
  const before = await found(listPage(1));
  const s = site({ before: listPage(2) });
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => before, async () => "not_landed")(LOST, 1), "not_landed");
  assert.equal(s.looks(), 0);
  assert.equal(await webNodePageEffectCheck(runOn(s.gateway), { actionType: NEXT_PAGE.actionType }, () => before, async () => { throw new Error("broke"); })(LOST, 1), "landed");
});

test("under Core's retries: a lost page turn that landed is sent once; one that did not is sent again", async () => {
  const before = await found(listPage(1));
  const landed = site({ before: listPage(1), after: listPage(2), landsOn: 1, acts: [LOST] });
  const once = await webNodeDispatchWithRetries(runOn(landed.gateway), { definitionId: NEXT_PAGE.definitionId, effect: "mutate", declared: [] },
    { actionType: NEXT_PAGE.actionType, parameters: NEXT_PAGE.parameters, metadata: {} }, { found: before });
  assert.deepEqual(landed.sent, [NEXT_PAGE.actionType]);
  assert.equal(once.lastingAct, "landed");

  const missed = site({ before: listPage(1), acts: [LOST] });
  const again = await webNodeDispatchWithRetries(runOn(missed.gateway), { definitionId: NEXT_PAGE.definitionId, effect: "mutate", declared: [] },
    { actionType: NEXT_PAGE.actionType, parameters: NEXT_PAGE.parameters, metadata: {} }, { found: before });
  assert.deepEqual(missed.sent, [NEXT_PAGE.actionType, NEXT_PAGE.actionType]);
  assert.equal(again.result.status, "succeeded");
});

test("under Core's retries: a lost press on an unchanged page stays uncertain and is not sent again", async () => {
  const before = await found(listPage(1));
  const s = site({ before: listPage(1), acts: [LOST] });
  const held = await webNodeDispatchWithRetries(runOn(s.gateway), { definitionId: CLICK.definitionId, effect: "mutate", declared: [] },
    { actionType: CLICK.actionType, parameters: CLICK.parameters, metadata: {} }, { found: before });
  assert.deepEqual(s.sent, [CLICK.actionType]);
  assert.equal(held.lastingAct, "uncertain");
});

test("a press on a detected list's Next is a page turn: an unchanged page says it did not land, a moved one that it did", async () => {
  const before = await found(listPage(1));
  const pager = { actionType: CLICK.actionType, pager: true };
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: listPage(1) }).gateway), pager, () => before)(LOST, 1), "not_landed");
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: listPage(2) }).gateway), pager, () => before)(LOST, 1), "landed");
  const unreadable = site({ before: listPage(1), unreadable: true });
  unreadable.sent.push(CLICK.actionType);
  assert.equal(await webNodePageEffectCheck(runOn(unreadable.gateway), pager, () => before, undefined, fakeTiming())(LOST, 1), "unknown", "no page read is never not_landed");
  assert.equal(await webNodePageEffectCheck(runOn(site({ before: listPage(1) }).gateway), { actionType: CLICK.actionType, pager: false }, () => before)(LOST, 1), "unknown", "any other press keeps today's rule");
});

test("under Core's retries: a lost press on a list's Next whose page did not move is pressed again; one whose page moved is not", async () => {
  const before = await found(listPage(1));
  const missed = site({ before: listPage(1), acts: [LOST] });
  const again = await webNodeDispatchWithRetries(runOn(missed.gateway), { definitionId: CLICK.definitionId, effect: "mutate", declared: [] },
    { actionType: CLICK.actionType, parameters: CLICK.parameters, metadata: {} }, { found: before, turns: ["#grid > a"] });
  assert.deepEqual(missed.sent, [CLICK.actionType, CLICK.actionType]);
  assert.equal(again.result.status, "succeeded");

  const landed = site({ before: listPage(1), after: listPage(2), landsOn: 1, acts: [LOST] });
  const once = await webNodeDispatchWithRetries(runOn(landed.gateway), { definitionId: CLICK.definitionId, effect: "mutate", declared: [] },
    { actionType: CLICK.actionType, parameters: CLICK.parameters, metadata: {} }, { found: before, turns: ["#grid > a"] });
  assert.deepEqual(landed.sent, [CLICK.actionType]);
  assert.equal(once.lastingAct, "landed");
});

test("exploring: a press on the pager's Next whose answer was lost and whose page turned counts as done, pressed once", async () => {
  const s = site({ before: listPage(1), after: listPage(2), landsOn: 1, acts: [{ status: "timed_out" }] });
  const runtime = createWebAutomationLlmEvidenceRuntime(s.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const next = shownHandle(looked.evidence, "Next page");
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "next", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK.definitionId, parameters: { target: { handle: next } }, consequences: [] } });
  assert.deepEqual(s.sent, ["web.dom.click"]);
  assert.equal(pressed.effectApplied, true);
});
