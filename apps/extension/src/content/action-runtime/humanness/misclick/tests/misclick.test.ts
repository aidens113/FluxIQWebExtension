// One misclick before a press (W2 H4, `../before.ts`). The safety
// lines, one test each: no mark, no misclick; level 0, no misclick; any open
// dialog, popover, menu, listbox or covering layer, no misclick; never on a
// backdrop; never where the hit or an ancestor is interactive; none when no
// inert point is found; none on a robot-check page. And the positive case: one
// misclick, on an inert point outside the target, reproduced by the command id.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { commandHumanness } from "../../command-humanness";
import { inertHitAt } from "../inert-point";
import { misclickBefore } from "../before";
import { misclickChance } from "../chance";
import { misclickRandom } from "../random";
import { FakePage, installPageGlobals, type FakeElement, type FakeElementInit } from "./fake-page";

/** The target button's box; misclicks land within 24 px of it. */
const TARGET_BOX = { left: 400, top: 300, right: 520, bottom: 340 };
const GESTURE = ["mouseover", "mouseenter", "mousemove", "mousedown", "mouseup", "click"];

/** A command id whose seeded draw does (or does not) fall under the chance at this level. */
function commandIdThat(misclicks: boolean, level = 100): string {
  const chance = misclickChance(level / 100);
  for (let index = 0; index < 10_000; index += 1) {
    const id = `cmd-${index}`;
    if ((misclickRandom(id)() < chance) === misclicks) return id;
  }
  throw new Error("no command id found");
}
const MISCLICKS = commandIdThat(true);
const STAYS = commandIdThat(false);

/** A page with a plain content block around the target button; `around` marks the block, `wrap` puts a control around it. */
function page(t: TestContext, around: FakeElementInit = {}, wrap?: { tag: string; init?: FakeElementInit }) {
  installPageGlobals((fn) => t.after(fn));
  const fake = new FakePage();
  const holder = wrap ? fake.add(wrap.tag, "wrapper", { box: { left: 0, top: 0, right: 1000, bottom: 800 }, ...wrap.init }) : fake.body;
  const main = fake.add("div", "main", { box: { left: 50, top: 50, right: 950, bottom: 750 }, ...around }, holder);
  const target = fake.add("button", "target", { box: { ...TARGET_BOX } }, main);
  return { fake, main, target: target as unknown as Element, targetFake: target };
}

const marked = (commandId: string, humanness: number | undefined = 100) => ({ commandId, humannessMisclick: true as const, ...(humanness === undefined ? {} : { humanness }) });

test("the chance grows with the level, 8% at 100 and none at 0", () => {
  assert.equal(misclickChance(0), 0);
  assert.equal(misclickChance(0.5), 0.04);
  assert.equal(misclickChance(1), 0.08);
  let misclicked = 0;
  for (let index = 0; index < 4000; index += 1) if (misclickRandom(`draw-${index}`)() < misclickChance(1)) misclicked += 1;
  assert.ok(misclicked > 200 && misclicked < 450, `${misclicked} of 4000 drew a misclick at 100`);
});

test("a marked command at a level above 0 misclicks once, on an inert point outside the target, and nothing else", async (t) => {
  const { fake, target } = page(t);
  assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "made");
  assert.deepEqual(fake.events.map((event) => event.type), GESTURE);
  assert.ok(fake.events.every((event) => event.on === "main"), "only the content beside the target was clicked");
  const { x, y } = fake.events[0]!;
  assert.ok(fake.events.every((event) => event.x === x && event.y === y), "the whole gesture at one point");
  const outside = x < TARGET_BOX.left - 2 || x > TARGET_BOX.right + 2 || y < TARGET_BOX.top - 2 || y > TARGET_BOX.bottom + 2;
  assert.ok(outside, `${x},${y} is on the target`);
  assert.ok(Math.max(TARGET_BOX.left - x, x - TARGET_BOX.right, TARGET_BOX.top - y, y - TARGET_BOX.bottom) <= 24, `${x},${y} is not beside the target`);

  const again = page(t);
  await misclickBefore(again.target, marked(MISCLICKS), 0);
  assert.deepEqual(again.fake.events, fake.events, "the same command id misclicks at the same point");
});

test("the pause after a misclick is fitted within the command's time and taken", async (t) => {
  const { target } = page(t);
  const started = Date.now();
  assert.equal(await misclickBefore(target, marked(MISCLICKS), started), "made");
  assert.ok(Date.now() - started >= 140, "no pause after the misclick");
});

test("without the mark there is no misclick, and the page is not read", async (t) => {
  const { fake, target } = page(t);
  fake.sealed = true;
  assert.equal(await misclickBefore(target, { commandId: MISCLICKS, humanness: 100 }, 0), "none");
  assert.deepEqual(fake.events, []);
});

test("at level 0, or with no level, there is no misclick, and the page is not read", async (t) => {
  const { fake, target } = page(t);
  fake.sealed = true;
  assert.equal(commandHumanness({ commandId: MISCLICKS, humanness: 0 }), undefined);
  assert.equal(await misclickBefore(target, marked(MISCLICKS, 0), 0), "none");
  assert.equal(await misclickBefore(target, marked(MISCLICKS, undefined), 0), "none");
  assert.deepEqual(fake.events, []);
});

test("a command whose draw falls outside the chance makes none, and the page is not read", async (t) => {
  const { fake, target } = page(t);
  fake.sealed = true;
  assert.equal(await misclickBefore(target, marked(STAYS), 0), "none");
  assert.deepEqual(fake.events, []);
});

test("no misclick while a dialog, popover, menu, listbox or layer is open", async (t) => {
  const open: Array<[string, string, FakeElementInit]> = [
    ["a native dialog", "dialog", { attributes: { open: "" } }],
    ["an open popover", "div", { attributes: { popover: "auto" }, popoverOpen: true }],
    ["a menu", "ul", { attributes: { role: "menu" } }],
    ["a listbox", "div", { attributes: { role: "listbox" } }],
    ["an ARIA dialog", "div", { attributes: { role: "dialog" } }],
    ["an alert dialog", "div", { attributes: { role: "alertdialog" } }],
    ["a modal", "div", { attributes: { "aria-modal": "true" } }]
  ];
  for (const [what, tag, init] of open) {
    const { fake, target } = page(t);
    fake.add(tag, "layer", { box: { left: 700, top: 600, right: 800, bottom: 700 }, ...init });
    assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "none", what);
    assert.deepEqual(fake.events, [], what);
  }
  const { fake, target } = page(t);
  fake.add("div", "scrim", { box: { left: 0, top: 0, right: 1000, bottom: 800 }, style: { position: "fixed" } });
  fake.add("div", "sheet", { box: { left: 300, top: 200, right: 700, bottom: 600 } }, fake.body);
  assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "none", "a fixed layer over the page");
  assert.deepEqual(fake.events, []);
});

test("a menu or listbox that is not painted is not open", async (t) => {
  const { fake, target } = page(t);
  fake.add("ul", "closed-menu", { attributes: { role: "menu" } });
  fake.add("div", "hidden-list", { attributes: { role: "listbox" }, box: { left: 0, top: 0, right: 10, bottom: 10 }, style: { visibility: "hidden" } });
  assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "made");
});

test("never on a backdrop: a point over a dialog's backdrop or a fixed scrim is not inert", (t) => {
  for (const [what, tag, init] of [
    ["a dialog's backdrop, which the hit test answers as the dialog", "dialog", {}],
    ["a fixed scrim", "div", { style: { position: "fixed" } }],
    ["a sticky band", "div", { style: { position: "sticky" } }],
    ["a popover", "div", { attributes: { popover: "manual" } }]
  ] as Array<[string, string, FakeElementInit]>) {
    const { fake, target } = page(t);
    fake.add(tag, "backdrop", { box: { left: 380, top: 280, right: 400, bottom: 300 }, ...init });
    assert.equal(inertHitAt({ x: 390, y: 290 }, target, fake.document as unknown as Document), undefined, what);
  }
});

test("never where the hit or any ancestor is interactive", async (t) => {
  const around: Array<[string, FakeElementInit, { tag: string; init?: FakeElementInit } | undefined]> = [
    ["a link around the content", {}, { tag: "a", init: { attributes: { href: "/next" } } }],
    ["a button around the content", {}, { tag: "button" }],
    ["a label around the content", {}, { tag: "label" }],
    ["a cursor: pointer card", { style: { cursor: "pointer" } }, undefined],
    ["an onclick property", { onclick: () => undefined }, undefined],
    ["an inline handler", { attributes: { onmousedown: "go()" } }, undefined],
    ["a tabindex", { attributes: { tabindex: "0" } }, undefined],
    ["a control role", { attributes: { role: "button" } }, undefined],
    ["an editable region", { attributes: { contenteditable: "true" } }, undefined],
    ["a disclosure", { attributes: { "aria-expanded": "false" } }, undefined]
  ];
  for (const [what, init, wrap] of around) {
    const { fake, target } = page(t, init, wrap);
    assert.equal(inertHitAt({ x: 390, y: 320 }, target, fake.document as unknown as Document), undefined, what);
    assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "none", what);
    assert.deepEqual(fake.events, [], what);
  }
});

test("the target itself, and a point within its margin, are never inert", (t) => {
  const { fake, target } = page(t);
  const document = fake.document as unknown as Document;
  assert.equal(inertHitAt({ x: 460, y: 320 }, target, document), undefined);
  assert.equal(inertHitAt({ x: 399, y: 320 }, target, document), undefined);
  assert.equal((inertHitAt({ x: 390, y: 320 }, target, document) as unknown as FakeElement | undefined)?.name, "main");
});

test("no misclick when no inert point is found beside the target", async (t) => {
  const { fake, targetFake } = page(t);
  targetFake.box = { left: 0, top: 0, right: 1000, bottom: 800 };
  assert.equal(await misclickBefore(targetFake as unknown as Element, marked(MISCLICKS), 0), "none");
  assert.deepEqual(fake.events, []);
});

test("no misclick on a page showing a robot check", async (t) => {
  const { fake, target } = page(t, { text: "Please verify you are human before you continue." });
  assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "none");
  assert.deepEqual(fake.events, []);
});

test("a misclick the page answered after all is reported moved, so the press is measured again", async (t) => {
  const { fake, target, targetFake } = page(t);
  fake.onClick = () => {
    targetFake.box = { left: 400, top: 360, right: 520, bottom: 400 };
  };
  assert.equal(await misclickBefore(target, marked(MISCLICKS), 0), "moved");
  const opened = page(t);
  opened.fake.onClick = () => {
    opened.fake.add("div", "menu", { attributes: { role: "menu" }, box: { left: 600, top: 600, right: 700, bottom: 700 } });
  };
  assert.equal(await misclickBefore(opened.target, marked(MISCLICKS), 0), "moved");
});
