import type { OverlaySampleWindow, UiReviewCapture } from "./types.js";

/** When a capture ran, in epoch milliseconds: from its first call to its last. */
export type CaptureSpan = { from: number; to: number };

/**
 * Puts a picture on the overlay window's clock, so a reviewer can tell a
 * picture taken before the overlay appeared from an overlay that was there
 * and did not paint (run murzln6g moment 2: its picture showed no overlay
 * while seven of its sixteen samples said present).
 *
 * `windowMs` is the capture's span in milliseconds from the window's
 * `startedAt`, negative when the capture began before the first read. A
 * sample's `atMs` is when its read began, so `lastBefore` is the last sample
 * begun at or before the capture began and `firstAfter` the first begun at or
 * after it ended; the picture was taken between those two reads.
 */
export function placeCaptureInWindow(span: CaptureSpan, window: Pick<OverlaySampleWindow, "startedAt" | "samples">): Pick<UiReviewCapture, "takenAt" | "windowMs" | "overlaySamples"> {
  const takenAt = new Date(span.from).toISOString();
  const windowStart = Date.parse(window.startedAt);
  if (!Number.isFinite(windowStart)) return { takenAt };
  const from = span.from - windowStart, to = span.to - windowStart;
  let lastBefore: number | undefined, firstAfter: number | undefined;
  for (const [index, sample] of window.samples.entries()) {
    if (sample.atMs <= from) lastBefore = index;
    if (firstAfter === undefined && sample.atMs >= to) firstAfter = index;
  }
  const overlaySamples = { ...(lastBefore === undefined ? {} : { lastBefore }), ...(firstAfter === undefined ? {} : { firstAfter }) };
  return { takenAt, windowMs: { from, to }, ...(window.samples.length === 0 ? {} : { overlaySamples }) };
}
