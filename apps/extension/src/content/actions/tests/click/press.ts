// One press of the click verb on the faked page, with every watch faked, and
// the event sequences a press produces (`actions/tests/click.test.ts`,
// `click/tests/`). Moved out of `click.test.ts` on 2026-10-20, unchanged.

import type { TestContext } from "node:test";
import type { ActionabilityRejectionCode, InPlaceEffect, PressSignal, RateLimitNotice, RobotCheckSighting } from "../../../action-runtime";
import type { BrowserActionCommand } from "../../../types";
import { clickAction } from "../../click";
import { dependencies } from "./dependencies";
import { fakePage, installMouseEvent, type PageBehaviour } from "./page";
import { fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakeWatch } from "./watches";

export const CLICK: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: '[data-testid="sector-logistics"]' };

export async function click(
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
  const ignored = fakeIgnoredWatch(pressing.seen ?? ["change"], page.events, pressing.secondSeen, pressing.settledUnchanged);
  const deps = dependencies(page.element, watch.make, notices, checks, ignored, pressing.pressableAgain ?? true, pressing.againAs);
  const result = await clickAction(action, deps, startedAt);
  return { result, events: page.events, watch: watch.record, notices: notices.record, checks: checks.record, ignored: ignored.record, unchangedAsked: ignored.unchangedAsked };
}

/** What the page did about the first press, for the rows about pressing once more. */
export type PressOptions = {
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
  /** Whether the page, once settled, was exactly as before the press (t517), or so but for its own notice (t743); it was not unless a row says so. */
  settledUnchanged?: boolean | "announced";
};

/** The events of one press, from the hover to the click, with the watches a first press on a button starts. */
export const FIRST_PRESS = ["mouseover", "mouseenter", "mousemove", "notice-watch", "check-watch", "ignored-watch", "mousedown", "mouseup", "click"];
/** A press made once more: the same gesture and the same three watches, since whether it was answered decides the result. */
export const SECOND_PRESS = ["mouseover", "mouseenter", "mousemove", "notice-watch", "check-watch", "ignored-watch", "mousedown", "mouseup", "click"];
export const IGNORED: PressOptions = { seen: [] };
