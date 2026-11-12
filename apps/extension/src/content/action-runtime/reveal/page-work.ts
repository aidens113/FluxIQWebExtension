// Whether the page shows it is still working toward a target it has not shown yet (t903).
//
// A Flow's replay arrives faster than exploration did. On company-website's team page
// (`replay-first-press-failure.md`, E1's trace) the replay pressed "Show more people" about
// 0.7 s after the page loaded, while the page was still loading its three batches of people
// behind skeleton cards, waiting out a 429 with its own status line, and keeping the button
// `hidden` until the last batch landed, about 4.4 s in. The retry loop waited on the ladder
// meant for a dismissed dialog to finish leaving (about 1.35 s) and gave the refusal up, so
// Core retried the step.
//
// A person waits while the page shows it is working, and stops when it stops. So the wait for
// a target refused as not shown follows what the page shows, read the way the snapshot reads
// it (`../../evidence/loading.ts`) and a list read reads its tail (`../../extraction/page-advance/
// list-loading.ts`), and nothing else:
//
// - the page's own loading evidence: a document still loading, an `aria-busy` region, a
//   progress bar, a painted spinner, a status region saying it is loading;
// - placeholders beside the target: painted `aria-hidden="true"` elements with no words and no
//   picture, in the region that holds the target -- skeleton cards waiting for the rows they
//   stand in for;
// - a status or live region whose words changed since the last look;
// - a request the page began since the last look, or one it began during the wait and has not
//   had answered (`../ignored-press/request-start-mark.ts`, the page world's account).
//
// None of it is a fixed time. The wait looks again every `LOOK_MS`, a sampling period, and ends
// when the target shows or when a look finds the page showing no work. Its only other bound is
// the command's own budget, which Core gave the node.

import { loadingEvidence } from "../../evidence";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { markRequestStarts, type RequestStartMark } from "../ignored-press";
import type { BrowserActionResult } from "../../types";
import { unshownTargetOf } from "./unshown-target";

/** How often the page is looked at while it works. A sampling period, never a bound on the wait. */
export const PAGE_WORK_LOOK_MS = 100;

/** Status and live regions, whose changing words are the page telling a reader what it is doing. */
const LIVE_REGIONS = "[role='status'],[role='alert'],[aria-live='polite'],[aria-live='assertive']";

/** What carries a picture, which a placeholder does not. */
const PICTURES = "img,svg,canvas,video,picture";

/** A watch over the page's work toward one target it has not shown. */
export type PageWork = {
  /** Whether the target is shown now. */
  shown(): boolean;
  /** Whether, at this look, the page shows it is working (see the header). Each call is a look. */
  working(): boolean;
};

/** A watch over the work toward the target `result` refused as not shown; `undefined` when it refused no noted target. */
export function watchUnshownTargetWork(result: BrowserActionResult): PageWork | undefined {
  const target = unshownTargetOf(result);
  return target === undefined ? undefined : watchPageWork(target);
}

/** Begins watching the page's work toward `target`, from now. */
export function watchPageWork(target: Element): PageWork {
  const doc = target.ownerDocument;
  const root = doc.documentElement;
  // Two marks in the page world: one held from the start of the wait, for a request begun during
  // it and still out; one renewed at every look, for a request begun since the last look.
  const held = root === null ? undefined : markRequestStarts(root);
  const looked = (): RequestStartMark | undefined => (doc.body === null ? undefined : markRequestStarts(doc.body));
  let sinceLook = looked();
  let regions = liveRegionWords(doc);
  return {
    shown: () => isShown(target),
    working: () => {
      const begun = sinceLook?.begunSince() === true;
      const pending = held?.pendingSince?.() === true;
      const words = liveRegionWords(doc);
      const changed = words !== regions;
      regions = words;
      sinceLook = looked();
      return begun || pending || changed || loadingEvidence().busy || placeholdersBeside(target);
    }
  };
}

/** Whether the element is connected and rendered, by the browser's own measure. */
function isShown(element: Element): boolean {
  if (!element.isConnected) return false;
  const check = (element as Element & { checkVisibility?: (options?: Record<string, boolean>) => boolean }).checkVisibility;
  return typeof check === "function" ? check.call(element, { checkVisibilityCSS: true, visibilityProperty: true }) : element.getClientRects().length > 0;
}

/** Whether the element draws a box with room in it: a placeholder stands in for content, so it takes up space. */
function hasArea(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/** The words of every status and live region, as one string to compare look to look. */
function liveRegionWords(doc: Document): string {
  return Array.from(doc.querySelectorAll(LIVE_REGIONS)).map((region) => textOutsideSensitiveControls(region)).join("\u001f");
}

/** Whether the region holding `target` shows a painted placeholder: hidden from readers, with no words and no picture. */
function placeholdersBeside(target: Element): boolean {
  const region = target.parentElement;
  if (region === null) return false;
  for (const element of Array.from(region.querySelectorAll('[aria-hidden="true"]'))) {
    if (element.contains(target) || /\S/u.test(element.textContent ?? "")) continue;
    if (element.matches(PICTURES) || element.querySelector(PICTURES) !== null) continue;
    if (isShown(element) && hasArea(element)) return true;
  }
  return false;
}
