// Who may drive the picker, and what it refuses to keep.
//
// The origin rows are the point of the file. `fluxiq.test.defineExtraction` runs
// a read and answers with the records, so a page under test that could send it
// would be able to drive FluxIQ's own reader and read the page back out of it.
// Every runtime message is asserted refused from a page sender, from another
// extension, and from an extension URL that is not one of the two control pages.
//
// The storage rows are the same claim from the other side: what the worker is
// allowed to hold. A whole pick, preview and confirm writes nothing to
// `chrome.storage`, and the one reply that does carry records leaves none behind.

import assert from "node:assert/strict";
import test from "node:test";

import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_RUNTIME_MESSAGES } from "../../shared/extraction-messages";
import { handleExtractionControl } from "../extraction";
import {
  AUTOMATION_TAB,
  PAGE_SENTINEL,
  confirmFields,
  harness,
  popup,
  proposal,
  responseOf,
  sentOfType,
  sidepanel,
  startAndPick
} from "./extraction-harness";

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

// The picker's `value` form, and the overlay after a pick that proposed nothing.
// Both were wired at one end only: the frame could send a value pick and the
// worker had no branch for it, and the frame closes its overlay on every pick
// while the worker's session stayed `picking` as though it were still up.
