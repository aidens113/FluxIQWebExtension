// T1 coverage of read-requested-state.ts (t407): whether a check's or a
// choice's requested state holds on the document its page navigated to, read
// with the fact check's own message and answered `landed`, `not_landed` or
// `unknown`. The page is stubbed at the sender; what it would answer is
// `content/facts/judge.ts`'s, covered by its own tests.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand } from "../../../shared/protocol";
import { FACT_CHECK_MESSAGE } from "../../../shared/fact-check-message";
import type { LandedTabAccess } from "../../landed-check-wait";
import { readRequestedState } from "../read-requested-state";

const TAB_ID = 41;
const SELECTOR = "input[type=\"checkbox\"][value=\"customer_rating:4 & up\"]";
const CHECK: BrowserActionCommand = { commandId: "c-check", actionType: "web.dom.check", selector: SELECTOR, element: { selector: SELECTOR }, checked: true };
const ELEMENT = { tagName: "input", role: "checkbox" };

type Asked = { tabId: number; frameId: number | undefined; message: Record<string, unknown> };

/** A page that answers each fact check with the next of `answers` (the last one again once they run out); `Error` rejects the send. */
function page(answers: Array<Record<string, unknown> | Error>): { access: LandedTabAccess; asked: Asked[]; settled: number[] } {
  const asked: Asked[] = [];
  const settled: number[] = [];
  let next = 0;
  const access: LandedTabAccess = {
    send: <T>(tabId: number, message: unknown, frameId?: number) => {
      asked.push({ tabId, frameId, message: message as Record<string, unknown> });
      const answer = answers[Math.min(next, answers.length - 1)];
      next += 1;
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ answers: [{ ...answer, capturedAt: 1 }] } as T);
    },
    settle: (tabId) => {
      settled.push(tabId);
      return Promise.resolve();
    }
  };
  return { access, asked, settled };
}

test("a check whose control is checked on the new document landed, asked once the tab settled, by the action's own target", async () => {
  const { access, asked, settled } = page([{ result: "true", evidence: { element: ELEMENT } }]);
  const reading = await readRequestedState(CHECK, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "landed", actual: "on the page it landed on the control is checked" });
  assert.deepEqual(settled, [TAB_ID]);
  assert.equal(asked.length, 1);
  assert.equal(asked[0]?.tabId, TAB_ID);
  assert.equal(asked[0]?.frameId, 0);
  assert.equal(asked[0]?.message.type, FACT_CHECK_MESSAGE);
  assert.deepEqual(asked[0]?.message.request, {
    queries: [{ kind: "checked", target: { selector: SELECTOR, element: { selector: SELECTOR } }, expected: true }]
  });
});

test("an uncheck asks for the unchecked state", async () => {
  const { access, asked } = page([{ result: "true", evidence: { element: ELEMENT } }]);
  const reading = await readRequestedState({ ...CHECK, checked: false }, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "landed", actual: "on the page it landed on the control is unchecked" });
  assert.deepEqual((asked[0]?.message.request as { queries: unknown[] }).queries[0], {
    kind: "checked",
    target: { selector: SELECTOR, element: { selector: SELECTOR } },
    expected: false
  });
});

test("a control drawn in its old state at first and in the requested one a moment later landed: the page is asked again", async () => {
  const { access, asked } = page([{ result: "false", evidence: { element: ELEMENT } }, { result: "true", evidence: { element: ELEMENT } }]);
  const reading = await readRequestedState(CHECK, TAB_ID, access, 1_000);
  assert.equal(reading.kind, "landed");
  assert.equal(asked.length, 2);
});

test("a control that stays in the other state for the whole budget did not land", async () => {
  const { access, asked } = page([{ result: "false", evidence: { element: ELEMENT } }]);
  const reading = await readRequestedState(CHECK, TAB_ID, access, 400);
  assert.deepEqual(reading, { kind: "not_landed", actual: "on the page it landed on the control is unchecked" });
  assert.ok(asked.length >= 2, `asked ${asked.length} times`);
});

test("a control missing from the new document is unknown, not a state that failed to land", async () => {
  const { access } = page([{ result: "false" }]);
  const reading = await readRequestedState(CHECK, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "unknown", actual: "the control is not on the page it landed on" });
});

test("a document that never answers is unknown, naming why", async () => {
  const { access, asked } = page([new Error("Could not establish connection. Receiving end does not exist.")]);
  const reading = await readRequestedState(CHECK, TAB_ID, access, 400);
  assert.deepEqual(reading, { kind: "unknown", actual: "the page it landed on could not say whether the control is checked (unreadable_frame)" });
  assert.ok(asked.length >= 2, `asked ${asked.length} times`);
});

test("a choice by value asks whether the select holds that value, and never quotes it", async () => {
  const { access, asked } = page([{ result: "false", evidence: { element: { tagName: "select" } } }]);
  const select: BrowserActionCommand = { commandId: "c-select", actionType: "web.dom.select", selector: "#sort", value: "price-asc" };
  const reading = await readRequestedState(select, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "not_landed", actual: "on the page it landed on the select holds another option" });
  assert.deepEqual((asked[0]?.message.request as { queries: unknown[] }).queries[0], {
    kind: "value",
    target: { selector: "#sort" },
    comparison: "equals",
    expected: "price-asc"
  });
  assert.doesNotMatch(JSON.stringify(reading), /price-asc/u);
});

test("a choice by label asks by the label, which the page matches against the chosen option's label", async () => {
  const { access, asked } = page([{ result: "true" }]);
  const select: BrowserActionCommand = { commandId: "c-select", actionType: "web.dom.select", selector: "#sort", option: { by: "label", label: "Price: low to high" } };
  const reading = await readRequestedState(select, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "landed", actual: "on the page it landed on the select holds the requested option" });
  assert.equal(((asked[0]?.message.request as { queries: Array<{ expected: string }> }).queries[0])?.expected, "Price: low to high");
});

test("a sensitive select is unknown: the page will not read it", async () => {
  const { access } = page([{ result: "unknown", evidence: { reason: "sensitive" } }]);
  const select: BrowserActionCommand = { commandId: "c-select", actionType: "web.dom.select", selector: "#card-type", value: "visa" };
  const reading = await readRequestedState(select, TAB_ID, access, 50);
  assert.deepEqual(reading, { kind: "unknown", actual: "the page it landed on could not say whether the select holds the requested option (sensitive)" });
});

test("a choice by position, or an action naming no element, is unknown without asking the page", async () => {
  const { access, asked, settled } = page([{ result: "true" }]);
  const byIndex = await readRequestedState({ commandId: "c-select", actionType: "web.dom.select", selector: "#sort", option: { by: "index", index: 2 } }, TAB_ID, access, 50);
  assert.equal(byIndex.kind, "unknown");
  const unnamed = await readRequestedState({ commandId: "c-check", actionType: "web.dom.check", checked: true }, TAB_ID, access, 50);
  assert.equal(unnamed.kind, "unknown");
  assert.equal(asked.length, 0);
  assert.equal(settled.length, 0);
});

test("the element description carried only in the raw options is the target's description too", async () => {
  const { access, asked } = page([{ result: "true" }]);
  await readRequestedState({ commandId: "c-check", actionType: "web.dom.check", options: { element: { selector: SELECTOR, text: "4 & up" } } }, TAB_ID, access, 50);
  assert.deepEqual(((asked[0]?.message.request as { queries: Array<{ target: unknown }> }).queries[0])?.target, { element: { selector: SELECTOR, text: "4 & up" } });
});
