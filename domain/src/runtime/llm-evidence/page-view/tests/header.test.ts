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
