// The "Right now" card's words for each status, from the table in the UI
// audit, section 4 ("2. 'Right now' card"). Pure, so every row is tested
// without a DOM; `now` is passed in so the one-minute "Done" window and the
// recording clock are too.
//
// Which row wins when several hold: a recording refusal first (the person has
// to dismiss it), then recording, a paused recording, a running step, a failed step, a step that
// finished under a minute ago, "Connect first", and otherwise nothing running.

import type { ExtensionStatus } from "../../shared/protocol";
import { pageHostname, stepSentence } from "../copy";

/** How long a finished step keeps saying "Done". */
export const DONE_WINDOW_MS = 60_000;

/** The raw refusal the background records when recording is asked for while not connected. */
const CONNECT_FIRST = "Connect to FluxIQ before recording.";

/** Which row of the table applies. */
export type NowKind = "block" | "recording" | "paused" | "running" | "failed" | "done" | "connectFirst" | "idle";

/** The card's words for one status. */
export type NowCopy = {
  kind: NowKind;
  title: string;
  detail: string;
  /** The red recording dot beside the title. */
  recordingDot: boolean;
  /** A "Details" link that opens Advanced on the Activity tab. */
  details: boolean;
};

/** The now card's words for `status` at time `now` (milliseconds since the epoch). */
export function nowCopy(status: ExtensionStatus, now: number): NowCopy {
  const plain = (kind: NowKind, title: string, detail: string): NowCopy => ({ kind, title, detail, recordingDot: false, details: false });
  const block = status.recordingBlock;
  if (block) return plain("block", block.title, block.message);
  if (status.recordingState === "recording") {
    return { kind: "recording", title: "Recording your steps", detail: recordingDetail(status, now), recordingDot: true, details: false };
  }
  // SEAM(t180): pause/resume. The state is in the protocol already; the Pause and
  // Resume controls, and the messages behind them, are lane t180's. Until they
  // land this row only names the state, and the card still offers Stop recording.
  if (status.recordingState === "paused") {
    return plain("paused", "Recording paused", recordingDetail(status, now));
  }
  const runtime = status.runtime;
  if (runtime?.state === "running") return plain("running", "FluxIQ is working", stepSentence(runtime, "present"));
  if (runtime?.state === "failed") {
    return { kind: "failed", title: "A step didn't work", detail: `${stepSentence(runtime, "past")} didn't work.`, recordingDot: false, details: true };
  }
  if (runtime?.state === "succeeded" && runtime.finishedAt !== undefined && now - runtime.finishedAt < DONE_WINDOW_MS) {
    return plain("done", "Done", `Last step: ${stepSentence(runtime, "past")}`);
  }
  if (status.lastError === CONNECT_FIRST && status.connectionState !== "connected") {
    return plain("connectFirst", "Connect first", CONNECT_FIRST);
  }
  return plain("idle", "Nothing running", "Ask FluxIQ below, or record the steps yourself.");
}

/** "mm:ss · N steps on hostname". */
function recordingDetail(status: ExtensionStatus, now: number): string {
  const seconds = status.recordingStartedAt === undefined ? 0 : Math.max(0, Math.floor((now - status.recordingStartedAt) / 1_000));
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const steps = status.eventCount === 1 ? "1 step" : `${status.eventCount} steps`;
  const hostname = pageHostname(status.activeTabUrl);
  return hostname === undefined ? `${clock} · ${steps}` : `${clock} · ${steps} on ${hostname}`;
}
