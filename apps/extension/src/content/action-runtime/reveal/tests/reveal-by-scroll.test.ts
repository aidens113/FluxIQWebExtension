// Where the runtime scrolls for a target the page has not shown, and where it
// will not (`../reveal-aim.ts`, `../reveal-by-scroll.ts`).
//
// Live (install-core): a "Show more people" button was `display: none` below a
// grid that loads a batch each time a sentinel at its end scrolls into view,
// and is unhidden once the grid has loaded its batches. Every press was refused
// hidden four attempts running, and nothing scrolled. These rows rebuild that
// shape generically: a section holding a grid and a hidden button under it.

import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserActionResult } from "../../../types";
import { revealAim } from "../reveal-aim";
import { revealByScroll } from "../reveal-by-scroll";
import { noteUnshownTarget, revealUnshownTarget } from "../unshown-target";
import { element, fakePage, type FakeNode, type FakePage } from "./fake-page";

/** A section from 600 to 2000 px down the page, with a grid in it and a hidden button below the grid. */
function sectionWithHiddenButton(): { page: FakePage; section: FakeNode; button: FakeNode } {
  const page = fakePage(800, 4000);
  const section = page.body.child({ tag: "section", top: 600, height: 1400 });
  section.child({ top: 640, height: 1340 });
  const button = section.child({ tag: "button", top: 1990, height: 40, attributes: { hidden: "" }, style: { display: "none" } });
  return { page, section, button };
}

test("a display:none target below a grid: the end of the section it would be drawn in is scrolled into view", () => {
  const { page, section, button } = sectionWithHiddenButton();
  const aim = revealAim(element(button));
  assert.equal(aim?.element, element(section), "the nearest ancestor that is displayed and has a box");
  assert.equal(aim?.block, "end");
  assert.equal(aim?.ownContent, false);
  assert.equal(revealByScroll(element(button)), true, "the page moved");
  assert.deepEqual(page.scrolls, [{ tag: "section", block: "end" }]);
  assert.equal(page.scrollY, 2000 - 800, "the section's end sits at the viewport's bottom, where a lazy list's sentinel is");
});

test("each attempt may scroll again: once the grid grew, the new end is scrolled to; an end already on screen is left alone", () => {
  const { page, section, button } = sectionWithHiddenButton();
  assert.equal(revealByScroll(element(button)), true);
  assert.equal(revealByScroll(element(button)), false, "the end is on screen: nothing to scroll, nothing woken");
  assert.equal(page.scrolls.length, 1, "no scroll was made for an end already in view");
  section.height += 800;
  assert.equal(revealByScroll(element(button)), true, "the grid grew, so its end moved below the viewport again");
  assert.equal(page.scrollY, 600 + 2200 - 800);
});

test("a rendered target with a zero-size box is aimed at its ancestor's end, as one with no box", () => {
  const page = fakePage();
  const list = page.body.child({ top: 1000, height: 900 });
  const empty = list.child({ tag: "button", top: 1900, height: 0 });
  assert.equal(revealByScroll(element(empty)), true);
  assert.deepEqual(page.scrolls, [{ tag: "div", block: "end" }]);
});

test("a hidden target inside a list that scrolls its own content: the content is scrolled to its end too", () => {
  const page = fakePage();
  const pane = page.body.child({ top: 100, height: 400, scrollHeight: 2400, style: { overflowY: "auto" } });
  const more = pane.child({ tag: "button", top: 2500, height: 30, style: { display: "none" } });
  assert.equal(revealAim(element(more))?.ownContent, true);
  assert.equal(revealByScroll(element(more)), true);
  assert.equal(pane.scrollTop, 2400, "the pane's own content went to its end, where a scrolling list loads more");
  assert.equal(revealByScroll(element(more)), false, "content at its end and the pane on screen: nothing more to scroll");
});

test("an opacity:0 or visibility:hidden target below the viewport is scrolled to itself; one on screen is not", () => {
  for (const style of [{ opacity: "0" }, { visibility: "hidden" }]) {
    const page = fakePage();
    const fading = page.body.child({ tag: "a", top: 2400, height: 40, style });
    assert.equal(revealByScroll(element(fading)), true, `${JSON.stringify(style)} below the fold is scrolled to`);
    assert.deepEqual(page.scrolls, [{ tag: "a", block: "center" }]);
    assert.equal(revealByScroll(element(fading)), false, "now on screen: a scroll listener has already seen it");
  }
});

test("scrolling never chases a target a layer holds, an inert one, or one no longer in the document", () => {
  const page = fakePage();
  const fixedLayer = page.body.child({ top: 0, height: 0, style: { display: "none", position: "fixed" } });
  const inLayer = fixedLayer.child({ tag: "button", top: 0, height: 30 });
  const dialog = page.body.child({ tag: "dialog", top: 3000, height: 0, style: { display: "none" } });
  const inDialog = dialog.child({ tag: "button", top: 3000, height: 30 });
  const menu = page.body.child({ top: 3000, height: 0, attributes: { role: "menu" }, style: { display: "none" } });
  const inMenu = menu.child({ tag: "a", top: 3000, height: 30 });
  const details = page.body.child({ tag: "details", top: 3000, height: 20 });
  const inDetails = details.child({ tag: "a", top: 3010, height: 0, style: { display: "none" } });
  const inert = page.body.child({ tag: "button", top: 3000, height: 30, attributes: { inert: "" }, style: { display: "none" } });
  const gone = page.body.child({ tag: "button", top: 3000, height: 30, style: { display: "none" } });
  gone.connected = false;
  for (const [name, target] of [["fixed layer", inLayer], ["closed dialog", inDialog], ["menu", inMenu], ["closed details", inDetails], ["inert", inert], ["detached", gone]] as const) {
    assert.equal(revealAim(element(target)), undefined, name);
    assert.equal(revealByScroll(element(target)), false, name);
  }
  assert.deepEqual(page.scrolls, [], "nothing was scrolled");
});

test("a result with a noted unshown target is scrolled for; one with none is not", () => {
  const { page, button } = sectionWithHiddenButton();
  const noted = { commandId: "c1" } as BrowserActionResult;
  const other = { commandId: "c2" } as BrowserActionResult;
  noteUnshownTarget(noted, element(button));
  assert.equal(revealUnshownTarget(other), false);
  assert.equal(page.scrolls.length, 0);
  assert.equal(revealUnshownTarget(noted), true);
  assert.equal(page.scrolls.length, 1);
});
