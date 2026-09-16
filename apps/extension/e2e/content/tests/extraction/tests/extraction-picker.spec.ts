// The content-script picker (X4.2) against a real page: the overlay goes up,
// one trusted click chooses the list, and the click itself is not recorded.
//
// What these rows are really proving:
//
// - **The pick is not an action.** The picker's listeners are on `window` in
//   the capture phase and the recorder's are on `document` in the capture
//   phase, so the picker's `stopImmediatePropagation()` runs first and the
//   press that chose the list never reaches the recorder. That ordering was
//   reasoned from the DOM's capture path when the picker was designed and never
//   observed; here it is observed, on a real click delivered by the browser.
//   Registering the listeners on `document` instead makes the `dom.click` row
//   fail.
// - **The pick does not act on the page.** The product name is a link. Without
//   `preventDefault()` the click follows it, so the URL row fails and the page
//   the proposal describes is gone.
// - **The overlay is not a page change.** It is added and removed while
//   recording, and no `dom.mutation` counts it. Removing the recorder's filter
//   makes that row fail.
// - **D3 end to end.** Neither the message the frame sends nor the event it
//   records carries a product name; the preview is the one payload that carries
//   page text, and it goes to the extension's own UI and is never recorded.
//
// The message names are written out rather than imported, as `harness.ts`
// writes out the recorder's: a spec that shared the constants could not notice
// them changing. The proposal type is imported, because that is the contract
// the picker and the domain share.
//
// The spec sits two levels below `e2e/content/tests/` for the reason
// `inference.spec.ts` sets out: that directory is at the audit's 25-file limit,
// and a spec must sit directly inside a `tests/` root.

import type { WebAutomationExtractField, WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness, SentMessage } from "../../../index.js";

const PRODUCT_LINK = '[data-testid="product-link"]';
const PRODUCT_NAME = '[data-testid="product-name"]';
const OVERLAY = "[data-fluxiq-picker]";

/** A picked message as this spec reads it: the closed harness shape, narrowed to the fields the picker sends. */
type PickedMessage = SentMessage & {
  sessionId?: string;
  proposal?: WebAutomationExtractionProposal;
  refused?: string;
};

/** The recording settings these rows need: mutations counted, snapshots off so a payload is the event's own. */
const RECORDING = { captureMutations: true, captureInputValues: true, captureSnapshots: false };

async function startPick(harness: ContentHarness, sessionId: string): Promise<void> {
  const delivery = await harness.deliver({ type: "extraction.pick_start", sessionId, form: "list" });
  expect(delivery.responded, "the content script answered extraction.pick_start").toBe(true);
  expect(delivery.response).toEqual({ ok: true });
}

function pickedMessages(sent: readonly SentMessage[]): PickedMessage[] {
  return sent.filter((message) => message.type === "fluxiq.extractionPicked");
}

/** The proposal as the request it stands for, as `inference.spec.ts` builds it. */
function requestFrom(proposal: WebAutomationExtractionProposal): { item: string; fields: Record<string, WebAutomationExtractField> } {
  return {
    item: proposal.item,
    fields: Object.fromEntries(proposal.fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
}

test("product-catalog: a picked product proposes the eight cards, and the pick is neither recorded nor acted on", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  await harness.setRecording(true, RECORDING);
  const names = (await page.locator(PRODUCT_NAME).allInnerTexts()).map((name) => name.trim());
  const urlBefore = page.url();

  await startPick(harness, "pick-catalog");
  await expect(page.locator(OVERLAY), "the overlay host is in the page while picking").toHaveCount(1);

  // A trusted click, delivered by the browser, on the link inside the first card.
  await page.locator(PRODUCT_LINK).first().click();

  const picked = pickedMessages(await harness.messages());
  expect(picked).toHaveLength(1);
  expect(picked[0]?.sessionId).toBe("pick-catalog");
  const proposal = picked[0]?.proposal;
  expect(proposal, `the pick carried a proposal: ${JSON.stringify(picked[0])}`).toBeTruthy();
  if (!proposal) throw new Error("The pick carried no proposal.");
  expect(proposal.itemCount).toBe(8);
  expect(await page.locator(proposal.item).count()).toBe(8);

  // The press that picked is not an action: the recorder never saw it.
  expect(await harness.recordedEvents("dom.click")).toEqual([]);
  // And it did not act on the page: the link was not followed.
  expect(page.url()).toBe(urlBefore);
  // The overlay comes down with the pick.
  await expect(page.locator(OVERLAY)).toHaveCount(0);

  // D3: the message the frame sent quotes no product name.
  const wire = JSON.stringify(picked[0]);
  for (const name of names) expect(wire, `the picked message quotes no product name (${name})`).not.toContain(name);

  // Confirming it records exactly one executable extraction event.
  const definition = {
    form: "list",
    datasetId: "products-1a2b3c4d",
    label: "Products",
    request: requestFrom(proposal),
    fieldLabels: Object.fromEntries(proposal.fields.map((field) => [field.key, field.label])),
    itemCount: proposal.itemCount
  };
  const recorded = await harness.deliver({ type: "extraction.record", sessionId: "pick-catalog", definition });
  expect(recorded.response).toEqual({ ok: true });

  const events = await harness.recordedEvents("data.extract");
  expect(events).toHaveLength(1);
  expect(events[0]?.extraction).toEqual(definition);
  const recordedWire = JSON.stringify(events[0]);
  for (const name of names) expect(recordedWire, `the recorded extraction quotes no product name (${name})`).not.toContain(name);

  // The overlay's own arrival and departure are not page changes. `data.extract`
  // is executable, so any batch still pending went out ahead of it.
  expect(await harness.recordedEvents("dom.mutation")).toEqual([]);
});

test("product-catalog: Escape ends the pick, and the key that ended it is not recorded either", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  await harness.setRecording(true, RECORDING);
  const urlBefore = page.url();

  await startPick(harness, "pick-escape");
  await expect(page.locator(OVERLAY)).toHaveCount(1);
  await page.keyboard.press("Escape");

  await expect(page.locator(OVERLAY), "Escape takes the overlay host out of the page").toHaveCount(0);
  expect(await harness.recordedEvents("dom.keydown")).toEqual([]);
  expect(pickedMessages(await harness.messages())).toEqual([]);

  // The page is the page's again: the same click that the picker swallowed now
  // follows the link, which is what the picker was preventing. The recording
  // cannot be read for this, because following the link loads a new document
  // and with it a new content script, which is not recording.
  await page.locator(PRODUCT_LINK).first().click();
  await page.waitForURL((url) => url.href !== urlBefore);
  expect(page.url()).not.toBe(urlBefore);
});

test("product-catalog: a preview reads at most the limit, goes to the panel only, and is never recorded", async ({ openHarness, page }) => {
  const harness = await openHarness("product-catalog");
  await harness.setRecording(true, RECORDING);
  const names = (await page.locator(PRODUCT_NAME).allInnerTexts()).map((name) => name.trim());

  await startPick(harness, "pick-preview");
  await page.locator(PRODUCT_LINK).first().click();
  const proposal = pickedMessages(await harness.messages())[0]?.proposal;
  if (!proposal) throw new Error("The pick carried no proposal.");

  const before = await harness.recordedEvents();
  const nameField = proposal.fields.find((field) => field.label === "product-name");
  expect(nameField, "the proposal has the product-name field").toBeTruthy();
  if (!nameField) throw new Error("No product-name field.");
  // One column kept, the rest not asked for: an excluded column is never read
  // at all rather than read and hidden (D12).
  const request = { item: proposal.item, fields: { [nameField.key]: nameField.spec as WebAutomationExtractField } };

  const delivery = await harness.deliver({ type: "extraction.preview", sessionId: "pick-preview", request, limit: 5 });
  expect(delivery.responded, "the content script answered extraction.preview").toBe(true);
  const reply = delivery.response as { ok: boolean; rows?: Array<Record<string, string | null>> };
  expect(reply.ok).toBe(true);
  expect(reply.rows).toHaveLength(5);
  expect(reply.rows?.map((row) => Object.keys(row))).toEqual(Array.from({ length: 5 }, () => [nameField.key]));
  // The preview is the one payload that carries page text, and it carries it to
  // the extension's own UI (D3).
  expect(reply.rows?.[0]?.[nameField.key]).toBe(names[0]);

  // Reading it recorded nothing at all.
  expect(await harness.recordedEvents()).toEqual(before);
});
