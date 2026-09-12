// The scroll verb: move the page, then report what actually moved.
//
// Three modes (`WebAutomationScrollRequest` in domain/src/actions/types.ts):
// `by` a delta, `toElement` to bring the resolved target into view, and
// `untilStable` to keep scrolling while the document is still growing -- a
// lazy-loading feed -- up to `maxScrolls`, the guard that stops an infinite
// feed scrolling forever. A command with no `scroll` request is the legacy
// absolute move to `options.x`/`options.y`, unchanged.
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
// The verb never rejects. `actions/execute.ts` returns its promise rather than
// awaiting it, so a rejection would settle after that file's try block has
// exited and escape its catch; this verb catches its own throws and reports
// them through `deps.failure`, exactly as that catch would.

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

export async function scrollAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  try {
    const request = action.scroll;
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
  const element = deps.resolveTarget(action);
  deps.scrollElementIntoView(element);
  const rect = element.getBoundingClientRect();
  const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  return deps.success(action, startedAt, "Scrolled the target into view.", {
    status: inView ? "passed" : "failed",
    expected: "the target within the viewport",
    actual: `the target is at ${Math.round(rect.left)},${Math.round(rect.top)} in a ${window.innerWidth}x${window.innerHeight} viewport`
  }, { element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
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
