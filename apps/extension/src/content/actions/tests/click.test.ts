// T1 coverage of the click verb's link rule (`click.ts`): which evidence makes a
// link click pass, which makes it fail, and when the in-place watch is started,
// waited on and stopped.
//
// The page is faked at the three things the verb reads -- the element's
// `closest`, its document's `location`, and what `dispatchEvent` answers -- and
// the in-place watch is injected, so each row states an observation and checks
// the verdict drawn from it. Whether the watch sees a real page's answer
// correctly is the content harness's (`e2e/content/tests/click.spec.ts`), which
// runs it against the company-directory fixture, a history-API router, a tab
// panel, and a dead link on a page that moves on its own.
//
// The row that matters most is the one where the page cancelled the click and
// the watch saw nothing: that is a dead link, and it must fail. Make
// `linkValidation` pass it and that row goes red.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { InPlaceEffect, InPlaceEffectWatch } from "../../action-runtime";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";
import { clickAction } from "../click";
import type { ContentActionDependencies } from "../types";

const PAGE = "http://127.0.0.1:4000/scenarios/company-directory/";
const LINK_HREF = `${PAGE}?sector=logistics`;
const EXPECTED = `navigation to ${LINK_HREF} begins, or the page answers the click in place`;
/** `IN_PLACE_WINDOW_MS` in the verb. */
const WINDOW_MS = 5_000;

const CLICK: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: '[data-testid="sector-logistics"]' };

/** What the page does when the click event reaches it. */
type PageBehaviour = {
  /** The target is inside a link naming `LINK_HREF`; a button otherwise. */
  link: boolean;
  /** The page's handler cancels the click's default action. */
  prevent: boolean;
  /** The handler moves the address before the click event returns, as a hash link or a synchronous router push does. */
  moveTo?: string;
};

type FakePage = { element: Element; events: string[] };

/** The `MouseEvent` the verb constructs, which Node lacks; only its type is read here. */
function installMouseEvent(t: TestContext): void {
  const global = globalThis as { MouseEvent?: unknown };
  const had = Object.prototype.hasOwnProperty.call(global, "MouseEvent");
  const previous = global.MouseEvent;
  global.MouseEvent = class {
    constructor(readonly type: string, readonly init: unknown) {}
  };
  t.after(() => {
    if (had) global.MouseEvent = previous;
    else delete global.MouseEvent;
  });
}

function fakePage(behaviour: PageBehaviour): FakePage {
  const events: string[] = [];
  const location = { href: PAGE };
  const anchor = { href: LINK_HREF, protocol: "http:", focus: () => undefined };
  const target = {
    ownerDocument: { location, defaultView: {} },
    closest: (selector: string) => (selector === "a[href]" && !behaviour.link ? null : behaviour.link ? anchor : target),
    focus: () => undefined,
    dispatchEvent(event: { type: string }): boolean {
      events.push(event.type);
      if (event.type !== "click") return true;
      if (behaviour.moveTo !== undefined) location.href = behaviour.moveTo;
      return !behaviour.prevent;
    }
  };
  return { element: target as unknown as Element, events };
}

type WatchRecord = { made: number; settledWith: number[]; stopped: number };

/** An in-place watch that reports `effect` when settled, and records how the verb used it. */
function fakeWatch(effect: InPlaceEffect | undefined, events: string[]): { make: (link: Element) => InPlaceEffectWatch; record: WatchRecord } {
  const record: WatchRecord = { made: 0, settledWith: [], stopped: 0 };
  return {
    record,
    make: () => {
      events.push("watch");
      record.made += 1;
      return {
        settle: async (timeoutMs) => {
          record.settledWith.push(timeoutMs);
          return effect;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

/** The dependencies the click verb reads, with a result builder that keeps only the verdict. Anything else it reaches for throws. */
function dependencies(element: Element, watchInPlaceEffect: ContentActionDependencies["watchInPlaceEffect"]): ContentActionDependencies {
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: () => ({ element, resolution: {} as ReturnType<ContentActionDependencies["resolveTarget"]>["resolution"] }),
    checkActionability: () => ({ actionable: true, point: { x: 10, y: 20 }, detail: "the point 10,20 landed on the target" }),
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    watchInPlaceEffect,
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation): BrowserActionResult => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: validation.status === "failed" ? "failed" : "succeeded",
      message,
      validation,
      startedAt,
      finishedAt: startedAt
    })
  };
  return new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      throw new Error(`the click verb reached for ${property}, which this test does not provide`);
    }
  });
}

async function click(t: TestContext, behaviour: PageBehaviour, effect: InPlaceEffect | undefined, action: BrowserActionCommand = CLICK) {
  installMouseEvent(t);
  const page = fakePage(behaviour);
  const watch = fakeWatch(effect, page.events);
  const result = await clickAction(action, dependencies(page.element, watch.make), 1_000);
  return { result, events: page.events, watch: watch.record };
}

test("a link the page cancelled and then answered by changing its content passes, and says so", async (t) => {
  const { result, watch } = await click(t, { link: true, prevent: true }, { kind: "content", afterMs: 202 });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.validation, {
    status: "passed",
    expected: EXPECTED,
    actual: "the page prevented the navigation and changed its content in place, 202 ms after the press"
  });
  assert.deepEqual(watch, { made: 1, settledWith: [WINDOW_MS], stopped: 1 });
});

test("a link the page cancelled and then answered by moving its address through the history API passes", async (t) => {
  const { result } = await click(t, { link: true, prevent: true }, { kind: "address", url: `${PAGE}?view=2`, afterMs: 150 });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.validation, {
    status: "passed",
    expected: EXPECTED,
    actual: `the page prevented the navigation and moved its address to ${PAGE}?view=2 in place, 150 ms after the press`
  });
});

test("a link the page cancelled and did not answer fails: a dead link is not a success", async (t) => {
  const { result, watch } = await click(t, { link: true, prevent: true }, undefined);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.validation, {
    status: "failed",
    expected: EXPECTED,
    actual: `the page prevented the navigation, and in ${WINDOW_MS} ms neither its address nor its content changed`
  });
  assert.deepEqual(watch, { made: 1, settledWith: [WINDOW_MS], stopped: 1 });
});

test("a link whose navigation the page allowed passes at once, as the navigation it began, without waiting on the page", async (t) => {
  const { result, watch } = await click(t, { link: true, prevent: false }, undefined);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.validation, { status: "passed", expected: EXPECTED, actual: `navigation to ${LINK_HREF} was initiated` });
  // Answered before the document it came from is torn down: nothing was awaited.
  assert.deepEqual(watch, { made: 1, settledWith: [], stopped: 1 });
});

test("a link whose click moved the address before the event returned passes as a same-document navigation", async (t) => {
  const { result, watch } = await click(t, { link: true, prevent: true, moveTo: `${PAGE}#done` }, undefined);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.validation, { status: "passed", expected: EXPECTED, actual: `the page navigated to ${PAGE}#done` });
  assert.deepEqual(watch.settledWith, []);
});

test("the watch starts between the hover and the press, so hovering alone is not taken for the click's effect", async (t) => {
  const { events } = await click(t, { link: true, prevent: true }, { kind: "content", afterMs: 5 });
  assert.deepEqual(events, ["mouseover", "mouseenter", "mousemove", "watch", "mousedown", "mouseup", "click"]);
});

test("a command's own timeout shortens the window a cancelled link is given, and never lengthens it", async (t) => {
  const shorter = await click(t, { link: true, prevent: true }, undefined, { ...CLICK, timeoutMs: 1_200 });
  assert.deepEqual(shorter.watch.settledWith, [1_200]);
  assert.match(String(shorter.result.validation?.status === "failed" && shorter.result.validation.actual), /in 1200 ms neither/u);
  const longer = await click(t, { link: true, prevent: true }, undefined, { ...CLICK, timeoutMs: 60_000 });
  assert.deepEqual(longer.watch.settledWith, [WINDOW_MS]);
});

test("a button is still held to the hit test alone, with no in-place watch, even when the page cancels its click", async (t) => {
  const { result, watch } = await click(t, { link: false, prevent: true }, undefined);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.validation, {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: "the point 10,20 landed on the target; the page prevented the click's default action"
  });
  assert.equal(watch.made, 0);
});
