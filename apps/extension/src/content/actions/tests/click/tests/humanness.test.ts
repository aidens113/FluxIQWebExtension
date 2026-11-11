// The click verb above humanness 0 (W2 H3, `click.ts` header): the press is
// aimed near the target's centre where the gate accepts the point, and at the
// gate's own point otherwise. At 0, or with no level, nothing is drawn and the
// press is today's exactly: the same events at the same point. The faked page
// and watches are `click/`'s; the target here also has a box and a hit test.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActionabilityReport, PressSignal } from "../../../../action-runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../types";
import { clickAction } from "../../../click";
import { CLICK, dependencies, fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakePage, fakeWatch, FIRST_PRESS, installMouseEvent, SECOND_PRESS } from "..";

/** The button's box: 120 by 40 at 100,200, so its centre is 160,220. */
const BOX = { left: 100, top: 200, right: 220, bottom: 240 };
const CENTRE = { x: 160, y: 220 };
/** The gate's answer for the button: accepted at its centre. */
const AT_CENTRE: ActionabilityReport = { actionable: true, point: CENTRE, detail: "the point 160,220 landed on the target" };

type Pressed = { type: string; x: number; y: number };
type Options = { level?: number; commandId?: string; badge?: boolean; seen?: PressSignal[]; settled?: boolean | "announced"; geometry?: boolean };

/**
 * One click on a button with a box and a hit test. `badge` paints a promotion
 * over the button's right end, from x 170; `geometry: false` makes every read
 * of the box or the hit test throw, to prove nothing is drawn.
 */
async function pressButton(t: TestContext, options: Options = {}) {
  installMouseEvent(t);
  const page = fakePage({ link: false, prevent: false });
  const pressed: Pressed[] = [];
  const badge = { nodeType: 1, shadowRoot: null, parentNode: null, parentElement: null };
  const element = page.element as unknown as Record<string, unknown> & { ownerDocument: Record<string, unknown>; dispatchEvent: (event: { type: string }) => boolean };
  const geometry = options.geometry ?? true;
  const refuse = () => {
    throw new Error("the press read the page's geometry at humanness 0");
  };
  Object.assign(element, {
    nodeType: 1,
    shadowRoot: null,
    parentNode: null,
    parentElement: null,
    matches: (selector: string) => selector.includes("button,"),
    getBoundingClientRect: geometry
      ? () => ({ left: BOX.left, top: BOX.top, right: BOX.right, bottom: BOX.bottom, width: BOX.right - BOX.left, height: BOX.bottom - BOX.top })
      : refuse
  });
  element.ownerDocument.defaultView = { innerWidth: 1000, innerHeight: 800 };
  element.ownerDocument.elementFromPoint = geometry
    ? (x: number, y: number) => (options.badge && x >= 170 ? badge : x > BOX.left && x < BOX.right && y > BOX.top && y < BOX.bottom ? element : null)
    : refuse;
  const dispatch = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event) => {
    const init = (event as { init?: { clientX?: number; clientY?: number } }).init;
    pressed.push({ type: event.type, x: init?.clientX ?? Number.NaN, y: init?.clientY ?? Number.NaN });
    return dispatch(event);
  };
  const deps = dependencies(
    page.element,
    fakeWatch(undefined, page.events).make,
    fakeNoticeWatch(undefined, page.events),
    fakeCheckWatch(undefined, page.events),
    fakeIgnoredWatch(options.seen ?? ["change"], page.events, undefined, options.settled),
    true,
    "covered",
    () => AT_CENTRE
  );
  const action: BrowserActionCommand = {
    ...CLICK,
    commandId: options.commandId ?? CLICK.commandId,
    ...(options.level === undefined ? {} : { humanness: options.level })
  };
  const result = await clickAction(action, deps, 1_000);
  return { result, events: page.events, pressed };
}

/** What a passed validation says it saw. */
function actualOf(result: BrowserActionResult): string {
  const validation = result.validation;
  return validation?.status === "passed" ? validation.actual : "";
}

/** The one point every event of each press was dispatched at. */
function pressPoints(pressed: Pressed[]): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const event of pressed) {
    if (event.type === "mouseover") points.push({ x: event.x, y: event.y });
    const current = points.at(-1);
    assert.ok(current, `${event.type} came before the press's hover`);
    assert.deepEqual({ x: event.x, y: event.y }, current, `${event.type} was dispatched at another point than its press`);
  }
  return points;
}

test("at level 0, or with no level, the press is today's: the same events at the gate's point, and no geometry read", async (t) => {
  const absent = await pressButton(t, { geometry: false });
  const zero = await pressButton(t, { level: 0, geometry: false });
  assert.equal(absent.result.status, "succeeded");
  assert.equal(zero.result.status, "succeeded");
  assert.deepEqual(absent.events, FIRST_PRESS);
  assert.deepEqual(zero.events, absent.events);
  assert.deepEqual(zero.pressed, absent.pressed);
  assert.deepEqual(pressPoints(zero.pressed), [CENTRE]);
  assert.equal(actualOf(zero.result), "the point 160,220 landed on the target");
});

test("at level 0 a press made once more is at the gate's first point, as before", async (t) => {
  const { events, pressed } = await pressButton(t, { level: 0, seen: [], geometry: false });
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(pressPoints(pressed), [CENTRE, CENTRE]);
});

test("at level 80 the press is aimed near the centre: every event at one point inside the box that hits the button", async (t) => {
  let moved = 0;
  for (let index = 0; index < 40; index += 1) {
    const { result, events, pressed } = await pressButton(t, { level: 80, commandId: `cmd-${index}` });
    assert.equal(result.status, "succeeded");
    assert.deepEqual(events, FIRST_PRESS, "the same events in the same order");
    const [point] = pressPoints(pressed);
    assert.ok(point && point.x > BOX.left && point.x < BOX.right && point.y > BOX.top && point.y < BOX.bottom, `${point?.x},${point?.y} lies outside the box`);
    assert.equal(actualOf(result), `the point ${Math.round(point.x)},${Math.round(point.y)} landed on the target`, "the result names the point pressed");
    if (point.x !== CENTRE.x || point.y !== CENTRE.y) moved += 1;
  }
  assert.ok(moved > 30, `only ${moved} of 40 presses moved off the centre`);
});

test("the same command id presses at the same point", async (t) => {
  const first = await pressButton(t, { level: 80, commandId: "cmd-replayed" });
  const again = await pressButton(t, { level: 80, commandId: "cmd-replayed" });
  assert.deepEqual(pressPoints(again.pressed), pressPoints(first.pressed));
  assert.notDeepEqual(pressPoints(first.pressed), [CENTRE]);
});

test("a drawn point a badge covers is never pressed: the press falls back to the centre", async (t) => {
  let fellBack = 0;
  for (let index = 0; index < 40; index += 1) {
    const { pressed } = await pressButton(t, { level: 100, commandId: `cmd-${index}`, badge: true });
    const [point] = pressPoints(pressed);
    assert.ok(point);
    assert.ok(point.x < 170, `${point.x},${point.y} is under the badge`);
    if (point.x === CENTRE.x && point.y === CENTRE.y) fellBack += 1;
  }
  assert.ok(fellBack > 0, "no draw reached the badge, so the fallback went untested");
});

test("at level 80 a press made once more is aimed again inside the box, with the same events", async (t) => {
  const { events, pressed } = await pressButton(t, { level: 80, commandId: "cmd-twice", seen: [] });
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  const points = pressPoints(pressed);
  assert.equal(points.length, 2);
  for (const point of points) assert.ok(point.x > BOX.left && point.x < BOX.right && point.y > BOX.top && point.y < BOX.bottom);
  const again = await pressButton(t, { level: 80, commandId: "cmd-twice", seen: [] });
  assert.deepEqual(pressPoints(again.pressed), points, "both presses reproduce from the command id");
});

test("the result records the humanness only above level 0: none at 0 or with no level, and the level and the aim at 80", async (t) => {
  const absent = await pressButton(t, { geometry: false });
  const zero = await pressButton(t, { level: 0, geometry: false });
  assert.equal("humanness" in absent.result, false);
  assert.equal("humanness" in zero.result, false);
  assert.deepEqual(zero.result, absent.result, "a result at level 0 is the result with no level");
  const human = await pressButton(t, { level: 80, commandId: "cmd-recorded" });
  const [point] = pressPoints(human.pressed);
  assert.ok(point);
  const aimed = point.x !== CENTRE.x || point.y !== CENTRE.y;
  assert.deepEqual(human.result.humanness, { level: 80, aimed });
  assert.equal(aimed, true, "this command id aims off the centre");
});

test("a press a badge forces back to the gate's point records aimed false", async (t) => {
  let unaimed = 0;
  for (let index = 0; index < 40; index += 1) {
    const { result, pressed } = await pressButton(t, { level: 100, commandId: `cmd-${index}`, badge: true });
    const [point] = pressPoints(pressed);
    assert.equal(result.humanness?.level, 100);
    if (point?.x === CENTRE.x && point.y === CENTRE.y) {
      assert.equal(result.humanness?.aimed, false);
      unaimed += 1;
    } else assert.equal(result.humanness?.aimed, true);
  }
  assert.ok(unaimed > 0, "no drawn point was refused");
});

// A first press the page answered with nothing but its own notice is pressed once more like one it ignored (t898):
// at level 0 at the gate's first point, above 0 aimed again inside the box, reproducibly from the command id.
test("a first press answered only by the page's notice is pressed once more at the gate's point at level 0, and aimed again at level 80", async (t) => {
  const zero = await pressButton(t, { level: 0, settled: "announced", geometry: false });
  assert.deepEqual(zero.events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(pressPoints(zero.pressed), [CENTRE, CENTRE]);
  const human = await pressButton(t, { level: 80, commandId: "cmd-notice", settled: "announced" });
  assert.equal(human.result.status, "succeeded");
  const points = pressPoints(human.pressed);
  assert.equal(points.length, 2);
  for (const point of points) assert.ok(point.x > BOX.left && point.x < BOX.right && point.y > BOX.top && point.y < BOX.bottom);
  const again = await pressButton(t, { level: 80, commandId: "cmd-notice", settled: "announced" });
  assert.deepEqual(pressPoints(again.pressed), points, "both presses reproduce from the command id");
});
