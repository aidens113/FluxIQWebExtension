// The click verb: refuse a target that cannot be clicked, then click it the way
// a person does.
//
// Two things separate this from the `HTMLElement.click()` it replaces. The
// actionability gate means a disabled, hidden, or covered target is refused as
// ACTION_REJECTED with a code, rather than reported as a success that changed
// nothing -- the single most common way a browser automation lies about what it
// did. And the gesture is a pointer and mouse sequence at the hit-tested point,
// pointerover through click, with the focus move a real press performs, rather
// than a bare `click` event: a page that opens its menu on `pointerdown`, or
// that tracks `mousedown` to decide what the click means, never sees a bare
// click at all.
//
// The post-condition is the hit test -- the point that was clicked and what it
// landed on -- unless the page answers the press with a notice that it was
// refused for going too fast. Then the press did land and nothing happened, so
// it fails as `web.action.rate_limited` with the wait the notice named, and
// Core runs the node again after that wait (`action-runtime/rate-limit-notice.ts`).
// Until 2026-09-30 such a press passed on its hit test, and a Flow confirming
// four friend requests on social-network-feed read the refused fourth as done.
// Or unless the page answers with a line in the control's region saying it
// needs something first -- "Please select a Color." -- when the press did
// nothing and fails as `web.action.refused_by_page`, not retryable and never
// pressed again: the same press is answered the same way until the page has
// what it asked for. Until 2026-10-02 crossborder's Add to cart was pressed
// twice and reported done with nothing in the cart (`run-muqk4u32-0b36e58f`).
// Or unless the page answers the press with a robot check drawn in place
// (`action-runtime/robot-check/`): one only a person can answer, or one that
// says it clears by itself and has not within the wait, fails
// USER_INTERVENTION_REQUIRED with the press recorded as made; one that clears
// by itself is waited out, untouched, and the press passes. Nothing is waited
// for unless such a check appears.
// And a press the page ignored outright is made once more. bigbox-retail's
// first add-to-cart press after every load only wakes the page and does
// nothing, and a Flow that reloaded and pressed once did so thirty times
// (`run-munvz5x0-84fa6177`). So the first press is watched, for up to 800 ms,
// for any sign at all that the page answered it -- a request, a change inside
// the control or its section, a navigation, focus moving elsewhere
// (`action-runtime/ignored-press/`) -- and only when none came is the control,
// if it can still be pressed, pressed again at the same point, once, and the
// result says so. Any sign, above all a request, means it is never pressed
// again: a second press on one that did something is a second order. A request
// counts from the moment the page begins it, not when its response ends: until
// 2026-10-12 a Confirm whose page awaited a slow server before changing the
// card read as ignored and confirmed one friend request twice in playback
// (`run-mv5jnc5m-a47c3e59`, t465). The press
// made once more is watched the same way, and on a command control -- a
// button, a submit, button or image input, anything that says it is a button,
// and not the one already current or selected -- one the page ignored too is
// not a success: it fails as `output_not_observed`, saying neither press was
// answered. The everything store's buy box only comes alive 1.2 s after its
// page loads, so a press soon after the load is ignored twice, and until
// 2026-10-01 it was reported done with nothing in the cart (lane A, `t174-w34`).
// A press on anything else that changes nothing is what it always was: a text
// box pressed to focus it, a line of text, the tab already selected are pressed
// for no change, and are not failed for it.
// A press the page ignored whose control a layer then covered during the wait
// is not answered by that layer. Until 2026-10-12 it was: bigbox's support card
// opens on a timer three seconds after a product page loads, and an Add to cart
// pressed just before it only woke the page, the card covered the button, and
// the press was reported done with nothing in the cart, in a trial and in
// playback (`run-mv5tusj4-b7ee0630`, t476). Such a press now fails as covered,
// naming the layer, which the in-page recovery closes through its own way out
// before it runs the click again (`action-runtime/recovery/`); that run's press
// is the press made once more, counted against the command
// (`action-runtime/ignored-press/command-presses.ts`), so it is never followed
// by a third, and one the page ignores too fails as above. Only a press with no
// sign at all is read so: one that began a request, or changed its control or
// section, moved focus or navigated, is never pressed again, covered or not.
// A control now disabled or gone, rather than covered, still reads as
// answered, and so does a second cover after the press made once more: a layer
// a press opens itself, with no other sign, is then left open.
// And a press whose only answer was a change in its section that came and went
// is no answer. social-network-feed's Post spins for 450 ms on its first
// press, turns back into Post and posts nothing; only the second press posts.
// The spinner is a sign, so the watch above never pressed again, and trials and
// playback passed the press with nothing posted (`run-mv6v2jh4-69244ffb`). So a
// first press answered only by a change in its section is looked at once more
// (`action-runtime/ignored-press/settled-look.ts`): when, within
// `NO_EFFECT_SETTLE_MS`, the page settled exactly as it was before the press --
// no request, navigation or focus move at any point, nothing outside the
// section, the section's markup and fields the same -- and the command control
// can still be pressed, the press certainly did nothing. It fails as
// `web.action.no_effect`, which states the act did not happen and is marked
// `certainNoEffect`: Core makes it once more, and only once, even a lasting
// act the person granted (t517). The click never presses a third time itself:
// a press it already made once more, or the press made after a layer was
// closed, is not looked at again.
// And a press the page answered with nothing but its own notice did not
// happen. Rerun round 4's job trial pressed a save control that showed a busy
// state, reverted, and put a notice in a `role="status"` region; nothing was
// saved, yet the notice was a change outside the section, so the press passed
// and was counted as a landed act (`run-mvgw1854-5d10955b`, t743). The same
// settled look now leaves the page's own notice regions out
// (`action-runtime/ignored-press/live-region.ts`) and answers `"announced"`
// when, apart from a region now holding new words, everything settled exactly
// as before the press. That press fails as `web.action.page_reported_failure`,
// unacted and `certainNoEffect`, so Core makes it again under its first attempt
// plus three retries; on any control, a command control or not, because the
// page's notice says it expected the press to do something. The notice's words
// are never read: a success is told apart by what comes with it -- a request, a
// lasting change in the control or the page -- which is an answer as before.
// A link is held to more than that, because a link states where it
// goes: the click must visibly do what following it would. A navigation that
// begins does, and so does the page's own script taking the click over and
// answering it in place -- moving the address through the history API, or
// changing the content a reader sees, as a filter, a pager or a tab strip does
// (`action-runtime/in-place-effect.ts` says what counts and why). A link whose
// handler swallows the click and does neither is reported as
// `output_not_observed` instead of as a success.
//
// Until 2026-09-17 only the navigation counted, so every script-handled link
// failed: all four company-directory Flows built live that week failed at their
// first click, on a sector link the page had in fact answered by loading the
// filtered rows in place.
//
// The events carry the element's own window as their `view`, so a click inside
// a child frame is dispatched in that frame rather than in the top one. The
// gesture itself is `action-runtime/click-gesture.ts`, shared with the defence
// that presses a blocking dialog's own way out (`action-runtime/interference/`),
// which needs the same press and cannot import a verb.

import { WEB_AUTOMATION_CHECK_WAIT_MS, WEB_AUTOMATION_FAILURE_CODES, webAutomationBaseTimeoutMs, webToggleSignatureShown } from "@fluxiq-web-extension/domain/client";
import { dispatchClickGesture, extraPressesMade, noteExtraPress, pressAgain } from "../action-runtime";
import type {
  ActionResultEvidence,
  ClickPoint,
  IgnoredPressAnswer,
  IgnoredPressWatch,
  InPlaceEffect,
  InPlaceEffectWatch,
  RateLimitNotice,
  RateLimitWatch,
  RobotCheckSighting,
  RobotCheckWatch
} from "../action-runtime";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
import { toggleReadingOf } from "./toggle-reading";
import type { ContentActionDependencies } from "./types";

/** A link the click follows: the anchor itself, and the address it names. */
type NavigatingLink = { anchor: Element; href: string };

/**
 * How long a page that cancelled a link's navigation is given to answer the
 * click in place: the window the recorder allows a click to explain the
 * navigation after it, and the domain allows a replayed click to land. A
 * command's own `timeoutMs` can shorten it but never lengthen it, because the
 * domain passes a node's timeout through and a dead link would otherwise stall
 * for all of it. Only a click the page answered with nothing waits it out.
 */
const IN_PLACE_WINDOW_MS = 5_000;

/**
 * How long after a press that is not a link the page is watched for a notice
 * that it refused the press for going too fast (`action-runtime/rate-limit-notice.ts`).
 * Paid in full only by a press whose answer is neither such a notice, nor the
 * pressed control leaving the document, nor the document leaving; a notice the
 * press's own handler opens is seen at once. Shortened, never lengthened, by
 * the command's own timeout.
 */
const RATE_LIMIT_WINDOW_MS = 500;

/**
 * How long a robot check a press puts up is followed while it says it is
 * checking by itself, before it is handed to the person
 * (`action-runtime/robot-check/robot-check-watch.ts`). Paid only by a press
 * that actually put such a check up.
 */
const ROBOT_CHECK_WAIT_MS = WEB_AUTOMATION_CHECK_WAIT_MS;

/** Kept back from the command's own timeout, so a result still reaches Core in time. */
const ROBOT_CHECK_REPLY_MARGIN_MS = 1_000;

/**
 * How long after a press that is not a link the page is watched for any sign
 * it answered the press at all (`action-runtime/ignored-press/`). Paid in full
 * only by a press the page did nothing whatever about -- any request, change
 * in the control's section, navigation or focus move ends it at once -- and
 * that press is then made once more. Shortened, never lengthened, by the
 * command's own timeout.
 */
const IGNORED_PRESS_WINDOW_MS = 800;

/**
 * How long a first press answered only by a change in its section is given to
 * settle back to exactly how the page was before it (`settled-look.ts`). Paid
 * in full only by a press whose section is still moving, or changed and stayed
 * changed without another sign; a section that comes back is read as soon as
 * it is quiet. Shortened, never lengthened, by the command's own timeout.
 */
const NO_EFFECT_SETTLE_MS = 1_500;

/** What a press that certainly did nothing says, after the hit test. A closed phrase: nothing the page wrote is in it. */
const SETTLED_UNCHANGED = "the page changed only for a moment, and once it settled nothing on it had changed: no request, no navigation, no focus move, nothing outside the control's section, and the section exactly as before the press; the control can still be pressed";

/** What a press the page answered with nothing but its own notice says, after the hit test (t743). A closed phrase: nothing the page wrote is in it. */
const NOTICE_ONLY = "once the page settled, the press had brought nothing but a notice in one of the page's own status or alert regions: no request, no navigation, no focus move, nothing else outside the control's section, and the control and its section exactly as before the press; the control can still be pressed";

/** What a press made twice says, in the result's `actual`. A closed phrase: nothing the page wrote is in it. */
const PRESSED_ONCE_MORE = "the page ignored the first press, so it was pressed once more";

/** What a press the page ignored twice says. A closed phrase, as above. */
const IGNORED_TWICE = "the page ignored the first press, so it was pressed once more, and it ignored that press too";

/** What a cover refused after a press the page ignored says, after the layer the gate named. A closed phrase, as above. */
const COVERED_AFTER_IGNORED = "the page ignored the press, and this layer covered the control during the wait, so the press is made once more once the layer is closed";

/** What the press made once more after that layer was closed says. A closed phrase, as above. */
const PRESSED_AFTER_COVER = "the page ignored the first press and a layer then covered the control, so the layer was closed and it was pressed once more";

/** What that press says when the page ignored it too. A closed phrase, as above. */
const IGNORED_AFTER_COVER = `${PRESSED_AFTER_COVER}, and it ignored that press too`;

/** What one press on a control that is not a link was seen to bring. */
type PressOutcome = {
  /** Whether the click's default action was allowed to run. */
  accepted: boolean;
  /** A notice that the page refused the press for going too fast. */
  refused: RateLimitNotice | undefined;
  /** A robot check the press put up. */
  sighting: RobotCheckSighting | undefined;
  /** What the page did at all: on a first press, whether to press once more; on that second press, whether either was answered. */
  answer: IgnoredPressAnswer | undefined;
  /** A first press answered only by a change in its section, after which the page settled exactly as it was (t517). */
  settledUnchanged: boolean;
  /** A first press after which the page settled exactly as it was but for a notice in one of its own notice regions (t743). */
  noticeOnly: boolean;
};

export async function clickAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const { element, resolution } = deps.resolveTarget(action);
  const evidence = (): ActionResultEvidence => ({
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot(),
    resolution
  });

  // A target that already shows the state this press is meant to bring is not pressed: a toggle step is safe to run again (t775).
  if (action.ensureState && webToggleSignatureShown(action.ensureState, toggleReadingOf(element, deps.describeElement(element)))) {
    return alreadyInState(action, deps, startedAt, evidence());
  }

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be clicked", report.detail, { ...evidence(), blockedAt: report.point, target: element, refusedBeforeDispatch: true });
  }

  const link = navigatingLink(element);
  if (!link) {
    // An earlier attempt of this command was a press the page ignored and a
    // layer then covered: this press, made after the layer was closed, is the
    // press made once more (`action-runtime/ignored-press/command-presses.ts`).
    const extra = extraPressesMade(action);
    const again = extra > 0 ? PRESSED_AFTER_COVER : undefined;
    const first = await press(element, report.point, action, deps, startedAt, extra === 0);
    // Before the ignored-press rule: a page that wrote its refusal outside the
    // control's section is a press the watch saw no sign of, and is never pressed again.
    if (first.refused) return refusal(action, deps, startedAt, first.refused, evidence());
    if (first.sighting && first.sighting.outcome !== "cleared") return deps.needsPerson(action, startedAt, first.sighting, evidence());
    // Nothing but the page's own notice: the page reported the press failed, for Core to make again (t743).
    if (first.noticeOnly && deps.checkActionability(element).actionable) {
      return deps.success(action, startedAt, "Element clicked, and the page answered only with a notice.", noticeOnlyValidation(report.detail, first.accepted), evidence(), WEB_AUTOMATION_FAILURE_CODES.PAGE_REPORTED_FAILURE);
    }
    // A change that came and went, and a page settled exactly as it was: certainly nothing, for Core to press once more.
    if (first.settledUnchanged && deps.checkActionability(element).actionable) {
      return deps.success(action, startedAt, "Element clicked, and the page settled unchanged.", settledUnchangedValidation(report.detail, first.accepted), evidence(), WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT);
    }
    // A robot check that came and went was an answer; so is any sign the watch saw.
    if (first.sighting || !first.answer || first.answer.seen.length > 0) {
      return deps.success(action, startedAt, "Element clicked.", hitTestValidation(report.detail, first.accepted, first.sighting, again), evidence());
    }
    if (!pressAgain(first.answer.seen, extra)) {
      // The press made once more, after the layer was closed, was ignored too.
      // A control now covered, disabled or gone reads as answered, as below.
      if (expectsAnswer(element) && deps.checkActionability(element).actionable) {
        return deps.success(action, startedAt, "Element clicked.", ignoredTwiceValidation(report.detail, first.accepted, IGNORED_AFTER_COVER), evidence());
      }
      return deps.success(action, startedAt, "Element clicked.", hitTestValidation(report.detail, first.accepted, first.sighting, again), evidence());
    }
    // The page did nothing at all. The control is pressed once more at the same
    // point, but only while it can still be pressed. One now disabled or gone
    // was answered after all, by whatever removed it. One now covered was not:
    // a layer that came during the wait is the page's own motion, so the cover
    // is refused, naming the layer, and the in-page recovery closes it and runs
    // the click again, whose press is the press made once more.
    const now = deps.checkActionability(element);
    if (!now.actionable) {
      if (now.code === "covered") {
        noteExtraPress(action);
        return deps.rejected(action, startedAt, now.code, "the page answers the press", `${now.detail}; ${COVERED_AFTER_IGNORED}`, { ...evidence(), blockedAt: now.point, target: element });
      }
      return deps.success(action, startedAt, "Element clicked.", hitTestValidation(report.detail, first.accepted, first.sighting), evidence());
    }
    const second = await press(element, report.point, action, deps, startedAt, false);
    if (second.refused) return refusal(action, deps, startedAt, second.refused, evidence());
    if (second.sighting && second.sighting.outcome !== "cleared") return deps.needsPerson(action, startedAt, second.sighting, evidence());
    if (!second.sighting && second.answer && second.answer.seen.length === 0 && expectsAnswer(element)) {
      return deps.success(action, startedAt, "Element clicked.", ignoredTwiceValidation(report.detail, second.accepted), evidence());
    }
    return deps.success(action, startedAt, "Element clicked.", hitTestValidation(report.detail, second.accepted, second.sighting, PRESSED_ONCE_MORE), evidence());
  }

  const document = element.ownerDocument;
  const before = document.location.href;
  // Started at the press rather than before the hover, so that what hovering
  // the link does on its own is not taken for what the click did.
  let watch: InPlaceEffectWatch | undefined;
  try {
    const accepted = dispatchClickGesture(element, report.point, () => {
      watch = deps.watchInPlaceEffect(link.anchor);
    });
    const after = document.location.href;
    const validation = await linkValidation(link.href, before, after, accepted, watch, inPlaceWindowMs(action));
    return deps.success(action, startedAt, "Element clicked.", validation, evidence());
  } finally {
    watch?.stop();
  }
}

/**
 * A press the page refused in words: as needing something first, which the
 * same press cannot change (REFUSED_BY_PAGE, not retryable), or as too fast or
 * busy, which a press after a wait may (RATE_LIMITED).
 */
function refusal(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number, notice: RateLimitNotice, evidence: ActionResultEvidence): BrowserActionResult {
  return notice.needs ? deps.refusedByPage(action, startedAt, notice, evidence) : deps.rateLimited(action, startedAt, notice, evidence);
}

/**
 * The link this click navigates through, if any. `closest` rather than the
 * element itself because a click nearly always lands on the text or icon inside
 * the anchor; a `javascript:` href names no destination, so it is not held to
 * one.
 */
function navigatingLink(element: Element): NavigatingLink | undefined {
  const anchor = element.closest("a[href]") as (Element & { href?: string; protocol?: string }) | null;
  if (!anchor || typeof anchor.href !== "string" || !anchor.href) return undefined;
  if (anchor.protocol === "javascript:") return undefined;
  return { anchor, href: anchor.href };
}

/**
 * Presses a control that is not a link once, with the watches started between
 * the hover and the press so that nothing already on the page is taken for its
 * answer. They read the same window and end on their own signals, so an
 * ordinary press waits no longer than its answer takes; only a robot check the
 * press puts up is followed past it. Both presses are watched for any answer;
 * the second is never followed by a third. `lookAgain` is set on a command's
 * first press only: one answered by nothing but a change in its section is
 * then given `NO_EFFECT_SETTLE_MS` to settle back -- read as certainly nothing
 * only on a command control, and as nothing but the page's notice on any (t743).
 */
async function press(
  element: Element,
  point: ClickPoint,
  action: BrowserActionCommand,
  deps: ContentActionDependencies,
  startedAt: number,
  lookAgain: boolean
): Promise<PressOutcome> {
  // Assigned inside the gesture's callback, which control flow cannot see.
  let notice = undefined as RateLimitWatch | undefined;
  let check = undefined as RobotCheckWatch | undefined;
  let ignored = undefined as IgnoredPressWatch | undefined;
  try {
    const accepted = dispatchClickGesture(element, point, () => {
      notice = deps.watchRateLimitNotice(element);
      check = deps.watchRobotCheck(element);
      ignored = deps.watchIgnoredPress(element);
    });
    const windowMs = rateLimitWindowMs(action);
    const [refused, sighting, answer] = await Promise.all([
      notice ? notice.settle(windowMs) : undefined,
      check ? check.settle(windowMs, robotCheckWaitMs(action, startedAt)) : undefined,
      ignored ? ignored.settle(windowWithin(action, IGNORED_PRESS_WINDOW_MS)) : undefined
    ]);
    const changedOnly = answer !== undefined && answer.seen.length === 1 && answer.seen[0] === "change";
    // Looked at on any control, since a notice may answer one that is not a
    // command control (t743); an unchanged page fails only a command control.
    const looked = lookAgain && changedOnly && !refused && !sighting && ignored !== undefined
      ? await ignored.settleUnchanged(windowWithin(action, NO_EFFECT_SETTLE_MS))
      : false;
    return { accepted, refused, sighting, answer, settledUnchanged: looked === true && expectsAnswer(element), noticeOnly: looked === "announced" };
  } finally {
    notice?.stop();
    check?.stop();
    ignored?.stop();
  }
}

/**
 * A link's post-condition, in the order its evidence arrives.
 *
 * A same-document navigation has already happened by the time the gesture
 * returns, so the changed location is the observation. A cross-document one
 * the page allowed has only been started, which is as much as this frame can
 * see before it is torn down -- so the claim made is that it began, not that it
 * arrived, and it is answered at once, before the document goes.
 *
 * A click the page cancelled is the page's own script handling the link, and
 * it is judged by what that script then did: moved the address, or changed the
 * content. Only a cancelled click after which neither happened within the
 * window fails -- the dead link, the handler that swallows the click, the press
 * that restyled the link and nothing else.
 */
async function linkValidation(
  href: string,
  before: string,
  after: string,
  accepted: boolean,
  watch: InPlaceEffectWatch | undefined,
  windowMs: number
): Promise<BrowserActionValidation> {
  const expected = `navigation to ${href} begins, or the page answers the click in place`;
  if (after !== before) return { status: "passed", expected, actual: `the page navigated to ${after}` };
  if (accepted) return { status: "passed", expected, actual: `navigation to ${href} was initiated` };
  const effect = watch ? await watch.settle(windowMs) : undefined;
  if (effect) return { status: "passed", expected, actual: inPlaceActual(effect) };
  return {
    status: "failed",
    expected,
    actual: `the page prevented the navigation, and in ${windowMs} ms neither its address nor its content changed`
  };
}

/** What the page did in place. It names no page content; the address is the evidence a link already reports. */
function inPlaceActual(effect: InPlaceEffect): string {
  if (effect.kind === "address") {
    return `the page prevented the navigation and moved its address to ${effect.url} in place, ${effect.afterMs} ms after the press`;
  }
  return `the page prevented the navigation and changed its content in place, ${effect.afterMs} ms after the press`;
}

/** The in-place window, shortened by the command's own timeout when it names a shorter one. */
function inPlaceWindowMs(action: BrowserActionCommand): number {
  return windowWithin(action, IN_PLACE_WINDOW_MS);
}

/** The rate-limit window, shortened the same way. */
function rateLimitWindowMs(action: BrowserActionCommand): number {
  return windowWithin(action, RATE_LIMIT_WINDOW_MS);
}

function windowWithin(action: BrowserActionCommand, windowMs: number): number {
  // The timeout before any check allowance: that room is the check wait's alone.
  const timeoutMs = webAutomationBaseTimeoutMs(action);
  if (timeoutMs === undefined) return windowMs;
  return Math.min(Math.floor(timeoutMs), windowMs);
}

/**
 * Everything else is held to the hit test: the click reached the target at a
 * point that belongs to it. A page cancelling the default action is recorded
 * but is not a failure -- handling a click in script and preventing the default
 * is ordinary, and what the click then did is the next action's business.
 */
function hitTestValidation(detail: string, accepted: boolean, cleared?: RobotCheckSighting, pressedOnceMore?: string): BrowserActionValidation {
  const again = pressedOnceMore ? `; ${pressedOnceMore}` : "";
  const prevented = accepted ? "" : "; the page prevented the click's default action";
  const waited = cleared
    ? `; ${cleared.afterMs} ms after the press the page put up a robot check that cleared by itself ${cleared.waitedMs} ms later, untouched`
    : "";
  return {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: `${detail}${again}${prevented}${waited}`
  };
}

/** The controls a press is made to have answered: a button, a submit, button or image input, or anything that says it is a button. */
const COMMAND_CONTROL = 'button, input[type="submit"], input[type="button"], input[type="image"], [role="button"]';

/**
 * Whether the page was expected to answer a press on `element` at all: a
 * command control (`COMMAND_CONTROL`, the element or the one it sits in) that
 * is not already the current or the selected one. A text box, a line of text or
 * a selected tab is pressed for no change, and its silence is no failure.
 */
function expectsAnswer(element: Element): boolean {
  const control = element.closest?.(COMMAND_CONTROL);
  if (!control) return false;
  const current = control.getAttribute?.("aria-current");
  if (current !== null && current !== undefined && current !== "false") return false;
  return control.getAttribute?.("aria-selected") !== "true";
}

/**
 * A press that certainly did nothing (`SETTLED_UNCHANGED`). Failed, which with
 * its code is `web.action.no_effect`: the act did not happen and is marked
 * `certainNoEffect`, so Core makes it once more, and only once.
 */
function settledUnchangedValidation(detail: string, accepted: boolean): BrowserActionValidation {
  const prevented = accepted ? "" : "; the page prevented the click's default action";
  return { status: "failed", expected: "the page answers the press", actual: `${detail}; ${SETTLED_UNCHANGED}${prevented}` };
}

/**
 * A press the page answered with nothing but its own notice (`NOTICE_ONLY`,
 * t743). Failed, which with its code is `web.action.page_reported_failure`:
 * the act did not happen and is marked `certainNoEffect`, so Core makes it
 * again under its ordinary retries.
 */
function noticeOnlyValidation(detail: string, accepted: boolean): BrowserActionValidation {
  const prevented = accepted ? "" : "; the page prevented the click's default action";
  return { status: "failed", expected: "the page carries the press out", actual: `${detail}; ${NOTICE_ONLY}${prevented}` };
}

/**
 * A press the page ignored, and ignored again when it was made once more: the
 * click landed both times and nothing whatever answered it, so the act is not
 * observed. Only on a command control (`expectsAnswer`). Failed, which the result builder reports as `output_not_observed`
 * (retryable), not as a success the next step would build on.
 */
function ignoredTwiceValidation(detail: string, accepted: boolean, ignored = IGNORED_TWICE): BrowserActionValidation {
  const prevented = accepted ? "" : "; the page prevented the click's default action";
  return {
    status: "failed",
    expected: "the page answers the press",
    actual: `${detail}; ${ignored}: no request, no change inside the control or its section, no navigation and no focus move${prevented}`
  };
}

/**
 * How long a robot check a press puts up may be followed while it says it is
 * clearing by itself: ROBOT_CHECK_WAIT_MS, held within what is left of the
 * command's own timeout less a margin for the reply, so the wait never
 * outlives the command.
 */
function robotCheckWaitMs(action: BrowserActionCommand, startedAt: number): number {
  const timeoutMs = action.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return ROBOT_CHECK_WAIT_MS;
  return Math.max(0, Math.min(ROBOT_CHECK_WAIT_MS, timeoutMs - (Date.now() - startedAt) - ROBOT_CHECK_REPLY_MARGIN_MS));
}

/** The target already showed the requested state: success without a press, saying so in `skipped`. */
function alreadyInState(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number, evidence: ActionResultEvidence): BrowserActionResult {
  const shown = "the control already shows the requested state";
  const result = deps.success(action, startedAt, "Control already in the requested state; nothing pressed.", { status: "passed", expected: shown, actual: shown }, evidence);
  return { ...result, skipped: "already_in_state" };
}
