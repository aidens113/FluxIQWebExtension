// The page view as keyed lines (t1036, P-b): header lines keyed by their label,
// the blank line `-`, element lines by their handle and marker lines by the
// element line they stand before; the texts joined by "\n" are the page text.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmPageText } from "../page-text";
import { webLlmPageView } from "../evidence-view";
import { publishedWebLlmPage } from "../published-page";
import { webLlmPageViewText } from "../joined-text";
import { webLlmShownPageText } from "../../shown-page";
import { fixturePacket } from "./packet-fixture";

const PACKET = fixturePacket([
  { tag: "span", text: "Top" },
  { tag: "a", href: "https://shop.test/", name: "Home", landmark: "banner" },
  { tag: "input", name: "Card name", landmark: "main", form: "checkout", item: { index: 1, total: 2 } },
  { tag: "button", name: "Pay", landmark: "main", form: "checkout", item: { index: 2, total: 2 } }
], { title: "Checkout", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, dialogs: [{ name: "Cookies", modal: true }] });

test("each line is keyed: the header by its label, the blank line `-`, an element by its handle, a marker by the element after it", () => {
  const view = webLlmPageView(PACKET);
  assert.deepEqual(view.lines, [
    { key: "PAGE", text: "PAGE \"Checkout\"" },
    { key: "URL", text: "URL ~/store/s?k=kettle   (~ = https://shop.test)" },
    { key: "VIEW", text: "VIEW 1280x720 at the top · 4 elements with visible words or a control, in page order" },
    { key: "DIALOG", text: "DIALOG \"Cookies\" modal" },
    { key: "-", text: "" },
    { key: "t1", text: "t1 \"Top\"" },
    { key: "^t2", text: "[banner]" },
    { key: "t2", text: "t2 link \"Home\" ~/" },
    { key: "^t3", text: "[main form checkout]" },
    { key: "^t3.2", text: "- 1/2" },
    { key: "t3", text: "t3 field \"Card name\"" },
    { key: "^t4", text: "- 2/2" },
    { key: "t4", text: "t4 button \"Pay\"" }
  ]);
});

test("the texts joined are exactly the page text, and the keys are unique", () => {
  const view = webLlmPageView(PACKET);
  assert.equal(webLlmPageViewText(view), webLlmPageText(PACKET));
  assert.equal(new Set(view.lines.map((line) => line.key)).size, view.lines.length);
  assert.ok(view.lines.every((line) => line.extra === undefined), "an ordinary view has no extra lines");
});

test("the view says nothing of a page search: there is none", () => {
  assert.doesNotMatch(webLlmPageText(PACKET), /find_on_page|searches the rest/u);
});

test("the view is keyed by the normalized location, and published as `pageView`", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Go" }], { location: "https://Shop.test:443/store/s/?z=1&k=kettle#reviews" }));
  assert.equal(published.pageView.key, "https://shop.test/store/s", "the query is not part of the key (user, 2026-11-25)");
  assert.equal("page" in published, false, "the page string is no longer a key");
  assert.equal(webLlmShownPageText(published), webLlmPageViewText(published.pageView));
});

test("a page published before keyed lines is still read as its text", () => {
  assert.equal(webLlmShownPageText({ schemaVersion: "web-llm-page.v3", page: "URL https://shop.test/\n\nt1 button \"Go\"" }), "URL https://shop.test/\n\nt1 button \"Go\"");
  assert.equal(webLlmShownPageText({ pageView: { key: "k", lines: [{ key: "t1", text: 3 }] } }), undefined);
  assert.equal(webLlmShownPageText("t1 button"), undefined);
});
