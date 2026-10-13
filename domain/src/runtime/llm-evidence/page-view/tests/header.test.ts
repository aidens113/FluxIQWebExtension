// The header lines, each only when it has something to say, in order.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmPageText } from "../page-text";
import { fixturePacket } from "./packet-fixture";

const headerOf = (text: string): string[] => text.slice(0, text.indexOf("\n\n")).split("\n");

test("a page with nothing else to say has its title, its URL and its view", () => {
  const text = webLlmPageText(fixturePacket([{ tag: "button", name: "Go" }], { title: "Kettles \"on sale\"", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 } }));
  assert.deepEqual(headerOf(text), [
    "PAGE \"Kettles \\\"on sale\\\"\"",
    // No link line shares a prefix of the path, so ~ is the origin.
    "URL ~/store/s?k=kettle   (~ = https://shop.test)",
    "VIEW 1280x720 at the top · 1 elements with visible words or a control, in page order · find_on_page searches the rest"
  ]);
  assert.equal(text.split("\n\n")[1], "t1 button \"Go\"", "one blank line, then the element lines");
});

test("the view says where the window is scrolled, or nothing of its size without a viewport", () => {
  const scrolled = webLlmPageText(fixturePacket([], { viewport: { width: 390, height: 844, scrollX: 0, scrollY: 1200 } }));
  assert.match(scrolled, /^VIEW 390x844 scrolled to y=1200 · 0 elements/mu);
  const sideways = webLlmPageText(fixturePacket([], { viewport: { width: 390, height: 844, scrollX: 40, scrollY: 0 } }));
  assert.match(sideways, /^VIEW 390x844 scrolled to x=40 y=0 · /mu);
  const unmeasured = webLlmPageText(fixturePacket([{ tag: "span", text: "a" }, { tag: "span", text: "b" }]));
  assert.match(unmeasured, /^VIEW · 2 elements with visible words or a control, in page order · find_on_page searches the rest$/mu);
  assert.doesNotMatch(unmeasured, /^PAGE/mu, "no title, no PAGE line");
});

test("everything in front of the page, its loading, its frames, how it was reached, the selection and a short capture, in order", () => {
  const text = webLlmPageText(fixturePacket([], {
    title: "Checkout",
    blockedBy: [{ target: "t209", name: "Minimum price", blocks: 2 }, { target: "t259", blocks: 1, kind: "consent" }, { role: "dialog" }],
    dialogs: [{ target: "t5", name: "Cookie preferences", modal: true, kind: "consent" }, { role: "alertdialog" }],
    loading: { readyState: "interactive", busy: true, indicators: [{ kind: "spinner", label: "Loading results" }, { kind: "progressbar" }], pendingNavigation: true },
    frame: { isTop: true, unansweredFrameIds: [2, 3] },
    navigation: { type: "back_forward", redirects: 1, referrer: "https://shop.test/store/cart", url: "https://shop.test/store/old" },
    selectedText: "Gooseneck",
    captureTruncated: true,
    truncated: true
  }));
  assert.deepEqual(headerOf(text).slice(3), [
    "COVERING t209 \"Minimum price\" covers 2 · t259 consent covers 1 · dialog",
    "DIALOG t5 \"Cookie preferences\" modal consent · alertdialog",
    "LOADING interactive busy spinner \"Loading results\" progressbar pending-navigation",
    "FRAMES 2,3 did not answer",
    "ARRIVED back_forward 1 redirect from ~/store/cart at ~/store/old",
    "SELECTED \"Gooseneck\"",
    "CAPTURE incomplete: the browser left elements out"
  ]);
});

test("an arrival says nothing when the navigation only repeats the location", () => {
  const text = webLlmPageText(fixturePacket([], { navigation: { url: "https://shop.test/store/s?k=kettle" } }));
  assert.doesNotMatch(text, /ARRIVED/u);
  const redirected = webLlmPageText(fixturePacket([], { navigation: { redirects: 3 } }));
  assert.match(redirected, /^ARRIVED 3 redirects$/mu);
});

// Lane D round 12 build 2 (`run-mv636xyp-2e4fe54d`, N5, t486): after a confirm the
// header said `COVERING t692` and nothing more. The blocker record carried only
// its handle, and t692 printed no line of its own, so the model could not tell
// what covered the page or how to close it. A blocker the capture describes is
// now named from its own element: its words or the heading inside it, its
// role or layer kind, how many controls it covers, and the control inside it
// that closes it.
test("a blocker named only by its handle is named from its element: words, heading, role, covers and its close control", () => {
  const text = webLlmPageText(fixturePacket([
    { tag: "div", target: "t692", role: "banner", coversCount: 3 },
    { tag: "h2", target: "t693", parent: "t692", text: "Free pickup today" },
    { tag: "button", target: "t694", parent: "t692", name: "Shop deals" },
    { tag: "button", target: "t695", parent: "t692", name: "Close" },
    { tag: "button", target: "t696", name: "Add to cart" }
  ], { blockedBy: [{ target: "t692" }] }));
  assert.match(text, /^COVERING t692 "Free pickup today" banner covers 3 close t695 "Close"$/mu);
});

test("a cover's own name wins over its heading, its layer kind over its role, and a long text is cut", () => {
  const long = "Sign up for our newsletter and get ten percent off your first order of anything at all";
  const text = webLlmPageText(fixturePacket([
    { tag: "div", target: "t10", role: "dialog", kind: "promotion", name: "Newsletter" },
    { tag: "button", target: "t11", parent: "t10", name: "No thanks" },
    { tag: "div", target: "t20", text: long }
  ], { blockedBy: [{ target: "t10" }, { target: "t20" }] }));
  const covering = text.split("\n").find((line) => line.startsWith("COVERING "));
  assert.equal(covering, `COVERING t10 "Newsletter" promotion close t11 "No thanks" · t20 "${long.slice(0, 59)}…"`);
});

test("a blocker the capture does not describe is said as its record says, as before", () => {
  const text = webLlmPageText(fixturePacket([{ tag: "button", name: "Go" }], { blockedBy: [{ target: "t900", blocks: 1 }] }));
  assert.match(text, /^COVERING t900 covers 1$/mu);
});

// N5's cause (t486): the extension reports a pinned bar the click's own scroll
// escapes as a blocker that covers nothing (`apps/extension/src/content/evidence/overlays.ts`,
// `escapedByScrolling`), and the record said `role: "banner"` -- route state 7's
// `blockedBy: "banner"` -- which the header dropped whenever the blocker had a handle.
test("a blocker's own role is said beside its handle, even when its element says nothing", () => {
  const text = webLlmPageText(fixturePacket([{ tag: "button", name: "Go" }], { blockedBy: [{ target: "t692", role: "banner" }] }));
  assert.match(text, /^COVERING t692 banner$/mu);
});

// t507 (`run-mv6qrcln-2e194a12`, step 0008): a help widget's greeting card over
// a consent sheet. The header named the card as the widget's closer -- its
// words start with its "×" -- though a press on the card opens the widget;
// the "×" inside it, which carries no cursor or listener of its own, closes it.
test("a cover's closer is the × inside its pressable card, never the card whose words start with it", () => {
  const text = webLlmPageText(fixturePacket([
    { tag: "div", target: "t9", frontLayer: true, coversCount: 3 },
    { tag: "div", target: "t10", parent: "t9", name: "Help", cursor: "pointer", hasClickHandler: true },
    { tag: "div", target: "t11", parent: "t9", text: "× Need a hand? Ask our assistant anything.", cursor: "pointer", hasClickHandler: true },
    { tag: "div", target: "t12", parent: "t11", name: "Close", text: "×" },
    { tag: "button", target: "t20", name: "Decline optional", coveredBy: ["t9"] }
  ], { blockedBy: [{ target: "t9" }] }));
  assert.match(text, /^COVERING t9 .*close t12 "Close"$/mu);
});

