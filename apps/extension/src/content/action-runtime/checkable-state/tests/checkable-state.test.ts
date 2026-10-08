import assert from "node:assert/strict";
import test from "node:test";
import { setCheckedState } from "../checkable-state";

function input(type: "checkbox" | "radio" = "checkbox") {
  const state = {
    tagName: "INPUT", type, checked: false, isConnected: true, clicks: 0,
    matches: () => false, getAttribute: () => null, focus: () => {},
    click: () => { state.clicks++; state.checked = type === "radio" ? true : !state.checked; }
  };
  return state;
}

test("check activates once and an already-held desired state activates nothing", async () => {
  const control = input();
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: true, changed: true });
  assert.equal(control.clicks, 1);
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: true, changed: false });
  assert.equal(control.clicks, 1);
});

test("microtask revert is read back without a second activation", async () => {
  const control = input();
  control.click = () => { control.clicks++; control.checked = true; queueMicrotask(() => { control.checked = false; }); };
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: false, changed: true });
  assert.equal(control.clicks, 1);
});

test("detached control cannot certify the replacement's checked state", async () => {
  const control = input();
  control.click = () => { control.clicks++; control.checked = true; control.isConnected = false; };
  const outcome = await setCheckedState(control as unknown as Element, true);
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? "" : outcome.reason, /detached/u);
  assert.equal(control.clicks, 1);
});

test("unchecking radio and disabled checking activate nothing", async () => {
  const radio = input("radio");
  assert.equal((await setCheckedState(radio as unknown as Element, false)).ok, false);
  assert.equal(radio.clicks, 0);
  const disabled = input();
  disabled.matches = () => true;
  assert.equal((await setCheckedState(disabled as unknown as Element, true)).ok, false);
  assert.equal(disabled.clicks, 0);
});

// A control the page draws itself (t364), from lane A round 5: the crossborder
// item page's colour swatches are `<div>`s, Space Grey arrives chosen, and the
// only sign of it is a class the other swatches lack. The page's own handler
// toggles: a press on the chosen swatch un-chooses it.

/** One swatch of a hand-built picker: classes, siblings, and the events a press dispatched on it. */
type Swatch = {
  tagName: string; classList: string[] & { contains(name: string): boolean }; parentElement: { children: Swatch[] };
  isConnected: boolean; events: string[]; attributes: Record<string, string>;
  matches(selector: string): boolean; getAttribute(name: string): string | null; closest(selector: string): null;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  ownerDocument: { defaultView: undefined }; dispatchEvent(event: Event): boolean;
};

/** A picker of `count` swatches, `chosen` (if any) drawn apart with `on`; a click toggles the way the crossborder page does. */
function picker(count: number, chosen: number | undefined): Swatch[] {
  const parent = { children: [] as Swatch[] };
  const classes = (names: string[]) => Object.assign(names, { contains: (name: string) => names.includes(name) });
  for (let index = 0; index < count; index++) {
    const swatch: Swatch = {
      tagName: "DIV", classList: classes(index === chosen ? ["swatch", "on"] : ["swatch"]), parentElement: parent,
      isConnected: true, events: [], attributes: {},
      matches: () => false, getAttribute: (name) => swatch.attributes[name] ?? null, closest: () => null,
      getBoundingClientRect: () => ({ left: index * 60, top: 0, width: 52, height: 52 }),
      ownerDocument: { defaultView: undefined },
      dispatchEvent: (event) => {
        swatch.events.push(event.type);
        if (event.type !== "click") return true;
        const wasOn = swatch.classList.contains("on");
        for (const member of parent.children) member.classList.splice(0, member.classList.length, "swatch");
        if (!wasOn) swatch.classList.push("on");
        return true;
      }
    };
    parent.children.push(swatch);
  }
  return parent.children;
}

/** Runs `body` with the event constructors a press uses, which Node does not have. */
async function withMouseEvents<T>(body: () => Promise<T>): Promise<T> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const had = "MouseEvent" in globals;
  if (!had) globals.MouseEvent = class extends Event {};
  try {
    return await body();
  } finally {
    if (!had) delete globals.MouseEvent;
  }
}

const clicks = (swatch: Swatch): number => swatch.events.filter((type) => type === "click").length;

test("a preselected div swatch drawn apart is already chosen: success, nothing pressed", async () => {
  const [spaceGrey, silver] = picker(3, 0);
  const outcome = await withMouseEvents(() => setCheckedState(spaceGrey as unknown as Element, true));
  assert.deepEqual(outcome, { ok: true, kind: "option", checked: true, changed: false, shownBy: "drawn apart from the like options beside it" });
  assert.deepEqual(spaceGrey!.events, [], "a press would have un-chosen it");
  assert.equal(silver!.classList.contains("on"), false);
});

test("an unchosen div swatch is pressed once, with a full gesture, and read back chosen", async () => {
  const [spaceGrey, silver] = picker(3, 0);
  const outcome = await withMouseEvents(() => setCheckedState(silver as unknown as Element, true, { x: 86, y: 26 }));
  assert.deepEqual(outcome, { ok: true, kind: "option", checked: true, changed: true, shownBy: "drawn apart from the like options beside it" });
  assert.equal(clicks(silver!), 1);
  assert.ok(silver!.events.includes("mousedown"), "pressed with the click gesture, not a bare click()");
  assert.equal(spaceGrey!.classList.contains("on"), false);
  const again = await withMouseEvents(() => setCheckedState(silver as unknown as Element, true));
  assert.equal(again.ok && again.changed, false, "replaying the request presses nothing");
  assert.equal(clicks(silver!), 1);
});

test("a picker with nothing chosen reads the swatch as not chosen, and a press that takes nothing reads back not chosen", async () => {
  const [first] = picker(2, undefined);
  first!.dispatchEvent = (event) => { first!.events.push(event.type); return true; };
  const outcome = await withMouseEvents(() => setCheckedState(first as unknown as Element, true));
  assert.deepEqual(outcome, { ok: true, kind: "option", checked: false, changed: true, shownBy: "drawn apart from the like options beside it" });
  assert.equal(clicks(first!), 1, "one press only, never a second toggle");
});

test("clearing a drawn-apart swatch presses it once and reads it back; an unchosen one is left alone", async () => {
  const [spaceGrey, silver] = picker(3, 0);
  const cleared = await withMouseEvents(() => setCheckedState(spaceGrey as unknown as Element, false));
  assert.deepEqual(cleared, { ok: true, kind: "option", checked: false, changed: true, shownBy: "drawn apart from the like options beside it" });
  const untouched = await withMouseEvents(() => setCheckedState(silver as unknown as Element, false));
  assert.equal(untouched.ok && untouched.changed, false);
  assert.deepEqual(silver!.events, []);
});

test("aria states are read before drawing: pressed toggles, selected cannot be cleared", async () => {
  const [toggle] = picker(1, undefined);
  toggle!.attributes["aria-pressed"] = "true";
  assert.deepEqual(await withMouseEvents(() => setCheckedState(toggle as unknown as Element, true)), { ok: true, kind: "option", checked: true, changed: false, shownBy: "aria-pressed" });
  const [tab] = picker(1, undefined);
  tab!.attributes["aria-selected"] = "true";
  const refused = await withMouseEvents(() => setCheckedState(tab as unknown as Element, false));
  assert.equal(refused.ok, false);
  assert.match(refused.ok ? "" : refused.reason, /cannot be cleared/u);
  assert.deepEqual(tab!.events, []);
});

test("a control that shows no chosen state is refused with a sentence saying so, and nothing is pressed", async () => {
  const [lone] = picker(1, undefined);
  const outcome = await withMouseEvents(() => setCheckedState(lone as unknown as Element, true));
  assert.deepEqual(outcome, {
    ok: false,
    code: "not-checkable",
    reason: "<div> shows no chosen state to read: it is not a checkbox or a radio, it has no aria-checked, aria-pressed or aria-selected, and it is not one of a row of like options drawn apart when chosen"
  });
  assert.deepEqual(lone!.events, []);
});

test("a sold-out swatch is refused as disabled before its drawing is read", async () => {
  const [, soldOut] = picker(3, 0);
  soldOut!.attributes["aria-disabled"] = "true";
  const outcome = await withMouseEvents(() => setCheckedState(soldOut as unknown as Element, true));
  assert.equal(outcome.ok ? undefined : outcome.code, "disabled");
  assert.deepEqual(soldOut!.events, []);
});

test("a text field is still refused as not a checkbox or a radio, and is never pressed", async () => {
  const field = { ...input(), type: "text" };
  const outcome = await setCheckedState(field as unknown as Element, true);
  assert.deepEqual(outcome, { ok: false, reason: "<input[type=text]> is not a checkbox or a radio", code: "not-checkable" });
  assert.equal(field.clicks, 0);
});
