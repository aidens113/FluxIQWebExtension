// A loop over a gallery whose tiles are themselves the links a pass opens
// (photo newest-likes r1, `run-mvecxeci-1c2cc227`, Cause 3).
//
// Each tile is an `<a href>` holding a picture and its counts, laid side by
// side in one grid `<div>`: no `li`, no `article`, no key, and each tile's name
// is its own counts, so no two tiles are alike by name. The saved open press
// carried only `{ landmark: "main" }` beside a positional selector, so the
// pass's row never placed it: the rows-aside resolution answered tile 1, the
// page said tile 1 sat in no repeated row, and all 24 passes opened tile 1.
//
// A control that is itself one of a run of same-shaped siblings, each carrying
// content of its own and differing from the others, is its own row: the pass
// resolves the tile that holds the pass's values. A run of plain controls -- a
// dialog's icon buttons, a menu of one-word links -- stays page-level, so the
// press a pass makes in the opened item's dialog is acted on as recorded.
//
// The gallery here is a made-up recipe site, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { accessibleNameFor } from "../../identity";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget } from "../resolve-target";

type Dish = { slug: string; alt: string; saves: string; notes: string };

const DISHES: readonly Dish[] = [
  { slug: "lemon-tart", alt: "Lemon tart, plated on 3 May", saves: "1.2K", notes: "14" },
  { slug: "pea-soup", alt: "Pea soup, plated on 1 May", saves: "880", notes: "9" },
  { slug: "fig-bread", alt: "Fig bread, plated on 28 April", saves: "2.4K", notes: "31" },
  { slug: "rice-salad", alt: "Rice salad, plated on 20 April", saves: "640", notes: "5" }
];

/** The recorded position: the first tile, the one the build looked at. */
const BUILD_TILE_SELECTOR = "main > div > a:nth-of-type(1)";

type Gallery = { tiles: Element[]; keep: Element; home: Element };

function tile(dish: Dish): StubElement {
  return el(
    "a",
    { class: "tile", href: `/r/${dish.slug}/`, role: "link" },
    el("img", { class: "thumb", alt: dish.alt, src: `/img/${dish.slug}.jpg` }),
    el("ul", { class: "stats" }, el("li", {}, el("span", {}, dish.saves)), el("li", {}, el("span", {}, dish.notes)))
  );
}

/** A menu of one-word links, the gallery of tiles, and the open dish's dialog with its row of icon buttons. */
function installGallery(t: TestContext, dishes: readonly Dish[] = DISHES): Gallery {
  const document = stubDocument();
  const tiles = dishes.map(tile);
  const home = el("a", { class: "menu", href: "/" }, "Home");
  const menu = el("nav", {}, home, el("a", { class: "menu", href: "/explore" }, "Explore"), el("a", { class: "menu", href: "/saved" }, "Saved"));
  const icon = (label: string): StubElement => el("div", { class: "icon", role: "button", "aria-label": label });
  const keep = icon("Keep");
  const dialog = el("div", { role: "dialog", "aria-label": "Recipe" }, el("section", { class: "bar" }, keep, icon("Share"), icon("Report")));
  const main = el("main", {}, el("div", { class: "grid" }, ...tiles));
  document.append(el("html", {}, el("body", {}, menu, main, dialog)));
  installStubDocument(t, document);
  return { tiles: tiles as unknown as Element[], keep: keep as unknown as Element, home: home as unknown as Element };
}

/** The pass's row as the domain writes it: what the gallery read out of the tile. */
const rowOf = (dish: Dish): { values: string[] } => ({ values: [dish.alt, dish.saves, dish.notes] });

/** The open press as a pass dispatches it: the first tile's saved identity, named as a recording names it, and the pass's row. */
function openOnRow(dish: Dish): BrowserActionCommand {
  const first = DISHES[0] as Dish;
  const name = accessibleNameFor(tile(first) as unknown as Element);
  return {
    commandId: "cmd-open",
    actionType: "web.dom.click",
    selector: BUILD_TILE_SELECTOR,
    element: {
      tagName: "a", role: "link", accessibleName: name, classNames: ["tile"],
      attributes: { href: `/r/${first.slug}/`, role: "link" }, selector: BUILD_TILE_SELECTOR,
      context: { landmark: "main", record: rowOf(dish) }
    }
  } as unknown as BrowserActionCommand;
}

const dish = (index: number): Dish => DISHES[index] as Dish;

test("each pass opens its own tile, not the tile the build looked at", (t) => {
  const gallery = installGallery(t);
  for (const index of [0, 1, 2, 3]) {
    assert.equal(resolveTarget(openOnRow(dish(index))).element, gallery.tiles[index], `pass for ${dish(index).slug}`);
  }
});

test("a pass whose tile is not on the page fails as not found, and never opens another tile", (t) => {
  // The gallery drew only its first two tiles; the pass is on the third.
  installGallery(t, DISHES.slice(0, 2));
  assert.throws(() => resolveTarget(openOnRow(dish(2))), (error: unknown) => {
    assert.equal((error as { failure?: { code?: string } }).failure?.code, "web.target.not_found");
    return true;
  });
});

test("an icon button in a run of icon buttons is the same control on every pass", (t) => {
  const gallery = installGallery(t);
  const selector = '[role="dialog"] > section > div:nth-of-type(1)';
  const command = {
    commandId: "cmd-keep",
    actionType: "web.dom.click",
    selector,
    element: {
      tagName: "div", role: "button", accessibleName: "Keep", classNames: ["icon"],
      attributes: { "aria-label": "Keep", role: "button" }, selector,
      context: { landmark: "dialog", record: rowOf(dish(2)) }
    }
  } as unknown as BrowserActionCommand;
  assert.equal(resolveTarget(command).element, gallery.keep);
});

test("a one-word link in a menu of them is the same control on every pass", (t) => {
  const gallery = installGallery(t);
  const selector = "nav > a:nth-of-type(1)";
  const command = {
    commandId: "cmd-home",
    actionType: "web.dom.click",
    selector,
    element: {
      tagName: "a", role: "link", accessibleName: "Home", classNames: ["menu"],
      attributes: { href: "/" }, selector,
      context: { landmark: "navigation", record: rowOf(dish(1)) }
    }
  } as unknown as BrowserActionCommand;
  assert.equal(resolveTarget(command).element, gallery.home);
});
