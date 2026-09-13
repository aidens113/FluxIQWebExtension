// Chooses the child frame an action goes to when the action names that frame by
// its document's path as well as by id (P6, W28).
//
// A frame id belongs to one tab and is reassigned every time the frame
// navigates, so the id a recording captured names nothing once a Flow has
// reloaded the page. The path of the frame's document survives that reload, so
// it is the address, and the recorded id only breaks a tie. The origin is not
// compared -- it differs per run, since a cross-origin fixture frame is served
// from another loopback port -- and neither is the query, which may carry
// tokens; the domain sends neither.
//
// The frame list is an input rather than something read here, so the choice is
// a pure function of what the browser reported. An empty list means the browser
// would not say, not that the tab has no frames, so the recorded id stands: the
// rule `absentFrameReason` in `action-runner.ts` already follows.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { WorkerActionOutcome } from "./action-results";

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

/** One frame as `webNavigation.getAllFrames` lists it, reduced to what the choice reads. */
export type ListedFrame = { frameId: number; url?: string | undefined };

/** The frame to address (undefined: the top frame only), or the refusal to report instead. */
export type FrameChoice = { frameId: number | undefined } | { refused: WorkerActionOutcome };

/**
 * The frame an action addressed to `urlPath` goes to.
 *
 * - No path: the recorded id, unchanged.
 * - An empty frame list: the recorded id, because the browser would not say.
 * - One child frame at the path: that frame, whatever the recorded id was.
 * - Several: the recorded id when it is one of them, otherwise `TARGET_AMBIGUOUS`.
 * - None: `TARGET_NOT_FOUND`, naming the paths the child frames are at.
 *
 * The top frame is never a candidate. The domain attaches a path only to a node
 * recorded in a child frame, so moving that action into the top document would
 * send it to a frame it was never recorded in.
 */
export function chooseFrame(
  frames: readonly ListedFrame[],
  recordedFrameId: number | undefined,
  urlPath: string | undefined
): FrameChoice {
  if (urlPath === undefined || frames.length === 0) return { frameId: recordedFrameId };
  const children = frames.filter((frame) => frame.frameId !== TOP_FRAME_ID);
  const matches = children.filter((frame) => pathOf(frame.url) === urlPath);
  if (matches.length === 1) return { frameId: matches[0]?.frameId };
  if (matches.length === 0) return { refused: notFound(urlPath, children) };
  if (recordedFrameId !== undefined && matches.some((frame) => frame.frameId === recordedFrameId)) {
    return { frameId: recordedFrameId };
  }
  return { refused: ambiguous(urlPath, matches.length, recordedFrameId) };
}

/** The pathname of an http(s) document; nothing for `about:`, `data:`, `srcdoc` or an unparsable URL. */
function pathOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.pathname : undefined;
  } catch {
    return undefined;
  }
}

/** Paths only, never full URLs: an origin changes per run and a query may carry a token. */
function describeChildren(children: readonly ListedFrame[]): string {
  if (children.length === 0) return "the tab has no child frame";
  const described = children.map((frame) => `frame ${frame.frameId} at ${pathOf(frame.url) ?? "no http(s) path"}`);
  return `the tab has ${described.join(", ")}`;
}

/** Retryable, as the set binds it: a frame the page has not finished creating may still appear. */
function notFound(urlPath: string, children: readonly ListedFrame[]): WorkerActionOutcome {
  const expected = `a child frame at ${urlPath}`;
  const actual = describeChildren(children);
  return {
    status: "failed",
    message: `The action is addressed to the frame at ${urlPath}, which this tab does not have.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
  };
}

/** Several frames share the path and the recorded id breaks no tie, so no frame is guessed at. */
function ambiguous(urlPath: string, count: number, recordedFrameId: number | undefined): WorkerActionOutcome {
  const expected = `one child frame at ${urlPath}`;
  const tieBreak = recordedFrameId === undefined ? "" : `, and none is frame ${recordedFrameId}`;
  const actual = `${count} child frames are at ${urlPath}${tieBreak}`;
  return {
    status: "failed",
    message: `The action is addressed to the frame at ${urlPath}, and ${count} frames in this tab are at that path.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, { expected, actual })
  };
}
