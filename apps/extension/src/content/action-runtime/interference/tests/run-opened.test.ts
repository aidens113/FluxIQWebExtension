// The layers a press of the run opened are the Flow's own, and the clearing
// leaves them alone until they leave (t656, `../run-opened.ts`).
//
// The case it was written for, on another kind of site: a step opens a
// header picker drawn in a custom element's shadow root, an optional step's
// target is missing, and the clearing for that missing target must not close
// the picker the next step works in -- while a promotion the page put up on
// its own timer is still closed.

import assert from "node:assert/strict";
import test from "node:test";
import { clearableLayerOverPage } from "../presence";
import { pressWaysOut } from "../press-ways-out";
import { runOpenedLayers } from "../run-opened";
import { closesOnPress, h, onPress, place, toggleHidden, withPage, zonedView } from "./fake-layer";
import { travelPage, type TravelPage } from "./travel-page";

/** What the step that is missing its target says of it: an app banner's "Not now" this page never drew. */
const MISSING_TARGET = { selector: "#app-banner-dismiss", names: ["Not now"] };

/** Presses the currency chip as a step does: the layers before, the press, then the note. */
function pressChip(page: TravelPage): void {
  const before = runOpenedLayers.snapshot();
  page.chip.dispatchEvent(new Event("click"));
  runOpenedLayers.note(page.chip, before);
}

test("an absent-target clearing spares the flyout the run opened and still presses the page's own offer", () => {
  const page = travelPage();
  withPage(page.body, () => {
    pressChip(page);
    assert.equal(runOpenedLayers.has(page.header), true, "the header holding the opened flyout is recorded as the press's");
    page.showOffer();
    assert.equal(clearableLayerOverPage(MISSING_TARGET), true, "the offer is a wall over the page");
    assert.deepEqual(pressWaysOut(MISSING_TARGET, "walls").map((layer) => layer.controlName), ["No thanks"]);
    assert.equal(page.noThanks.pressed, true);
    // Covered rather than missing, every layer in the way is cleared -- but not the run's.
    assert.deepEqual(pressWaysOut(undefined, "any"), []);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), false);
  }, page.view);
  assert.deepEqual(page.flyoutClose.events, [], "the flyout's close glyph was never pressed");
  assert.equal(page.flyout.getClientRects().length > 0, true, "the flyout is still open for the next step");
});

test("without the press's record the same flyout is cleared, so the record is what spares it", () => {
  const page = travelPage();
  withPage(page.body, () => {
    toggleHidden(page.flyout);
    assert.deepEqual(pressWaysOut(undefined, "any").map((layer) => layer.controlName), ["Close"]);
  }, page.view);
  assert.equal(page.flyoutClose.pressed, true);
});

test("an offer the page shows during the press is new but not tied to it, so it stays clearable", () => {
  const page = travelPage();
  onPress(page.chip, () => {
    toggleHidden(page.flyout);
    page.showOffer();
  });
  withPage(page.body, () => {
    pressChip(page);
    assert.equal(runOpenedLayers.has(page.header), true);
    assert.equal(runOpenedLayers.has(page.offer), false, "a body-level offer on a timer is not the press's");
    assert.deepEqual(pressWaysOut(undefined, "any").map((layer) => layer.controlName), ["No thanks"]);
  }, page.view);
  assert.deepEqual(page.flyoutClose.events, []);
});

test("the record leaves with the layer: the flyout closed and opened again by the page is the page's", () => {
  const page = travelPage();
  withPage(page.body, () => {
    pressChip(page);
    toggleHidden(page.flyout);
    assert.equal(runOpenedLayers.has(page.header), false, "a closed flyout is no layer of the run's");
    toggleHidden(page.flyout);
    assert.equal(runOpenedLayers.has(page.header), false, "the record was dropped when it left, and is not revived");
    assert.deepEqual(pressWaysOut(undefined, "any").map((layer) => layer.controlName), ["Close"]);
  }, page.view);
});

test("a layer over the page before the press, offering the same way out, is not the press's", () => {
  const page = travelPage();
  withPage(page.body, () => {
    toggleHidden(page.flyout);
    const before = runOpenedLayers.snapshot();
    // A press inside the open flyout: choosing a currency leaves it open.
    runOpenedLayers.note(page.chip, before);
    assert.equal(runOpenedLayers.has(page.header), false);
  }, page.view);
});

/**
 * A results page whose "Filters" button names its drawer by `aria-controls`:
 * the drawer is a painted modal appended to the body, apart from the button.
 */
function filtersPage() {
  const closeFilters = h("button", { type: "button", "aria-label": "Close" }, "×");
  const drawer = place(h("div", { id: "stay-filters", role: "dialog", "aria-modal": "true", "aria-label": "Filters", hidden: "" }, [
    closeFilters,
    h("h2", {}, "Filter stays"),
    h("label", {}, "Free cancellation")
  ]), { position: "fixed", box: { x: 880, y: 0, width: 400, height: 720 } });
  const filters = h("button", { type: "button", "aria-controls": "stay-filters" }, "Filters");
  onPress(filters, () => toggleHidden(drawer));
  const results = h("main", {}, [h("div", {}, [filters]), h("ul", {}, [h("li", {}, "Casa do Rio")])]);
  const body = h("body", {}, [results, drawer]);
  return { body, drawer, filters, closeFilters, view: zonedView([drawer], results) };
}

test("a drawer the pressed button names by aria-controls is the run's, wall or not, and is never cleared for a missing target", () => {
  const page = filtersPage();
  withPage(page.body, () => {
    const before = runOpenedLayers.snapshot();
    page.filters.dispatchEvent(new Event("click"));
    runOpenedLayers.note(page.filters, before);
    assert.equal(runOpenedLayers.has(page.drawer), true);
    assert.equal(clearableLayerOverPage(MISSING_TARGET), false, "the only wall is the run's own drawer");
    assert.deepEqual(pressWaysOut(MISSING_TARGET, "walls"), []);
  }, page.view);
  assert.deepEqual(page.closeFilters.events, []);
});

/**
 * A destinations menu: the button and the menu sit side by side in a fixed
 * navigation bar, so the menu neither holds the button nor is named by it.
 * The button says `aria-expanded="true"` once pressed when `expands`, and an
 * adviser card on the body opens in the same moment when `cardToo`.
 */
function destinationsPage(options: { expands: boolean; cardToo: boolean }) {
  const closeMenu = h("button", { type: "button", "aria-label": "Close" }, "×");
  const menu = place(h("div", { role: "dialog", "aria-label": "Destinations", hidden: "" }, [closeMenu, h("a", { href: "/lisbon" }, "Lisbon")]), { box: { x: 0, y: 64, width: 600, height: 300 } });
  const button = h("button", { type: "button", "aria-expanded": "false" }, "Destinations");
  const nav = place(h("nav", {}, [h("div", {}, [button]), menu]), { position: "fixed", box: { x: 0, y: 0, width: 1280, height: 64 } });
  const closeCard = h("button", { type: "button", "aria-label": "Close" }, "×");
  const card = place(h("div", { role: "dialog", "aria-label": "Need help planning?", hidden: "" }, [closeCard, h("p", {}, "Chat with a travel adviser")]), { position: "fixed", box: { x: 1000, y: 560, width: 260, height: 140 } });
  closesOnPress(closeCard, card);
  onPress(button, () => {
    toggleHidden(menu);
    if (options.expands) button.setAttribute("aria-expanded", "true");
    if (options.cardToo) toggleHidden(card);
  });
  const results = h("main", {}, [h("h1", {}, "Where next?")]);
  const body = h("body", {}, [nav, results, card]);
  return { body, menu, button, closeMenu, card, closeCard, view: zonedView([card, menu, nav], results) };
}

/** Presses the destinations button as a step does. */
function pressDestinations(page: ReturnType<typeof destinationsPage>): void {
  const before = runOpenedLayers.snapshot();
  page.button.dispatchEvent(new Event("click"));
  runOpenedLayers.note(page.button, before);
}

test("an expanded button's menu, beside it in the same bar, is the run's; a card the page opens meanwhile is not", () => {
  const page = destinationsPage({ expands: true, cardToo: true });
  withPage(page.body, () => {
    pressDestinations(page);
    assert.equal(runOpenedLayers.has(page.menu), true, "the menu shares the bar with the expanded button");
    assert.equal(runOpenedLayers.has(page.card), false, "the card shares only the body with it");
    assert.deepEqual(pressWaysOut(undefined, "any").map((layer) => layer.name), ["Need help planning?"]);
  }, page.view);
  assert.deepEqual(page.closeMenu.events, []);
  assert.equal(page.closeCard.pressed, true);
});

test("a button that does not say it expanded anything ties nothing beside it", () => {
  const page = destinationsPage({ expands: false, cardToo: false });
  withPage(page.body, () => {
    pressDestinations(page);
    assert.equal(runOpenedLayers.has(page.menu), false);
  }, page.view);
});
