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

import { dispatchClickGesture } from "../action-runtime";
import type { ActionResultEvidence, InPlaceEffect, InPlaceEffectWatch, RateLimitWatch } from "../action-runtime";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
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

export async function clickAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const { element, resolution } = deps.resolveTarget(action);
  const evidence = (): ActionResultEvidence => ({
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot(),
    resolution
  });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be clicked", report.detail, { ...evidence(), blockedAt: report.point });
  }

  const link = navigatingLink(element);
  if (!link) {
    // Started at the press, like the link's in-place watch, so a layer already
    // over the page is never taken for this press's answer.
    // Assigned inside the gesture's callback, which control flow cannot see.
    let notice = undefined as RateLimitWatch | undefined;
    try {
      const accepted = dispatchClickGesture(element, report.point, () => {
        notice = deps.watchRateLimitNotice(element);
      });
      const refused = notice ? await notice.settle(rateLimitWindowMs(action)) : undefined;
      if (refused) return deps.rateLimited(action, startedAt, refused, evidence());
      return deps.success(action, startedAt, "Element clicked.", hitTestValidation(report.detail, accepted), evidence());
    } finally {
      notice?.stop();
    }
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
  const timeoutMs = action.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return windowMs;
  return Math.min(Math.floor(timeoutMs), windowMs);
}

/**
 * Everything else is held to the hit test: the click reached the target at a
 * point that belongs to it. A page cancelling the default action is recorded
 * but is not a failure -- handling a click in script and preventing the default
 * is ordinary, and what the click then did is the next action's business.
 */
function hitTestValidation(detail: string, accepted: boolean): BrowserActionValidation {
  return {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: accepted ? detail : `${detail}; the page prevented the click's default action`
  };
}
