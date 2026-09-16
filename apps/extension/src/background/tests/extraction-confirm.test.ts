// What a confirmed extraction records, runs, and answers.
//
// The definition is built from the proposal the worker is holding and the
// columns the panel settled on, put through the domain's own reader, recorded,
// and only then run -- so a read that fails still leaves the definition a Flow
// can be built from. The reply carries counts and the name the user gave, which
// is what the panel says back to them, and never a cell the page returned.
//
// Who may confirm at all is `extraction-boundary.test.ts`; the pick that
// produced the proposal is `extraction-control.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";

import { isWebAutomationExtractFieldKey, webAutomationExtractListTimeoutMs, type WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";
import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_PICKED_MESSAGE, EXTRACTION_RUNTIME_MESSAGES } from "../../shared/extraction-messages";
import { handleExtractionControl, type ExtractionConfirmField, type ExtractionControlDeps } from "../extraction";
import {
  AUTOMATION_TAB,
  PAGE_SENTINEL,
  confirmFields,
  frame,
  harness,
  proposal,
  responseOf,
  sentOfType,
  sidepanel,
  startAndPick
} from "./extraction-harness";

test("confirm records well-formed keys, runs the read, and puts no page value in the recording", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps);
  const request = { label: "Product catalog", item: proposal.item, fields: confirmFields, itemCount: 8 };
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.deepEqual(
    { recordCount: response.recordCount, pagesRead: response.pagesRead, truncated: response.truncated, durationMs: response.durationMs },
    { recordCount: 1, pagesRead: 2, truncated: false, durationMs: 450 }
  );
  assert.equal(response.datasetId, "product-catalog:s2");
  assert.equal(Object.keys(response).includes("records"), false, "the panel is told counts, never rows");

  const recorded = sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.record);
  const definition = recorded?.message.definition as {
    datasetId: string;
    itemCount: number;
    fieldLabels: Record<string, string>;
    request: { item: string; fields: Record<string, { handling?: string }> };
  };
  assert.equal(recorded?.frameId, 0);
  assert.equal(definition.request.item, proposal.item, "the item selector comes from the held proposal");
  assert.deepEqual(Object.keys(definition.request.fields), ["product_name", "price", "card_number"]);
  // Asked of the domain predicate itself, not of a pattern restated here: Core
  // refuses a whole candidate over one bad key, and one rule should say what a
  // key is.
  for (const key of Object.keys(definition.request.fields)) assert.ok(isWebAutomationExtractFieldKey(key), key);
  assert.equal(definition.request.fields.card_number?.handling, "exclude", "the exclusion is recorded so detection does not propose the column again");
  assert.deepEqual(definition.fieldLabels, { product_name: "Product name", price: "Price", card_number: "Card number" });
  assert.equal(definition.itemCount, 8);
  assert.equal(JSON.stringify(definition).includes(PAGE_SENTINEL), false, "no row read off the page is in the recorded definition");

  assert.equal(h.ran.length, 1);
  assert.equal(h.ran[0]?.actionType, "web.dom.extract_list");
  assert.deepEqual(Object.keys(h.ran[0]?.extractList?.fields ?? {}), ["product_name", "price", "card_number"]);
  assert.equal(h.deps.sessions.get(sessionId)?.state, "recorded");
  assert.deepEqual(h.deps.sessions.get(sessionId)?.preview, [], "the preview is dropped once the extraction is recorded");
});

test("a confirm that names no columns records the proposal's own, with its pre-selected exclusion", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, label: "Products" },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.equal(response.ok, true, JSON.stringify(response));
  const definition = sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.record)?.message.definition as {
    request: { fields: Record<string, { handling?: string }> };
    itemCount: number;
  };
  assert.deepEqual(Object.keys(definition.request.fields), ["product_name", "price", "card"]);
  assert.equal(definition.request.fields.card?.handling, "exclude");
  assert.equal(definition.itemCount, 8);
});

test("a confirm that repeats a key records nothing, rather than one column fewer", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const repeated: ExtractionConfirmField[] = [
    { key: "price", label: "Price", kind: "text", selector: ".price", handling: "include" },
    { key: "price", label: "List price", kind: "text", selector: ".list", handling: "include" }
  ];
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request: { label: "Products", fields: repeated } },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.equal(response.code, "invalid_definition");
  assert.equal(sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.record), undefined);
  assert.equal(h.ran.length, 0);
});

test("a paginated read gets a budget scaled by the pages it may follow, not a flat ceiling", async () => {
  async function confirmWith(paginate: WebAutomationExtractListPagination | undefined): Promise<number | undefined> {
    const h = harness();
    const sessionId = await startAndPick(h);
    const request = { label: "Products", fields: confirmFields, itemCount: 8, ...(paginate === undefined ? {} : { paginate }) };
    const response = responseOf(await handleExtractionControl(
      { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request },
      sidepanel,
      h.manager,
      h.deps
    ));
    assert.equal(response.ok, true, JSON.stringify(response));
    return h.ran[0]?.timeoutMs;
  }

  const onePage = await confirmWith(undefined);
  const fivePages = await confirmWith({ next: "a.next", maxPages: 5 });
  const twentyPages = await confirmWith({ mode: "loadMore", control: "button.more", maxPages: 20 });

  // The budget is the domain's, not this file's: asserting against the same
  // function the recorded node declares is what keeps the read the worker runs
  // and the read a replayed Flow runs on one number.
  const expected = (paginate?: WebAutomationExtractListPagination) => webAutomationExtractListTimeoutMs({
    item: proposal.item,
    fields: { product_name: { kind: "text" } },
    ...(paginate === undefined ? {} : { paginate })
  });
  assert.equal(onePage, expected());
  assert.equal(fivePages, expected({ next: "a.next", maxPages: 5 }));
  assert.ok(fivePages !== undefined && onePage !== undefined && fivePages > onePage, `${String(fivePages)} > ${String(onePage)}`);

  // The defect this replaces: a flat 60,000 ms ceiling cut every read past six
  // pages short, with nothing in the panel saying why.
  assert.ok(twentyPages !== undefined && twentyPages > 60_000, `a 20-page read gets ${String(twentyPages)} ms`);
});

test("a caller that names its own timeout keeps it", async () => {
  const h = harness("idle");
  const definition = {
    form: "list",
    datasetId: "products:abc123",
    label: "Products",
    itemCount: 8,
    fieldLabels: { product_name: "Product name" },
    request: { item: "ul.products > li", fields: { product_name: { kind: "text", selector: ".name" } } }
  };
  await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.testDefineExtraction, definition, timeoutMs: 1_234 },
    sidepanel,
    h.manager,
    h.deps
  );
  assert.equal(h.ran[0]?.timeoutMs, 1_234);
});

test("the recording is written before the read runs, so a failed read still leaves the definition", async () => {
  const h = harness();
  const order: string[] = [];
  const sessionId = await startAndPick(h);
  const sendToTab = h.deps.sendToTab;
  const deps: ExtractionControlDeps = {
    ...h.deps,
    sendToTab: async <TResponse,>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      if ((message as { type?: string }).type === EXTRACTION_CONTENT_MESSAGES.record) order.push("record");
      return sendToTab<TResponse>(tabId, message, frameId);
    },
    runAction: async (request) => {
      order.push("run");
      return {
        result: {
          commandId: request.action.commandId,
          actionType: request.action.actionType,
          status: "failed",
          validation: { status: "failed", expected: "records", actual: "none" },
          message: "The list matched nothing.",
          startedAt: 1,
          finishedAt: 2
        }
      };
    }
  };
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request: { label: "Products", fields: confirmFields } },
    sidepanel,
    h.manager,
    deps
  ));
  assert.deepEqual(response, { ok: false, code: "run_failed", error: "The list matched nothing." });
  assert.deepEqual(order, ["record", "run"]);
});

test("confirm outside a recording is refused, and nothing reaches the page", async () => {
  const h = harness("idle");
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, frame, h.manager, h.deps);
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request: { label: "Products", fields: confirmFields } },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.equal(response.code, "not_recording");
  assert.equal(sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.record), undefined);
  assert.equal(h.ran.length, 0);
});

test("the confirm reply says what was captured, in counts and no page value", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  const request = { label: "Product catalog", item: proposal.item, fields: confirmFields, itemCount: 8 };
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request },
    sidepanel,
    h.manager,
    h.deps
  ));

  assert.equal(response.ok, true, JSON.stringify(response));
  assert.equal(response.label, "Product catalog", "the name the user gave, which the panel says back to them");
  assert.equal(typeof response.datasetId, "string");
  assert.equal(response.recordCount, 1, "one record, because that is what the fake page returned");
  assert.equal(response.pagesRead, 2);
  assert.equal(response.truncated, false);
  assert.equal(typeof response.durationMs, "number");
  assert.equal(JSON.stringify(response).includes(PAGE_SENTINEL), false, "counts, never a cell (D3)");
});
