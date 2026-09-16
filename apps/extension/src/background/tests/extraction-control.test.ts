// The pick and its preview: what the worker sends into the page, what it takes
// back, and what it stops reading when the user changes their mind.
//
// Who may drive any of it is `extraction-boundary.test.ts`; what a confirmed
// extraction records and runs is `extraction-confirm.test.ts`. The fake page,
// the fake runner and the `chrome` stub are `extraction-harness.ts`, shared so
// the three cannot drift.
//
// Several rows here are regressions rather than features. A pick the page could
// propose nothing for used to leave a session that said "still picking" over a
// page whose overlay was already gone; a `value` pick had nowhere to land and
// was dropped in silence; Escape in the page told the worker nothing at all; and
// the preview was read once, so a column the user excluded stayed read.

import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTRACTION_CONTENT_MESSAGES,
  EXTRACTION_PICK_CANCELLED_MESSAGE,
  EXTRACTION_PICKED_MESSAGE,
  EXTRACTION_RUNTIME_MESSAGES
} from "../../shared/extraction-messages";
import { clearExtractionTab, handleExtractionControl, type ExtractionConfirmField } from "../extraction";
import {
  AUTOMATION_TAB,
  PAGE_SENTINEL,
  frame,
  harness,
  previewFieldNames,
  proposal,
  responseOf,
  sentOfType,
  setPreviewReadable,
  sidepanel,
  startAndPick,
  type SentMessage
} from "./extraction-harness";

test("start puts the overlay in frame 0 of the automation tab", async () => {
  const h = harness();
  const response = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps));
  assert.deepEqual(response, { ok: true, sessionId: "s1", tabId: AUTOMATION_TAB });
  assert.deepEqual(h.sent, [{
    tabId: AUTOMATION_TAB,
    frameId: 0,
    message: { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId: "s1", form: "list" }
  }]);
});

test("start with no automation tab opens no session", async () => {
  const h = harness("recording", null);
  const response = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps));
  assert.equal(response.code, "no_tab");
  assert.equal(h.sent.length, 0);
});

test("a pick from another tab, or from a child frame, fills no session", async () => {
  const h = harness();
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  const otherTab = { id: "extension-id", tab: { id: 99 }, frameId: 0 } as chrome.runtime.MessageSender;
  const childFrame = { id: "extension-id", tab: { id: AUTOMATION_TAB }, frameId: 3 } as chrome.runtime.MessageSender;
  const fromOtherTab = responseOf(await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, otherTab, h.manager, h.deps));
  const fromChildFrame = responseOf(await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, childFrame, h.manager, h.deps));
  assert.equal(fromOtherTab.code, "no_session");
  assert.equal(fromChildFrame.code, "top_frame_only");
  assert.equal(h.deps.sessions.get(sessionId)?.state, "picking", "the session is still waiting for its own tab");
});

test("a pick the page could propose nothing for keeps the session and says why", async () => {
  const h = harness();
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  const refusedPick = await handleExtractionControl(
    { type: EXTRACTION_PICKED_MESSAGE, sessionId, refused: "no_repeating_run" },
    frame,
    h.manager,
    h.deps
  );
  assert.deepEqual(responseOf(refusedPick), { ok: true, sessionId });
  const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session;
  assert.deepEqual(session, { sessionId, tabId: AUTOMATION_TAB, state: "picking", form: "list", refused: "no_repeating_run", preview: [] });
  assert.equal(previewFieldNames(h.sent).length, 0, "nothing is read for a pick that proposed nothing");

  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, frame, h.manager, h.deps);
  const after = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session as Record<string, unknown>;
  assert.equal(after.state, "picked");
  assert.equal("refused" in after, false, "a later pick that succeeds clears the refusal");
});

test("the panel is served the proposal and a preview that never names a pre-excluded column", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const response = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps));
  const session = response.session as { state: string; proposal: unknown; preview: Record<string, string | null>[] };
  assert.equal(session.state, "picked");
  assert.deepEqual(session.proposal, proposal);
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"]], "the sensitive column is never read (D12)");
  assert.deepEqual(Object.keys(session.preview[0] ?? {}), ["product_name", "price"]);
  const preview = sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.preview);
  const request = preview?.message.request as { maxItems: number; minItems: number };
  assert.deepEqual([preview?.frameId, request.maxItems, request.minItems], [0, 20, 0]);
});

test("naming different columns re-reads the preview rather than filtering the rows already read", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps);
  await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps);
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"]], "the same columns are not re-read");

  const narrowed: ExtractionConfirmField[] = [
    { key: "product_name", label: "Product name", kind: "text", handling: "include" },
    { key: "price", label: "Price", kind: "text", handling: "exclude" }
  ];
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId, fields: narrowed },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"], ["product_name"]]);
  const session = response.session as { preview: Record<string, string | null>[] };
  assert.deepEqual(Object.keys(session.preview[0] ?? {}), ["product_name"], "the newly excluded column's values are gone, not hidden");
});

test("cancel takes the overlay down and forgets the session; cancelling nothing is not an error", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const cancelled = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.cancel, sessionId }, sidepanel, h.manager, h.deps));
  assert.deepEqual(cancelled, { ok: true, cancelled: true });
  assert.equal(sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.pickCancel)?.tabId, AUTOMATION_TAB);
  assert.equal(h.deps.sessions.get(sessionId), undefined);
  const again = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.cancel, sessionId }, sidepanel, h.manager, h.deps));
  assert.deepEqual(again, { ok: true, cancelled: false });
});

test("closing or navigating the tab clears its session", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  clearExtractionTab(99, h.deps);
  assert.equal(h.deps.sessions.get(sessionId)?.sessionId, sessionId, "another tab's removal leaves it alone");
  clearExtractionTab(AUTOMATION_TAB, h.deps);
  assert.equal(h.deps.sessions.get(sessionId), undefined);
  const response = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps));
  assert.deepEqual(response, { ok: true });
});

test("a value pick cannot be started, so no one can make one that has nowhere to land", async () => {
  const h = harness();
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.start, form: "value" },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.equal(response.ok, false);
  assert.equal(response.code, "value_form_unsupported");
  assert.equal(typeof response.error, "string", "the panel is given a sentence to show");
  assert.equal(h.sent.length, 0, "no overlay went up for a form that cannot be confirmed");
  const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession }, sidepanel, h.manager, h.deps)).session;
  assert.equal(session, undefined, "and no session was opened");
});

test("a value pick that arrives anyway is refused in words, not dropped", async () => {
  const h = harness();
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  const picked = responseOf(await handleExtractionControl(
    { type: EXTRACTION_PICKED_MESSAGE, sessionId, element: { selector: "#order-total", tagName: "span" } },
    frame,
    h.manager,
    h.deps
  ));
  assert.equal(picked.ok, false, "the pick is answered, not ignored");
  assert.equal(picked.code, "value_form_unsupported");

  const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session;
  assert.deepEqual(
    session,
    { sessionId, tabId: AUTOMATION_TAB, state: "picking", form: "list", refused: "value_form_unsupported", preview: [] },
    "the panel is told why, in the same word"
  );
  assert.equal(h.ran.length, 0, "nothing ran");
  assert.equal(previewFieldNames(h.sent).length, 0, "and nothing was read from the page");
});

test("a pick that left nothing to confirm puts the overlay back up, so the next click is still the pick", async () => {
  const h = harness();
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  const pickStarts = (): SentMessage[] => h.sent.filter((entry) => entry.message.type === EXTRACTION_CONTENT_MESSAGES.pickStart);
  assert.equal(pickStarts().length, 1);

  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, refused: "no_repeating_run" }, frame, h.manager, h.deps);
  assert.deepEqual(pickStarts().map((entry) => entry.message), [
    { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId, form: "list" },
    { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId, form: "list" }
  ], "the frame closed its overlay on the press, so the worker asks for it again");
  assert.equal(pickStarts()[1]?.frameId, 0, "in the top frame, as the first one was");

  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, element: { selector: "#total", tagName: "span" } }, frame, h.manager, h.deps);
  assert.equal(pickStarts().length, 3, "a value pick leaves the user able to pick again too");

  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, frame, h.manager, h.deps);
  assert.equal(pickStarts().length, 3, "a pick that proposed something does not re-arm: there is something to confirm");
});

test("the columns a preview is re-read under are the proposal's keys, never the confirm payload's", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps);
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"]]);

  // A confirm payload nested under `request` names its columns by the record key
  // derived from the user's label, so a renamed column ("Price" kept as "cost")
  // matches no proposal field and silently reads as "as proposed" -- while the
  // column that was not renamed matches and is honoured. Read as preview columns
  // it would therefore re-read, keeping the excluded `price` and dropping the
  // included `product_name`: exactly backwards.
  const renamed = [
    { key: "product_name", label: "Product name", kind: "text", handling: "exclude" },
    { key: "cost", label: "Cost", kind: "text", handling: "exclude" }
  ];
  await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId, request: { label: "Products", fields: renamed, itemCount: 8 } },
    sidepanel,
    h.manager,
    h.deps
  );
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"]], "a confirm payload names no preview columns, so nothing is re-read");

  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId, fields: [{ key: "product_name", handling: "include" }, { key: "price", handling: "exclude" }] },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.deepEqual(previewFieldNames(h.sent), [["product_name", "price"], ["product_name"]], "proposal keys are read and honoured");
  const session = response.session as { preview: Record<string, string | null>[] };
  assert.deepEqual(Object.keys(session.preview[0] ?? {}), ["product_name"]);
});

// Escape in the page, and a preview the page will not read. Both are the same
// shape as the defects above: one half of a conversation acting on something the
// other half never learns.

test("Escape in the page drops the session, so the panel stops waiting on a pick that is over", async () => {
  const h = harness();
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");

  const cancelled = responseOf(await handleExtractionControl(
    { type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId },
    frame,
    h.manager,
    h.deps
  ));
  assert.deepEqual(cancelled, { ok: true, cancelled: true });

  const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session;
  assert.equal(session, undefined, "the panel finds nothing to show, and closes");
  assert.equal(sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.pickCancel), undefined, "the frame took its own overlay down; it is not told to again");
  assert.deepEqual(responseOf(await handleExtractionControl({ type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId }, frame, h.manager, h.deps)), { ok: true, cancelled: false }, "Escape twice is not an error");
});

test("a cancel from another tab, from a child frame, or after the pick landed, leaves the session alone", async () => {
  const otherTab = { id: "extension-id", tab: { id: AUTOMATION_TAB + 1 }, frameId: 0 } as chrome.runtime.MessageSender;
  const childFrame = { id: "extension-id", tab: { id: AUTOMATION_TAB }, frameId: 3 } as chrome.runtime.MessageSender;
  for (const sender of [otherTab, childFrame]) {
    const h = harness();
    const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
    const sessionId = String(responseOf(started).sessionId ?? "");
    await handleExtractionControl({ type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId }, sender, h.manager, h.deps);
    const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session as Record<string, unknown> | undefined;
    assert.equal(session?.state, "picking", `a cancel from ${String(sender.tab?.id)}/${String(sender.frameId)} is not this session's`);
  }

  // A press that took a pick sends no cancel, and would be refused here anyway:
  // the proposal is what the user chose, and Escape must not discard it.
  const h = harness();
  const sessionId = await startAndPick(h);
  assert.deepEqual(
    responseOf(await handleExtractionControl({ type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId }, frame, h.manager, h.deps)),
    { ok: true, cancelled: false }
  );
  const session = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps)).session as Record<string, unknown>;
  assert.equal(session.state, "picked", "the pick survives");
});

test("a page that will not read the new columns leaves no rows behind, rather than the ones read under the old ones", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const first = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps));
  assert.equal(JSON.stringify(first).includes(`${PAGE_SENTINEL}-price`), true, "the rows are there to begin with");

  setPreviewReadable(false);
  const narrowed = [{ key: "product_name", handling: "include" }, { key: "price", handling: "exclude" }];
  const after = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId, fields: narrowed },
    sidepanel,
    h.manager,
    h.deps
  ));
  const session = after.session as { preview: unknown[] };
  assert.deepEqual(session.preview, [], "the rows read under the old columns are dropped, not kept as a stale preview");
  assert.equal(JSON.stringify(after).includes(PAGE_SENTINEL), false, "and no value of the column the user just excluded survives");

  setPreviewReadable(true);
  const retried = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId, fields: narrowed },
    sidepanel,
    h.manager,
    h.deps
  ));
  const rows = (retried.session as { preview: Record<string, string>[] }).preview;
  assert.deepEqual(Object.keys(rows[0] ?? {}), ["product_name"], "a failed read is not remembered as the answer: the next one asks again");
});
