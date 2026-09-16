// T1 coverage of the picker's worker half: who may drive it, what it sends into
// the page, and what a confirmed extraction records.
//
// The origin rows are the point of the file. `fluxiq.test.defineExtraction`
// runs a read and answers with the records, so a page under test that could
// send it would be able to drive FluxIQ's own reader and read the page back out
// of it. Every runtime message is asserted refused from a page sender, from
// another extension, and from an extension URL that is not one of the two
// control pages.

import assert from "node:assert/strict";
import test from "node:test";

import { isWebAutomationExtractFieldKey, webAutomationExtractListTimeoutMs, type WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, ExtensionStatus, RecordingState } from "../../shared/protocol";
import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_PICKED_MESSAGE, EXTRACTION_RUNTIME_MESSAGES } from "../../shared/extraction-messages";
import { ExtractionSessions, clearExtractionTab, handleExtractionControl, type ExtractionConfirmField, type ExtractionControlDeps } from "../extraction";
import type { FluxIQConnection } from "../connection";

/** Planted in every cell the fake page returns. Nothing durable may ever contain it. */
const PAGE_SENTINEL = "SENTINEL-PAGE-VALUE";

const AUTOMATION_TAB = 7;

const proposal: WebAutomationExtractionProposal = {
  container: "ul.products",
  item: "ul.products > li",
  itemCount: 8,
  confidence: 0.9,
  fields: [
    { key: "product_name", label: "Product name", coverage: 1, spec: { kind: "text", selector: ".name" } },
    { key: "price", label: "Price", coverage: 1, spec: { kind: "text", selector: ".price" } },
    { key: "card", label: "Card number", coverage: 1, spec: { kind: "text", selector: ".card", handling: "exclude" } }
  ]
};

/** What the panel sends after the user renamed nothing and left the sensitive column excluded. */
const confirmFields: ExtractionConfirmField[] = [
  { key: "product_name", label: "Product name", kind: "text", selector: ".name", handling: "include" },
  { key: "price", label: "Price", kind: "text", selector: ".price", handling: "include" },
  { key: "card_number", label: "Card number", kind: "text", selector: ".card", handling: "exclude" }
];

type SentMessage = { tabId: number; frameId: number | undefined; message: Record<string, unknown> };

type Harness = {
  deps: ExtractionControlDeps;
  sent: SentMessage[];
  ran: BrowserActionCommand[];
  storageWrites: unknown[];
  manager: FluxIQConnection;
};

const sidepanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;
const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup/index.html" } as chrome.runtime.MessageSender;
const frame = { id: "extension-id", tab: { id: AUTOMATION_TAB }, frameId: 0 } as chrome.runtime.MessageSender;

function harness(recordingState: RecordingState = "recording", activeTabId: number | null = AUTOMATION_TAB): Harness {
  const sent: SentMessage[] = [];
  const ran: BrowserActionCommand[] = [];
  const storageWrites: unknown[] = [];
  installChrome(storageWrites);
  let counter = 0;
  const deps: ExtractionControlDeps = {
    sessions: new ExtractionSessions(),
    sendToTab: async <TResponse,>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      const typed = message as Record<string, unknown>;
      sent.push({ tabId, frameId, message: typed });
      return pageAnswer(typed) as TResponse;
    },
    ensureContentScript: async () => undefined,
    runAction: async (request) => {
      ran.push(request.action);
      await request.attachTabForRecording(AUTOMATION_TAB);
      return { result: succeededExtraction(request.action) };
    },
    newId: () => `s${(counter += 1)}`
  };
  const status = { recordingState, ...(activeTabId === null ? {} : { activeTabId }) } as unknown as ExtensionStatus;
  return { deps, sent, ran, storageWrites, manager: { status: () => status } as unknown as FluxIQConnection };
}

/** Only what `isControlPage` and a storage spy need; nothing here touches the real browser. */
function installChrome(writes: unknown[]): void {
  const area = {
    set: async (items: unknown) => { writes.push(items); },
    get: async () => ({}),
    remove: async () => undefined,
    clear: async () => undefined
  };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: { id: "extension-id", getURL: (path: string) => `chrome-extension://extension-id/${path}` },
      storage: { local: area, session: area, sync: area }
    }
  });
}

/** The page's side of the four content messages, with every preview cell carrying the sentinel. */
function pageAnswer(message: Record<string, unknown>): unknown {
  if (message.type === EXTRACTION_CONTENT_MESSAGES.preview) {
    const request = message.request as { fields: Record<string, unknown> };
    const row = Object.fromEntries(Object.keys(request.fields).map((key) => [key, `${PAGE_SENTINEL}-${key}`]));
    return { ok: true, rows: [row, row] };
  }
  return { ok: true };
}

function succeededExtraction(action: BrowserActionCommand): BrowserActionResult {
  const fields = Object.keys(action.extractList?.fields ?? {});
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    validation: { status: "passed", expected: "records", actual: "1 record" },
    extracted: [Object.fromEntries(fields.map((key) => [key, `${PAGE_SENTINEL}-${key}`]))],
    extraction: { recordCount: 1, pagesRead: 2, truncated: false, missingFields: [], fieldNames: fields },
    startedAt: 1_000,
    finishedAt: 1_450
  };
}

function sentOfType(sent: SentMessage[], type: string): SentMessage | undefined {
  return sent.find((entry) => entry.message.type === type);
}

function previewFieldNames(sent: SentMessage[]): string[][] {
  return sent
    .filter((entry) => entry.message.type === EXTRACTION_CONTENT_MESSAGES.preview)
    .map((entry) => Object.keys((entry.message.request as { fields: Record<string, unknown> }).fields));
}

function responseOf(result: Awaited<ReturnType<typeof handleExtractionControl>>): Record<string, unknown> {
  return result.handled ? result.response as Record<string, unknown> : { handled: false };
}

async function startAndPick(h: Harness): Promise<string> {
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, frame, h.manager, h.deps);
  return sessionId;
}

test("every runtime message, the test seam included, is refused outside the two control pages", async () => {
  const senders: chrome.runtime.MessageSender[] = [
    { id: "extension-id", url: "http://127.0.0.1/products", tab: { id: AUTOMATION_TAB }, frameId: 0 },
    { id: "other-extension", url: "chrome-extension://extension-id/sidepanel/index.html" },
    { id: "extension-id", url: "chrome-extension://extension-id/other.html" },
    { id: "extension-id" }
  ] as chrome.runtime.MessageSender[];
  for (const sender of senders) {
    for (const type of Object.values(EXTRACTION_RUNTIME_MESSAGES)) {
      const h = harness();
      const response = responseOf(await handleExtractionControl({ type, definition: { form: "list" } }, sender, h.manager, h.deps));
      assert.equal(response.ok, false, `${type} from ${String(sender.url)}`);
      assert.equal(response.code, "forbidden", `${type} from ${String(sender.url)}`);
      assert.equal(typeof response.error, "string", "the panel is given a sentence to show");
      assert.equal(h.sent.length, 0, "no message reached the page");
      assert.equal(h.ran.length, 0, "no action ran");
    }
  }
});

test("a page under test cannot run an extraction through the test seam", async () => {
  const h = harness();
  const pageUnderTest = { id: "extension-id", url: "http://127.0.0.1/products", tab: { id: AUTOMATION_TAB }, frameId: 0 } as chrome.runtime.MessageSender;
  const definition = {
    form: "list",
    datasetId: "products:abc123",
    label: "Products",
    itemCount: 8,
    fieldLabels: { product_name: "Product name" },
    request: { item: "ul.products > li", fields: { product_name: { kind: "text", selector: ".name" } } }
  };
  const refused = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.testDefineExtraction, definition }, pageUnderTest, h.manager, h.deps));
  assert.equal(refused.code, "forbidden");
  assert.equal(h.ran.length, 0, "the reader never ran");
  const allowed = responseOf(await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.testDefineExtraction, definition }, popup, h.manager, h.deps));
  assert.equal(allowed.ok, true, "the same message from the control page runs");
  assert.equal(h.ran[0]?.actionType, "web.dom.extract_list");
});

test("an unrecognised message is not handled here", async () => {
  const h = harness();
  assert.deepEqual(await handleExtractionControl({ type: "fluxiq.getStatus" }, sidepanel, h.manager, h.deps), { handled: false });
});

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
  async function confirmWith(paginate: unknown): Promise<number | undefined> {
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
  const expected = (paginate?: unknown) => webAutomationExtractListTimeoutMs({
    item: proposal.item,
    fields: { product_name: { kind: "text" } },
    ...(paginate === undefined ? {} : { paginate })
  } as Parameters<typeof webAutomationExtractListTimeoutMs>[0]);
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

test("a whole pick, preview and confirm writes nothing to chrome.storage", async () => {
  const h = harness();
  const sessionId = await startAndPick(h);
  await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.getSession, sessionId }, sidepanel, h.manager, h.deps);
  await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.confirm, sessionId, request: { label: "Products", fields: confirmFields } },
    sidepanel,
    h.manager,
    h.deps
  );
  assert.deepEqual(h.storageWrites, []);
});

test("the test seam answers the control page with the records and stores none of them", async () => {
  const h = harness("idle");
  const definition = {
    form: "list",
    datasetId: "products:abc123",
    label: "Products",
    itemCount: 8,
    fieldLabels: { product_name: "Product name" },
    request: { item: "ul.products > li", fields: { product_name: { kind: "text", selector: ".name" } } }
  };
  const response = responseOf(await handleExtractionControl(
    { type: EXTRACTION_RUNTIME_MESSAGES.testDefineExtraction, definition },
    sidepanel,
    h.manager,
    h.deps
  ));
  assert.deepEqual(response, {
    ok: true,
    records: [{ product_name: `${PAGE_SENTINEL}-product_name` }],
    pagesRead: 2,
    truncated: false,
    durationMs: 450
  });
  assert.equal(sentOfType(h.sent, EXTRACTION_CONTENT_MESSAGES.record), undefined, "nothing is recorded outside a recording");
  assert.deepEqual(h.storageWrites, []);
  assert.equal(h.deps.sessions.get(), undefined, "the seam opens no session, so no records are held");
});

test("the test seam refuses a definition the domain would refuse, before anything runs", async () => {
  for (const definition of [
    { form: "list", datasetId: "products:abc", label: "Products", itemCount: 8, request: { item: "li", fields: {} } },
    { form: "list", datasetId: "products:abc", label: "Products", itemCount: 8, request: { item: "li", fields: { "Product name": { kind: "text" } } } },
    { form: "list", datasetId: "products:abc", label: "Products", itemCount: 8, request: { item: "li", fields: { a: { kind: "text", handling: "exclude" } } } },
    { form: "list" },
    "not an object"
  ]) {
    const h = harness();
    const response = responseOf(await handleExtractionControl(
      { type: EXTRACTION_RUNTIME_MESSAGES.testDefineExtraction, definition },
      sidepanel,
      h.manager,
      h.deps
    ));
    assert.equal(response.ok, false, JSON.stringify(definition));
    assert.equal(response.code, "invalid_definition", JSON.stringify(definition));
    assert.equal(h.ran.length, 0, JSON.stringify(definition));
  }
});
