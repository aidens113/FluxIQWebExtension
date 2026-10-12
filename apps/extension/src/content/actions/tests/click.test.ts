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
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { ActionabilityRejectionCode, ActionabilityReport, InPlaceEffect, InPlaceEffectWatch, PressSignal, RateLimitNotice, RobotCheckSighting } from "../../action-runtime";
import { runWithRecovery, type RecoveryFault } from "../../action-runtime/recovery";
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
  /** The target is no command control -- a text box, a line of text -- so no selector but a link's finds it. */
  plain?: boolean;
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
    closest: (selector: string) => {
      if (selector === "a[href]") return behaviour.link ? anchor : null;
      return behaviour.plain ? null : target;
    },
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

type NoticeRecord = { made: number; settledWith: number[]; stopped: number; refusedWith: RateLimitNotice[]; refusedByPageWith: RateLimitNotice[] };

/** A rate-limit watch that reports `notice` when settled (`later` for a press made once more), and records how the verb used it. */
function fakeNoticeWatch(
  notice: RateLimitNotice | undefined,
  events: string[],
  later?: RateLimitNotice
): { make: ContentActionDependencies["watchRateLimitNotice"]; record: NoticeRecord } {
  const record: NoticeRecord = { made: 0, settledWith: [], stopped: 0, refusedWith: [], refusedByPageWith: [] };
  return {
    record,
    make: () => {
      events.push("notice-watch");
      record.made += 1;
      const answer = record.made === 1 ? notice : later;
      return {
        settle: async (windowMs) => {
          record.settledWith.push(windowMs);
          return answer;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

type CheckRecord = { made: number; settledWith: Array<[number, number]>; stopped: number; handedOver: RobotCheckSighting[] };

/** A robot-check watch that reports `sighting` when settled, and records how the verb used it. */
function fakeCheckWatch(sighting: RobotCheckSighting | undefined, events: string[]): { make: ContentActionDependencies["watchRobotCheck"]; record: CheckRecord } {
  const record: CheckRecord = { made: 0, settledWith: [], stopped: 0, handedOver: [] };
  return {
    record,
    make: () => {
      events.push("check-watch");
      record.made += 1;
      return {
        settle: async (windowMs, waitMs) => {
          record.settledWith.push([windowMs, waitMs]);
          return sighting;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

type IgnoredRecord = { made: number; settledWith: number[]; stopped: number };

/**
 * An ignored-press watch that reports `seen` when the first press's watch is
 * settled and `secondSeen` for the press made once more, and records how the
 * verb used it.
 */
function fakeIgnoredWatch(firstSeen: PressSignal[], events: string[], secondSeen: PressSignal[] = ["change"]): { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord } {
  const record: IgnoredRecord = { made: 0, settledWith: [], stopped: 0 };
  return {
    record,
    make: () => {
      events.push("ignored-watch");
      record.made += 1;
      const seen = record.made === 1 ? firstSeen : secondSeen;
      return {
        settle: async (windowMs) => {
          record.settledWith.push(windowMs);
          return { seen: [...seen], afterMs: seen.length > 0 ? 4 : windowMs };
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

/** The dependencies the click verb reads, with a result builder that keeps only the verdict. Anything else it reaches for throws. */
function dependencies(
  element: Element,
  watchInPlaceEffect: ContentActionDependencies["watchInPlaceEffect"],
  notices: { make: ContentActionDependencies["watchRateLimitNotice"]; record: NoticeRecord },
  checks: { make: ContentActionDependencies["watchRobotCheck"]; record: CheckRecord },
  ignored: { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord },
  pressableAgain: boolean,
  againAs: ActionabilityRejectionCode = "covered",
  judgedAs?: () => ActionabilityReport
): ContentActionDependencies {
  let judged = 0;
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: () => ({ element, resolution: {} as ReturnType<ContentActionDependencies["resolveTarget"]>["resolution"] }),
    checkActionability: () => {
      judged += 1;
      if (judgedAs) return judgedAs();
      return judged === 1 || pressableAgain ? PRESSABLE : notPressable(againAs);
    },
    // The record the real builder writes for a gate's refusal (`results.ts`): its reason word leads `actual`.
    rejected: (action: BrowserActionCommand, startedAt: number, code: string, expected: string, actual: string): BrowserActionResult => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      message: `Action rejected: ${actual}`,
      validation: { status: "failed", expected, actual },
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, { expected, actual: `${code}: ${actual}` }),
      startedAt,
      finishedAt: startedAt
    }),
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    watchInPlaceEffect,
    watchRateLimitNotice: notices.make,
    watchRobotCheck: checks.make,
    watchIgnoredPress: ignored.make,
    needsPerson: (action: BrowserActionCommand, startedAt: number, sighting: RobotCheckSighting): BrowserActionResult => {
      checks.record.handedOver.push(sighting);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page answers the press", actual: "a robot check" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, { actual: "captcha: a robot check" }),
        startedAt,
        finishedAt: startedAt
      };
    },
    rateLimited: (action: BrowserActionCommand, startedAt: number, notice: RateLimitNotice): BrowserActionResult => {
      notices.record.refusedWith.push(notice);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page accepts the press", actual: "refused" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { retryAfterMs: notice.retryAfterMs }),
        startedAt,
        finishedAt: startedAt
      };
    },
    refusedByPage: (action: BrowserActionCommand, startedAt: number, notice: RateLimitNotice): BrowserActionResult => {
      notices.record.refusedByPageWith.push(notice);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page accepts the press", actual: "refused: needs something first" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE),
        startedAt,
        finishedAt: startedAt
      };
    },
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

/** The gate's answer for a control that can be pressed. */
const PRESSABLE: ActionabilityReport = { actionable: true, point: { x: 10, y: 20 }, detail: "the point 10,20 landed on the target" };

/** What the gate says of a layer over the control: what the point landed on, and the layer it belongs to (`covering-layer.ts`). */
const COVER_DETAIL = `the point 10,20 landed on a card, which covers the target; it is under the layer "Hi, I'm Val"`;

/** The gate's answer for a control that can no longer be pressed, for each of its reasons. */
function notPressable(code: ActionabilityRejectionCode): ActionabilityReport {
  if (code === "covered") return { actionable: false, code, detail: COVER_DETAIL, point: { x: 10, y: 20 } };
  return { actionable: false, code, detail: code === "disabled" ? "the element is disabled" : "the element is not in the document" };
}

async function click(
  t: TestContext,
  behaviour: PageBehaviour,
  effect: InPlaceEffect | undefined,
  action: BrowserActionCommand = CLICK,
  notice?: RateLimitNotice,
  sighting?: RobotCheckSighting,
  startedAt = 1_000,
  pressing: PressOptions = {}
) {
  installMouseEvent(t);
  const page = fakePage(behaviour);
  const watch = fakeWatch(effect, page.events);
  const notices = fakeNoticeWatch(notice, page.events, pressing.secondNotice);
  const checks = fakeCheckWatch(sighting, page.events);
  // A page that answers the press unless a row says it ignored it, so every
  // row written before the extra press existed keeps its meaning.
  const ignored = fakeIgnoredWatch(pressing.seen ?? ["change"], page.events, pressing.secondSeen);
  const deps = dependencies(page.element, watch.make, notices, checks, ignored, pressing.pressableAgain ?? true, pressing.againAs);
  const result = await clickAction(action, deps, startedAt);
  return { result, events: page.events, watch: watch.record, notices: notices.record, checks: checks.record, ignored: ignored.record };
}

/** What the page did about the first press, for the rows about pressing once more. */
type PressOptions = {
  /** The signs the ignored-press watch saw; `[]` is a press the page ignored. */
  seen?: PressSignal[];
  /** Whether the control can still be pressed when it is judged again; true unless a row says otherwise. */
  pressableAgain?: boolean;
  /** Why it cannot, when it cannot: covered unless a row says otherwise. */
  againAs?: ActionabilityRejectionCode;
  /** The rate-limit notice the press made once more is answered with. */
  secondNotice?: RateLimitNotice;
  /** The signs the press made once more was answered with; the page answers it unless a row says otherwise. */
  secondSeen?: PressSignal[];
};

/** The events of one press, from the hover to the click, with the watches a first press on a button starts. */
const FIRST_PRESS = ["mouseover", "mouseenter", "mousemove", "notice-watch", "check-watch", "ignored-watch", "mousedown", "mouseup", "click"];
/** A press made once more: the same gesture and the same three watches, since whether it was answered decides the result. */
const SECOND_PRESS = ["mouseover", "mouseenter", "mousemove", "notice-watch", "check-watch", "ignored-watch", "mousedown", "mouseup", "click"];
const IGNORED: PressOptions = { seen: [] };

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

// The press the page refused as "too fast" (lane t195, social-network-feed's
// fourth Confirm inside its window). It landed on the target, so the hit test
// alone passed it and the Flow read the refused request as confirmed.
test("a button the page answers with a going-too-fast notice fails as rate limited, carrying the wait the notice named", async (t) => {
  const { result, notices } = await click(t, { link: false, prevent: false }, undefined, CLICK, { afterMs: 3, retryAfterMs: 12_500 });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.effect, "unacted");
  assert.equal(result.failure?.retryAfterMs, 12_500);
  assert.deepEqual(notices, { made: 1, settledWith: [500], stopped: 1, refusedWith: [{ afterMs: 3, retryAfterMs: 12_500 }], refusedByPageWith: [] });
});

test("a button with no such notice still passes on its hit test, after the rate-limit window", async (t) => {
  const { result, notices } = await click(t, { link: false, prevent: false }, undefined);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(notices, { made: 1, settledWith: [500], stopped: 1, refusedWith: [], refusedByPageWith: [] });
});

test("the rate-limit, robot-check and ignored-press watches start between the hover and the press, so what was already there is never the press's answer", async (t) => {
  const { events } = await click(t, { link: false, prevent: false }, undefined);
  assert.deepEqual(events, FIRST_PRESS);
});

test("a command's own timeout shortens the rate-limit window, and never lengthens it", async (t) => {
  const shorter = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 200 });
  assert.deepEqual(shorter.notices.settledWith, [200]);
  const longer = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 60_000 });
  assert.deepEqual(longer.notices.settledWith, [500]);
});

test("a link is never watched for a rate-limit notice: its own post-condition decides it", async (t) => {
  const { notices } = await click(t, { link: true, prevent: false }, undefined);
  assert.equal(notices.made, 0);
});

// A press the page answers with a robot check drawn in place, no navigation:
// company-website's "Send request" puts up "Checking you are human..." and,
// 2.2 s later, a "Confirm you are human" box. It landed on its target, so the
// hit test alone passed it, and the next step met a page only a person could
// answer. What the watch reads is `robot-check-watch.test.ts`'s.

test("a button whose press puts up a robot check only a person can answer fails as needing a person, not as a success", async (t) => {
  const sighting: RobotCheckSighting = { outcome: "person_only", afterMs: 2_210, waitedMs: 2_200 };
  const { result, checks } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, sighting);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.intervention.required");
  assert.deepEqual(checks.handedOver, [sighting]);
  assert.equal(checks.stopped, 1);
});

test("a robot check that said it would clear by itself and did not is handed to the person too", async (t) => {
  const sighting: RobotCheckSighting = { outcome: "not_cleared", afterMs: 10, waitedMs: 15_000 };
  const { result, checks } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, sighting);
  assert.equal(result.failure?.code, "web.intervention.required");
  assert.deepEqual(checks.handedOver, [sighting]);
});

test("a robot check that cleared by itself was waited out untouched, and the press passes and says so", async (t) => {
  const { result, checks } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, { outcome: "cleared", afterMs: 4, waitedMs: 2_600 });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(checks.handedOver, []);
  const validation = result.validation;
  assert.match(validation.status === "passed" ? validation.actual : "", /robot check that cleared by itself 2600 ms later, untouched/u);
});

test("a press that puts no check up is watched only through the rate-limit window, with a 15 s wait kept for a check that appears", async (t) => {
  const { result, checks } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, Date.now());
  assert.equal(result.status, "succeeded");
  assert.deepEqual(checks.settledWith, [[500, 15_000]]);
  assert.equal(checks.stopped, 1);
});

test("a command's own timeout holds the wait on a robot check within what is left of it", async (t) => {
  const { checks } = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 6_000 }, undefined, undefined, Date.now());
  const [[windowMs, waitMs] = [0, 0]] = checks.settledWith;
  assert.equal(windowMs, 500);
  assert.ok(waitMs <= 5_000 && waitMs >= 4_900, `waited at most ${waitMs} ms`);
});

test("a link is never watched for a robot check: where it lands is the worker's to judge", async (t) => {
  const { checks } = await click(t, { link: true, prevent: false }, undefined);
  assert.equal(checks.made, 0);
});

// A press the page ignored outright (bigbox-retail: `vr.wake()` swallows the
// first add-to-cart press after every load and does nothing). The build pressed
// once after each reload, thirty times, and never added anything. What the
// watch reads is `ignored-press/tests/page-press-listener.test.ts`'s; these rows
// are the verb's decision on it. Take the extra press out of `clickAction` and
// every row that expects a second press goes red; make it press whatever the
// watch saw and the request row does.

test("a button the page ignored outright is pressed once more at the same point, and the result says so", async (t) => {
  const { result, events, ignored, notices, checks } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, IGNORED);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(result.validation, {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: "the point 10,20 landed on the target; the page ignored the first press, so it was pressed once more"
  });
  assert.deepEqual(ignored, { made: 2, settledWith: [800, 800], stopped: 2 }, "the press made once more is watched for an answer too");
  assert.equal(notices.made, 2, "the press made once more is watched for a refusal like any other");
  assert.equal(notices.stopped, 2);
  assert.equal(checks.made, 2);
});

test("a press the page ignored twice is not a success: it fails as not observed, saying neither press was answered", async (t) => {
  // everything-store's buy box comes alive 1.2 s after its page loads; a press
  // soon after the load is ignored twice and was reported done (t174-w34).
  const { result, events, ignored } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: [], secondSeen: [] });
  assert.equal(result.status, "failed");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "pressed twice, never a third time");
  assert.deepEqual(result.validation, {
    status: "failed",
    expected: "the page answers the press",
    actual: "the point 10,20 landed on the target; the page ignored the first press, so it was pressed once more, and it ignored that press too: no request, no change inside the control or its section, no navigation and no focus move"
  });
  assert.deepEqual(ignored, { made: 2, settledWith: [800, 800], stopped: 2 });
});

test("a press on something that is no command control, ignored twice, passes as before: a text box or a line of text is pressed for no change", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false, plain: true }, undefined, CLICK, undefined, undefined, 1_000, { seen: [], secondSeen: [] });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.match(result.validation.status === "passed" ? result.validation.actual : "", /pressed once more$/u);
});

test("a press made once more that the page answered in any way passes, as the press made once more", async (t) => {
  for (const signal of ["request", "change", "navigation", "focus"] as PressSignal[]) {
    const { result } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: [], secondSeen: [signal] });
    assert.equal(result.status, "succeeded", signal);
    assert.match(result.validation.status === "passed" ? result.validation.actual : "", /pressed once more$/u, signal);
  }
});

test("a press that sent a request is never pressed again, even when nothing on the page changed", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["request"] });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
  assert.doesNotMatch(result.validation.status === "passed" ? result.validation.actual : "", /pressed once more/u);
});

test("a press answered by any sign at all -- a change, a navigation, a focus move -- is pressed once only", async (t) => {
  for (const signal of ["change", "navigation", "focus"] as PressSignal[]) {
    const { events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: [signal] });
    assert.deepEqual(events, FIRST_PRESS, signal);
  }
});

test("an ignored press whose control can no longer be pressed -- now disabled or gone -- is not pressed again", async (t) => {
  for (const againAs of ["disabled", "hidden"] as ActionabilityRejectionCode[]) {
    const { result, events } = await click(t, { link: false, prevent: false }, undefined, { ...CLICK }, undefined, undefined, 1_000, { seen: [], pressableAgain: false, againAs });
    assert.equal(result.status, "succeeded", againAs);
    assert.deepEqual(events, FIRST_PRESS, againAs);
  }
});

// bigbox-retail's support card opens on a timer three seconds after a product
// page loads, over the pinned Add to cart; a first press made just before it
// only woke the page, and the card that covered the button during the wait was
// taken for the press's answer: reported done with nothing in the cart, in a
// trial and in playback (`run-mv5tusj4-b7ee0630`, t476). Make the covered
// branch succeed again and this row goes red.
test("an ignored press whose control a layer then covered is refused as covered, naming the layer, and is not pressed again in this attempt", async (t) => {
  const action = { ...CLICK };
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, action, undefined, undefined, 1_000, { seen: [], pressableAgain: false });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE);
  assert.equal(result.failure?.actual, `covered: ${COVER_DETAIL}; the page ignored the press, and this layer covered the control during the wait, so the press is made once more once the layer is closed`);
  assert.equal(result.failure?.effect, undefined, "a press was made, so the refusal never says it was not");
  assert.deepEqual(events, FIRST_PRESS, "pressed once: the press made once more waits for the layer to be closed");
});

test("a press that began a request is never pressed again, even when a layer then covers its control", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, { ...CLICK }, undefined, undefined, 1_000, { seen: ["request"], pressableAgain: false });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
});

test("a first press refused for going too fast is reported as refused and never pressed again", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, { afterMs: 3, retryAfterMs: 12_500 }, undefined, 1_000, IGNORED);
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.deepEqual(events, FIRST_PRESS);
});

test("a first press that put up a robot check which cleared is not pressed again: the check was its answer", async (t) => {
  const cleared: RobotCheckSighting = { outcome: "cleared", afterMs: 4, waitedMs: 2_600 };
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, cleared, 1_000, IGNORED);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
});

test("the press made once more is refused as rate limited when the page answers it so", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, {
    seen: [],
    secondNotice: { afterMs: 2, retryAfterMs: 8_500 }
  });
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryAfterMs, 8_500);
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
});

test("a command's own timeout shortens the ignored-press window, and never lengthens it", async (t) => {
  const shorter = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 300 });
  assert.deepEqual(shorter.ignored.settledWith, [300]);
  const longer = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 60_000 });
  assert.deepEqual(longer.ignored.settledWith, [800]);
});

test("a link is never watched for an ignored press, and never pressed twice: its own post-condition decides it", async (t) => {
  const { ignored, events } = await click(t, { link: true, prevent: true }, undefined, CLICK, undefined, undefined, 1_000, IGNORED);
  assert.equal(ignored.made, 0);
  assert.equal(events.filter((event) => event === "click").length, 1);
});

// The press the page refused because it needs something first (t174 F40):
// crossborder's Add to cart, with no colour chosen, writes "Please select a
// Color." into the item's error line -- outside the buy bar, so the
// ignored-press watch saw nothing -- and adds nothing. It used to be pressed
// once more and reported a success.
test("a first press the page answers with a line that it needs something first fails as refused by the page and is never pressed again", async (t) => {
  const { result, events, notices } = await click(t, { link: false, prevent: false }, undefined, CLICK, { afterMs: 4, needs: true }, undefined, 1_000, IGNORED);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.refused_by_page");
  assert.equal(result.failure?.retryable, false, "no backoff and no recovery loop makes the same press again");
  assert.deepEqual(notices.refusedByPageWith, [{ afterMs: 4, needs: true }]);
  assert.deepEqual(notices.refusedWith, [], "it is not reported as a rate limit");
  assert.deepEqual(events, FIRST_PRESS, "one press, never a blind second one");
});

test("the press made once more is refused by the page when the page answers it so", async (t) => {
  const { result, events, notices } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, {
    seen: [],
    secondNotice: { afterMs: 2, needs: true }
  });
  assert.equal(result.failure?.code, "web.action.refused_by_page");
  assert.deepEqual(notices.refusedByPageWith, [{ afterMs: 2, needs: true }]);
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
});

// The same press as `actions/execute.ts` runs it: inside the in-page recovery
// (`action-runtime/recovery/`), which closes a layer over the target through
// its own way out and runs the click again. These rows are the whole of t476's
// fix: the press the page only woke on is made once more after the layer that
// covered it is closed -- once, never a third time -- and a press that began a
// request is never made again, covered or not.

/** What one recovering click did: the result, the faults the recovery cleared for, the page's events, and how many presses were made. */
type RecoveringClick = { result: BrowserActionResult; cleared: RecoveryFault[]; events: string[]; presses: number; looks: number };

/**
 * A click run inside the recovery loop. `answers` is what the page answers
 * each press with, in order (`[]` ignored it); `gate` is what the gate says at
 * each look, in order, and the control is pressable at any look past it.
 */
async function recoveringClick(t: TestContext, answers: PressSignal[][], gate: ActionabilityReport[]): Promise<RecoveringClick> {
  installMouseEvent(t);
  const page = fakePage({ link: false, prevent: false });
  let presses = 0;
  const ignored: { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord } = {
    record: { made: 0, settledWith: [], stopped: 0 },
    make: () => {
      page.events.push("ignored-watch");
      const seen = answers[presses] ?? ["change"];
      presses += 1;
      return { settle: async (windowMs) => ({ seen: [...seen], afterMs: seen.length > 0 ? 4 : windowMs }), stop: () => undefined };
    }
  };
  let looks = 0;
  const judged = (): ActionabilityReport => gate[looks++] ?? PRESSABLE;
  const deps = dependencies(page.element, fakeWatch(undefined, page.events).make, fakeNoticeWatch(undefined, page.events), fakeCheckWatch(undefined, page.events), ignored, true, "covered", judged);
  // One command object for every attempt, as `executeContentAction` hands it.
  const action: BrowserActionCommand = { ...CLICK };
  const cleared: RecoveryFault[] = [];
  const close = (fault: RecoveryFault): number => {
    cleared.push(fault);
    page.events.push("layer-closed");
    return 1;
  };
  const { result } = await runWithRecovery(action, 1_000, () => clickAction(action, deps, 1_000), async () => undefined, () => 1_000, close, () => false);
  return { result, cleared, events: page.events, presses, looks };
}

const COVERED = notPressable("covered");

test("a timed layer over a press the page only woke on: the layer is closed and the control pressed once more, and that press is answered", async (t) => {
  const { result, cleared, events, presses } = await recoveringClick(t, [[], ["request"]], [PRESSABLE, COVERED, PRESSABLE]);
  assert.equal(result.status, "succeeded");
  assert.equal(presses, 2, "pressed again, once");
  assert.deepEqual(events, [...FIRST_PRESS, "layer-closed", ...FIRST_PRESS]);
  assert.deepEqual(cleared, ["obstructed_target"], "the recovery closed the layer the refusal named before it ran the click again");
  assert.deepEqual(result.validation, {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: "the point 10,20 landed on the target; the page ignored the first press and a layer then covered the control, so the layer was closed and it was pressed once more"
  });
});

test("the press made once more after the layer is closed is never followed by a third: ignored too, it fails as not observed", async (t) => {
  const { result, events, presses } = await recoveringClick(t, [[], []], [PRESSABLE, COVERED, PRESSABLE, PRESSABLE]);
  assert.equal(result.status, "failed");
  assert.equal(presses, 2);
  assert.deepEqual(events, [...FIRST_PRESS, "layer-closed", ...FIRST_PRESS]);
  assert.match(result.validation.status === "failed" ? result.validation.actual : "", /so the layer was closed and it was pressed once more, and it ignored that press too: no request/u);
});

test("a press that began a request is pressed once, and no layer that then covers its control is closed for it", async (t) => {
  const { result, cleared, events, presses, looks } = await recoveringClick(t, [["request"]], [PRESSABLE, COVERED]);
  assert.equal(result.status, "succeeded");
  assert.equal(presses, 1, "never pressed again");
  assert.deepEqual(events, FIRST_PRESS);
  assert.deepEqual(cleared, []);
  assert.equal(looks, 1, "an answered press is never looked at again for a cover");
});

test("a second cover after the press made once more reads as answered: a layer the press opens itself is left open", async (t) => {
  const { result, cleared, presses } = await recoveringClick(t, [[], []], [PRESSABLE, COVERED, PRESSABLE, COVERED]);
  assert.equal(result.status, "succeeded");
  assert.equal(presses, 2);
  assert.deepEqual(cleared, ["obstructed_target"]);
});
