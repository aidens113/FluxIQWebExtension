// The expected state a recorded click claims: the path it landed on.
//
// The recorder sends a click's landing as a non-executable `web.page.navigated`
// with `metadata.transition: "explained"`. It names the click two ways: by the
// recording event id the click was itself sent under (`explainedByEventId`), and
// by the click's sequence (`explainedBy`). Core hands a recording mapper the
// entries that follow each observation, so the click's own mapper call can find
// its landing there and propose it as the state the click must leave. A replayed
// click that lands anywhere else then fails, rather than passing because it did
// not throw.
//
// The claim is a path and nothing else: no query, hash, selector, element text
// or typed value. The URL check is a substring test, so a path still holds when a
// run serves the same pages from another origin.

import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EVENTS, createWebAutomationRecordingEvent } from "../../client";

/** A recorded event as the mapper reads it: nested event type and payload already unwrapped, metadata merged. */
type RecordedStep = { eventType: string; timestamp: number; payload: JsonObject; metadata: JsonObject };

/** The same window the assert verb waits by default, and the recorder's own explanation window. */
const LANDING_WAIT_MS = 5_000;

const EXPLAINED_TRANSITION = "explained";

/**
 * The URL claim for a recorded click, or `undefined` when it has none to make.
 *
 * The landing is the **last** explained navigation in `following` that names
 * this click, because a client redirect inside the recorder's window can commit
 * twice and the page settles on the second. A landing names the click when its
 * `explainedByEventId` equals the click's own event id, rebuilt by the domain's
 * recording event builder from the click's sequence and timestamp. A landing
 * with no event id names the nearest preceding click in the same tab whose
 * sequence equals its `explainedBy`; the sequence alone is not unique, because
 * the content script restarts it in every document.
 *
 * Nothing is claimed when no landing names the click, or when the landing's path
 * is the click page's own path or `/`, since such a claim would prove nothing,
 * or when either URL cannot be read as a path.
 */
export function webAutomationClickLandingExpectation(click: RecordedStep, following: readonly RecordedStep[]): JsonObject | undefined {
  const clickPath = urlPath(click.payload.url);
  if (clickPath === undefined) return undefined;
  const clickEventId = recordedClickEventId(click);
  let landing: RecordedStep | undefined;
  for (const [index, step] of following.entries()) {
    if (isExplainedLanding(step) && namesClick(step, click, clickEventId, following.slice(0, index))) landing = step;
  }
  const landingPath = landing === undefined ? undefined : urlPath(landing.payload.url);
  if (landingPath === undefined || landingPath === "/" || landingPath === clickPath) return undefined;
  return { conditions: [{ assert: { kind: "url", expected: landingPath } }], mode: "all", timeoutMs: LANDING_WAIT_MS };
}

function isExplainedLanding(step: RecordedStep): boolean {
  return step.eventType === WEB_AUTOMATION_EVENTS.pageNavigated && step.metadata.transition === EXPLAINED_TRANSITION;
}

function namesClick(landing: RecordedStep, click: RecordedStep, clickEventId: string | undefined, stepsBefore: readonly RecordedStep[]): boolean {
  const explainedByEventId = landing.metadata.explainedByEventId;
  if (typeof explainedByEventId === "string") return clickEventId !== undefined && explainedByEventId === clickEventId;
  const sequence = landing.metadata.explainedBy;
  const tab = tabOf(landing.metadata.sourceId);
  if (typeof sequence !== "number" || tab === undefined) return false;
  const isNamedClick = (step: RecordedStep) => step.eventType === WEB_AUTOMATION_EVENTS.elementClicked && step.payload.sequence === sequence && tabOf(step.metadata.sourceId) === tab;
  return isNamedClick(click) && !stepsBefore.some(isNamedClick);
}

/**
 * The event id the click was sent under, from the one builder that makes it, so
 * the id's spelling lives in `client/gateway-mapping.ts` alone. Core keeps the
 * click's sequence in its payload and the event's timestamp as the entry's own.
 */
function recordedClickEventId(click: RecordedStep): string | undefined {
  const sequence = click.payload.sequence;
  if (typeof sequence !== "number") return undefined;
  return createWebAutomationRecordingEvent({ kind: "dom.click", sequence, url: "", title: "", eventTimestampMs: click.timestamp }).eventId;
}

/**
 * The tab a source id names. A click is sourced from its frame
 * (`tab:7:frame:0`) and its landing from the tab (`tab:7`), so the two compare by
 * tab. An absent source id names no tab, and so names no click.
 */
function tabOf(sourceId: unknown): string | undefined {
  if (typeof sourceId !== "string") return undefined;
  return /^tab:\d+(?=$|:)/u.exec(sourceId)?.[0];
}

/** A URL's path, or `undefined` when the value is not a URL with a hierarchical path. */
function urlPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const pathname = new URL(value).pathname;
    return pathname.startsWith("/") ? pathname : undefined;
  } catch {
    return undefined;
  }
}
