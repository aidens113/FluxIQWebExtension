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
//
// A frame named by its path is also waited for (`waitForFrameChoice`). A Flow's
// dry run and its playback open the page afresh -- on apply-quillmark a click
// opens a new tab, which then loads the careers page and only then its
// application frame -- and a step addressed to the frame arrived before it
// existed and was refused at once (t195 C1). Nothing else waits for it: the
// refusal is made here in the background worker, so the content script's own
// recovery never sees it, and Core's retry ladder is shorter than the load. So
// while no listed child frame is at the path, the frames are listed again every
// `FRAME_POLL_INTERVAL_MS` for up to `FRAME_APPEAR_WAIT_MS`, within the command's
// own timeout, and only then refused, in the same words. The listing, the clock
// and the sleep are inputs, so the wait is as testable as the choice.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { WorkerActionOutcome } from "./action-results";

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

/** The longest an action waits for a child frame at its path to appear before it is refused. */
export const FRAME_APPEAR_WAIT_MS = 5_000;

/** How often the tab's frames are listed again while the frame at the path has not appeared. */
const FRAME_POLL_INTERVAL_MS = 100;

/** Kept back from the command's own timeout so the refusal still reaches Core in time, as `landed-check-wait.ts` keeps it. */
const REPLY_MARGIN_MS = 1_000;

/** What waiting for a frame reads and does: the tab's frames as the browser lists them now, the clock, and a pause. */
export type FrameWaitInputs = {
  listFrames(): Promise<readonly ListedFrame[]>;
  now(): number;
  sleep(ms: number): Promise<void>;
};

/** The action's frame address, and the command budget the wait must fit inside. */
export type FrameWaitRequest = {
  recordedFrameId: number | undefined;
  urlPath: string | undefined;
  /** The command's own timeout; absent or not a positive number, the wait is `FRAME_APPEAR_WAIT_MS`. */
  timeoutMs: number | undefined;
  /** When the action started, on the same clock as `now`. */
  startedAt: number;
};

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

/**
 * `chooseFrame`, waiting while the path names no listed child frame.
 *
 * No path: the recorded id at once, and nothing is listed. Otherwise the frames
 * are listed and chosen from; a choice that found the frame, that found several,
 * or that the browser would not list for, is final. Only a path no child frame
 * is at is listed again, every `FRAME_POLL_INTERVAL_MS`, until the frame
 * appears or `FRAME_APPEAR_WAIT_MS` -- less when the command's own timeout,
 * less the reply margin, leaves less -- has passed; then that refusal stands.
 */
export async function waitForFrameChoice(inputs: FrameWaitInputs, request: FrameWaitRequest): Promise<FrameChoice> {
  const { recordedFrameId, urlPath } = request;
  if (urlPath === undefined) return { frameId: recordedFrameId };
  const deadline = inputs.now() + frameAppearBudgetMs(request, inputs.now());
  for (;;) {
    const choice = chooseFrame(await inputs.listFrames(), recordedFrameId, urlPath);
    if (!("refused" in choice) || choice.refused.failure?.code !== WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND) return choice;
    const left = deadline - inputs.now();
    if (left <= 0) return choice;
    await inputs.sleep(Math.min(FRAME_POLL_INTERVAL_MS, left));
  }
}

/** `FRAME_APPEAR_WAIT_MS`, or what the command's timeout still leaves once the reply margin is kept back. */
function frameAppearBudgetMs(request: FrameWaitRequest, now: number): number {
  const { timeoutMs } = request;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return FRAME_APPEAR_WAIT_MS;
  return Math.max(0, Math.min(FRAME_APPEAR_WAIT_MS, timeoutMs - (now - request.startedAt) - REPLY_MARGIN_MS));
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
