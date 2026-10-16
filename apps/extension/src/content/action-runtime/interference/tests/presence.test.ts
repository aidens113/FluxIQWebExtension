// On a missing target only a wall is worth clearing for (t656, `../presence.ts`,
// `../page-wall.ts`): a painted modal, or a layer on a scrim over the
// viewport's centre. A header's popover and a corner card are layers with a
// way out, and neither can hide a target waiting to be drawn.

import assert from "node:assert/strict";
import test from "node:test";
import { overlaysOverPage } from "../overlays";
import { isPageWall } from "../page-wall";
import { clearableLayerOverPage } from "../presence";
import { pressWaysOut } from "../press-ways-out";
import { h, place, toggleHidden, withPage, zonedView } from "./fake-layer";
import { travelPage } from "./travel-page";

/** What a missing step target says of itself: a control this page has not drawn. */
const MISSING_TARGET = { selector: "#trip-summary-continue", names: ["Continue to payment"] };

test("an open header flyout is a layer with a way out, and no wall: a missing target is not cleared for it", () => {
  const page = travelPage();
  toggleHidden(page.flyout);
  withPage(page.body, () => {
    assert.deepEqual(overlaysOverPage(), [page.header], "the probes find the header holding the open flyout");
    assert.equal(isPageWall(page.header), false);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), false);
    assert.deepEqual(pressWaysOut(MISSING_TARGET, "walls"), []);
  }, page.view);
  assert.deepEqual(page.flyoutClose.events, []);
});

test("a consent wall, a painted modal, is a wall: it is cleared for a missing target by declining", () => {
  const reject = h("button", { type: "button" }, "Reject all");
  const wall = place(h("div", { role: "dialog", "aria-modal": "true", "aria-label": "Your privacy choices" }, [
    h("p", {}, "We use cookies to remember your searches and measure our site."),
    h("button", { type: "button" }, "Accept all"),
    reject
  ]), { position: "fixed", box: { x: 340, y: 160, width: 600, height: 400 } });
  const results = h("main", {}, [h("h1", {}, "Stays in Lisbon")]);
  const body = h("body", {}, [results, wall]);
  withPage(body, () => {
    assert.equal(isPageWall(wall), true);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), true);
    assert.deepEqual(pressWaysOut(MISSING_TARGET, "walls").map((layer) => layer.controlName), ["Reject all"]);
  }, zonedView([wall], results));
  assert.equal(reject.pressed, true);
});

test("a dialog on a scrim over the viewport's centre is a wall though it declares no modal", () => {
  const noThanks = h("button", { type: "button" }, "No thanks");
  const offer = place(h("div", { role: "dialog", "aria-label": "Members save more" }, [h("p", {}, "Sign in to see member prices"), noThanks]), { box: { x: 440, y: 260, width: 400, height: 200 } });
  const scrim = place(h("div", {}, [offer]), { position: "fixed", box: { x: 0, y: 0, width: 1280, height: 720 } });
  const results = h("main", {}, [h("h1", {}, "Stays in Lisbon")]);
  const body = h("body", {}, [results, scrim]);
  withPage(body, () => {
    assert.equal(isPageWall(offer), true);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), true);
  }, zonedView([offer, scrim], results));
});

test("a scrim beside the dialog, not around it, walls the page too", () => {
  const close = h("button", { type: "button", "aria-label": "Close" }, "×");
  const scrim = place(h("div", {}), { position: "fixed", box: { x: 0, y: 0, width: 1280, height: 720 } });
  const offer = place(h("div", { role: "dialog", "aria-label": "Price drop" }, [close, h("p", {}, "Prices for your dates dropped")]), { position: "fixed", box: { x: 440, y: 260, width: 400, height: 200 } });
  const results = h("main", {}, [h("h1", {}, "Stays in Lisbon")]);
  const body = h("body", {}, [results, scrim, offer]);
  withPage(body, () => {
    assert.equal(isPageWall(offer), true);
  }, zonedView([offer, scrim], results));
});

test("a corner card with a close glyph and nothing behind it is no wall", () => {
  const close = h("button", { type: "button", "aria-label": "Close" }, "×");
  const card = place(h("div", { role: "dialog", "aria-label": "Need help?" }, [close, h("p", {}, "Chat with a travel adviser")]), { position: "fixed", box: { x: 1000, y: 560, width: 260, height: 140 } });
  const results = h("main", {}, [h("h1", {}, "Stays in Lisbon")]);
  const body = h("body", {}, [results, card]);
  withPage(body, () => {
    assert.deepEqual(overlaysOverPage(), [card]);
    assert.equal(isPageWall(card), false);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), false);
    // A covered target is still cleared for it, as before.
    assert.deepEqual(pressWaysOut(undefined, "any").map((layer) => layer.name), ["Need help?"]);
  }, zonedView([card], results));
});

test("with no window, as in a frame being torn down, nothing but a declared modal can be a wall", () => {
  const page = travelPage();
  toggleHidden(page.flyout);
  withPage(page.body, () => {
    assert.equal(isPageWall(page.header), false);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), false);
  });
});
