// The scroll verb: move the page, then report what actually moved.
//
// Three modes (`WebAutomationScrollRequest` in domain/src/actions/types.ts):
// `by` a delta, `toElement` to bring the resolved target into view, and
// `untilStable` to keep scrolling while the document is still growing -- a
// lazy-loading feed -- up to `maxScrolls`, the guard that stops an infinite
// feed scrolling forever. A command with no `scroll` request is the legacy
// absolute move, unchanged: to `options.x`/`options.y`, or to the command's
// `coordinates` when the options carry none, and to where the page already is
// for an axis neither names.
//
// A command that *sent* a scroll request the domain could not read -- no mode,
// a mode it does not know, `untilStable` without its `maxScrolls` -- is refused
// as INVALID_PARAMETER and moves nothing, and the refusal names each key that
// made it unreadable (`webAutomationScrollRequestIssues`): "maxScrolls is
// missing; untilStable needs it", not the keys it carried (social r4,
// `run-mvfq957o-40103539`, was refused "it names mode"). Submit refuses the same
// `untilStable` through the scroll node's parameter contract, so this is the
// refusal of a request that reached the page some other way. The domain leaves such a request off
// `action.scroll` and keeps it in `options.scroll` (`gateway-action-parameters.ts`),
// and until lane 3 this verb took the absent request for the legacy move: Core
// writes the node's `x: 0`/`y: 0` defaults on every scroll step, so
// `scroll: {"until": "stopsGrowing"}` jumped the page to its top on every pass
// of a 40-pass loop (`run-mvcvzwk1-c1d869e4`). A request is either one this
// verb runs or no move at all.
//
// Every mode states a post-condition instead of assuming the page obeyed: the
// position actually reached, clamped to what the document allows so a scroll
// past the end is not a failure; whether the target ended up inside the
// viewport; or whether the document stopped growing, and after how many
// scrolls. Reaching `maxScrolls` while it is still growing is a *failed*
// validation, not a success: the scroll was capped before the content it was
// meant to load had arrived, which is `output_not_observed`. A run that wants
// a bounded amount of scrolling asks for `by`, which has no such expectation.
//
// `toElement` reads the actionability gate after it has moved the page, and
// reports what the gate saw beside the position it reached -- but it never
// refuses on it. Scrolling is how a covered control is brought out from under
// a sticky header in the first place, and nothing standing over the target
// stops the page from arriving there, so a refusal would take away the move
// that recovery makes. What the gate is good for here is evidence: a scroll
// that reports "the point landed on div.scrim, which covers the target" tells
// the next step, and whoever reads the run, why the click after it was
// refused. The gate is read *after* `scrollElementIntoView`, because it
// returns early without scrolling for a hidden or disabled target, and such a
// target was scrolled to before.
//
// The verb never rejects: every throw is caught here and reported through
// `deps.failure`. That is belt and braces, not the last line of defence --
// `actions/execute.ts` awaits every branch, so its catch would report the same
// rejection if this one were removed. It is kept because it costs nothing and
// keeps the failure local: a throw from `deps.resolveTarget` or from the DOM
// calls below is reported as this verb failing, at this verb's `startedAt`,
// independently of how the dispatcher calls it. (Until 2026-09-11 the
// dispatcher returned this promise unawaited, and the catch was load-bearing.)

import {
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationFailureRecord,
  webAutomationScrollRequestIssues,
  type WebAutomationFailureCarrier,
  type WebAutomationScrollRequestIssue,
  type WebAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import type { ActionabilityReport } from "../action-runtime";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionValidation,
  WebAutomationScrollRequest
} from "../types";
import type { ContentActionDependencies } from "./types";

type Point = { x: number; y: number };

/** A delta scroll: the only shape left once `toElement` and `untilStable` have been dispatched. */
type ScrollByRequest = Extract<WebAutomationScrollRequest, { mode: "by" }>;
type ScrollUntilStableRequest = Extract<WebAutomationScrollRequest, { mode: "untilStable" }>;

/** How long the document is given to grow after an `untilStable` scroll before it counts as settled. */
const GROWTH_WINDOW_MS = 900;
const GROWTH_POLL_MS = 50;
/** How long a `smooth` scroll is given to arrive: unlike an instant one, its position is not reached synchronously. */
const SMOOTH_SETTLE_MS = 1_000;
/** Subpixel layout and rounding differences in a scroll position are not a failed post-condition. */
const POSITION_TOLERANCE_PX = 2;

/** The scroll request forms this verb runs, as a refusal names them. */
const SCROLL_REQUEST_FORMS = "a scroll request with mode by (x, y), toElement, or untilStable (maxScrolls, y)";
/** A key a refusal may name: identifier characters only, never a value. */
const KEY_NAME = /^[A-Za-z0-9_.-]{1,64}$/u;

/** A scroll request was sent and is not one the verb runs: INVALID_PARAMETER, nothing moved (header). */
class UnreadableScrollRequest extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;

  constructor(sent: unknown) {
    const reasons = webAutomationScrollRequestIssues(sent).map(issueText);
    const actual = `scroll: not a request this verb runs${reasons.length ? ` (${reasons.join("; ")})` : ""}; the page was not moved`;
    super(`The scroll request is not one this verb runs: ${SCROLL_REQUEST_FORMS}.`);
    this.name = "UnreadableScrollRequest";
    this.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, { expected: SCROLL_REQUEST_FORMS, actual });
  }
}

/** One key's reason, quoting the key only when it is an identifier and never a value. */
function issueText(issue: WebAutomationScrollRequestIssue): string {
  if (issue.key === "maxScrolls") {
    return issue.problem === "missing" ? "maxScrolls is missing; untilStable needs it" : "maxScrolls must be a positive whole number";
  }
  if (issue.key === "mode") return issue.problem === "missing" ? "mode is missing" : "mode is not by, toElement or untilStable";
  if (issue.key === "scroll") return "the request is not an object";
  const key = KEY_NAME.test(issue.key) ? issue.key : "a key";
  return issue.problem === "unknown" ? `${key} is not a key a scroll request has` : `${key} cannot be read`;
}

export async function scrollAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  try {
    const request = action.scroll;
    // Sent, but not read as a request (header): refused before anything moves.
    const sent = action.options?.scroll;
    if (request === undefined && sent !== undefined && sent !== null) return deps.failure(action, new UnreadableScrollRequest(sent), startedAt);
    if (request?.mode === "toElement") return scrollToElement(action, deps, startedAt);
    if (request?.mode === "untilStable") return await scrollUntilStable(action, request, deps, startedAt);
    return await scrollToPosition(action, requestedPosition(action, request), deps, startedAt);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}

/** `by` a delta, or the legacy absolute move when the command carries no scroll request. */
function requestedPosition(action: BrowserActionCommand, request: ScrollByRequest | undefined): Point {
  const from = currentPosition();
  if (request) return clampToDocument({ x: from.x + finiteNumber(request.x, 0), y: from.y + finiteNumber(request.y, 0) });
  return clampToDocument({
    x: finiteNumber(action.options?.x ?? action.coordinates?.x, from.x),
    y: finiteNumber(action.options?.y ?? action.coordinates?.y, from.y)
  });
}

async function scrollToPosition(
  action: BrowserActionCommand,
  target: Point,
  deps: ContentActionDependencies,
  startedAt: number
): Promise<BrowserActionResult> {
  const from = currentPosition();
  const smooth = action.options?.smooth === true;
  window.scrollTo({ left: target.x, top: target.y, behavior: smooth ? "smooth" : "instant" });
  if (smooth) await settleAt(target);
  return deps.success(action, startedAt, "Page scrolled.", positionValidation(target, currentPosition(), from), {
    snapshot: deps.captureSnapshot()
  });
}

function scrollToElement(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const { element, resolution } = deps.resolveTarget(action);
  deps.scrollElementIntoView(element);
  const reachable = deps.checkActionability(element);
  const rect = element.getBoundingClientRect();
  const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  return deps.success(action, startedAt, "Scrolled the target into view.", {
    status: inView ? "passed" : "failed",
    expected: "the target within the viewport",
    actual: `the target is at ${Math.round(rect.left)},${Math.round(rect.top)} in a ${window.innerWidth}x${window.innerHeight} viewport; ${reachableDetail(reachable)}`
  }, { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
}

/** What the gate saw, named as a refusal would name it, so a covered target reads the same wherever it is reported. */
function reachableDetail(report: ActionabilityReport): string {
  return report.actionable ? report.detail : `${report.code}: ${report.detail}`;
}

/**
 * Scrolls down repeatedly while the document keeps growing. Without a `y`
 * step each pass goes to the current bottom, which is what a lazy-loading
 * feed's sentinel needs to see; with one, each pass moves that far. The page
 * has settled once a pass adds no height and no further scrolling is possible.
 */
async function scrollUntilStable(
  action: BrowserActionCommand,
  request: ScrollUntilStableRequest,
  deps: ContentActionDependencies,
  startedAt: number
): Promise<BrowserActionResult> {
  const cap = Math.max(1, Math.floor(finiteNumber(request.maxScrolls, 1)));
  const step = request.y === undefined ? undefined : finiteNumber(request.y, 0);
  const startHeight = documentHeight();
  let height = startHeight;
  let scrolls = 0;
  let settled = false;

  while (scrolls < cap) {
    const from = currentPosition();
    const bottom = scrollLimits().y;
    window.scrollTo({ left: from.x, top: step === undefined ? bottom : Math.min(from.y + step, bottom), behavior: "instant" });
    scrolls += 1;
    const grown = await waitForGrowth(height);
    if (grown !== undefined) {
      height = grown;
      continue;
    }
    // Nothing new arrived. The page has settled only if this pass could not
    // move either -- otherwise there is more document left to scroll through.
    if (atBottom() || currentPosition().y === from.y) {
      settled = true;
      break;
    }
  }

  return deps.success(
    action,
    startedAt,
    settled ? "Scrolled until the document stopped growing." : `Stopped at the ${cap}-scroll cap while the document was still growing.`,
    {
      status: settled ? "passed" : "failed",
      expected: `the document to stop growing within ${cap} ${scrollWord(cap)}`,
      actual: settled
        ? `the document stopped growing after ${scrolls} ${scrollWord(scrolls)}, at ${height} pixels`
        : `the document was still growing after ${scrolls} ${scrollWord(scrolls)}, from ${startHeight} to ${height} pixels`
    },
    { snapshot: deps.captureSnapshot() }
  );
}

function positionValidation(target: Point, actual: Point, from: Point): BrowserActionValidation {
  const reached = Math.abs(actual.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(actual.y - target.y) <= POSITION_TOLERANCE_PX;
  return {
    status: reached ? "passed" : "failed",
    expected: `scroll position ${target.x},${target.y}`,
    actual: `scroll position ${actual.x},${actual.y}, moved from ${from.x},${from.y}`
  };
}

/** The new document height once it has grown, or `undefined` if it never did within the window. */
async function waitForGrowth(previousHeight: number): Promise<number | undefined> {
  const deadline = Date.now() + GROWTH_WINDOW_MS;
  do {
    await delay(GROWTH_POLL_MS);
    const height = documentHeight();
    if (height > previousHeight) return height;
  } while (Date.now() < deadline);
  return undefined;
}

/** Waits for a smooth scroll to arrive, giving up so the validation reports where it stopped instead of hanging. */
async function settleAt(target: Point): Promise<void> {
  const deadline = Date.now() + SMOOTH_SETTLE_MS;
  do {
    const position = currentPosition();
    if (Math.abs(position.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(position.y - target.y) <= POSITION_TOLERANCE_PX) return;
    await delay(GROWTH_POLL_MS);
  } while (Date.now() < deadline);
}

function currentPosition(): Point {
  return { x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
}

function documentHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
}

/** The furthest the window can be scrolled, which is where a request past the end lands. */
function scrollLimits(): Point {
  const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
  return { x: Math.max(0, Math.round(width - window.innerWidth)), y: Math.max(0, Math.round(documentHeight() - window.innerHeight)) };
}

/** Whether the window can still be scrolled down, which is what tells a settled page from an unfinished pass. */
function atBottom(): boolean {
  return currentPosition().y >= scrollLimits().y - POSITION_TOLERANCE_PX;
}

function clampToDocument(point: Point): Point {
  const limits = scrollLimits();
  return { x: clamp(Math.round(point.x), limits.x), y: clamp(Math.round(point.y), limits.y) };
}

function clamp(value: number, limit: number): number {
  return Math.min(Math.max(value, 0), limit);
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scrollWord(count: number): string {
  return count === 1 ? "scroll" : "scrolls";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
