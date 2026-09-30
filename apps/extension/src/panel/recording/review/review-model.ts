// The review that follows a recording (plan 3.3: "clear analysis state",
// "automation preview", "test generated automation", "save"), as a pure
// reducer so every path is tested without a DOM.
//
//   offer -> analyzing (analyzing, then building) -> preview -> testing
//         -> tested (passed | failed) -> saving -> saved
//
// plus `unavailable`, when this extension does not handle a step's message
// (`unsupported`) and the person finishes in FluxIQ instead, and `failed`,
// which keeps the preview when there is one so the person can still test or
// save it.
//
// The review appears when a recording ends while connected -- the status goes
// from recording (or paused) to idle -- and stays until "Done" or a new
// recording starts. A reply that arrives after the review moved on (dismissed,
// or a new recording) is ignored: a result applies only in the phase that
// asked for it. The first status only sets the baseline, so opening the panel
// after a recording never offers to generate from it.

import type { ExtensionStatus } from "../../../shared/protocol";
import type { PanelResult } from "../../state";
import { generatedPreview, type GeneratedPreview } from "./generated-preview";
import { testOutcome, type TestOutcome } from "./test-outcome";

/** Where the review is. */
export type ReviewPhase =
  | { readonly name: "hidden" }
  | { readonly name: "offer" }
  | { readonly name: "analyzing"; readonly stage: "analyzing" | "building" }
  | { readonly name: "preview"; readonly preview: GeneratedPreview }
  | { readonly name: "testing"; readonly preview: GeneratedPreview }
  | { readonly name: "tested"; readonly preview: GeneratedPreview; readonly outcome: TestOutcome }
  | { readonly name: "saving"; readonly preview: GeneratedPreview; readonly outcome?: TestOutcome | undefined }
  | { readonly name: "saved" }
  | { readonly name: "unavailable" }
  | { readonly name: "failed"; readonly sentence: string; readonly detail?: string | undefined; readonly preview?: GeneratedPreview | undefined };

/** The review, and whether the last status was a recording (undefined before the first status). */
export type ReviewModel = { readonly phase: ReviewPhase; readonly recording: boolean | undefined };

/** Something that happened to the review. */
export type ReviewEvent =
  | { type: "status"; status: ExtensionStatus }
  | { type: "dismiss" }
  | { type: "generate" }
  | { type: "building" }
  | { type: "generated"; result: PanelResult<unknown> }
  | { type: "test" }
  | { type: "testFinished"; result: PanelResult<unknown> }
  | { type: "save" }
  | { type: "saveFinished"; result: PanelResult<unknown> };

/** Said when FluxIQ answered but sent nothing that can be previewed. */
export const NOTHING_TO_PREVIEW = "FluxIQ didn't send back an automation to show.";

const HIDDEN: ReviewPhase = { name: "hidden" };

/** The preview a phase is holding, if any: Test and Save work from it. */
export function previewOf(phase: ReviewPhase): GeneratedPreview | undefined {
  return "preview" in phase ? phase.preview : undefined;
}

function failure(result: Extract<PanelResult<unknown>, { ok: false }>, preview?: GeneratedPreview): ReviewPhase {
  if (result.unsupported === true) return { name: "unavailable" };
  return { name: "failed", sentence: result.sentence, detail: result.detail, preview };
}

function next(phase: ReviewPhase, event: Exclude<ReviewEvent, { type: "status" }>): ReviewPhase {
  const preview = previewOf(phase);
  switch (event.type) {
    case "dismiss":
      return HIDDEN;
    case "generate":
      return phase.name === "offer" || (phase.name === "failed" && preview === undefined) ? { name: "analyzing", stage: "analyzing" } : phase;
    case "building":
      return phase.name === "analyzing" ? { name: "analyzing", stage: "building" } : phase;
    case "generated": {
      if (phase.name !== "analyzing") return phase;
      if (!event.result.ok) return failure(event.result);
      const generated = generatedPreview(event.result.value);
      return generated === undefined ? { name: "failed", sentence: NOTHING_TO_PREVIEW } : { name: "preview", preview: generated };
    }
    case "test":
      return preview !== undefined && (phase.name === "preview" || phase.name === "tested" || phase.name === "failed") ? { name: "testing", preview } : phase;
    case "testFinished":
      if (phase.name !== "testing") return phase;
      if (!event.result.ok) return failure(event.result, phase.preview);
      return { name: "tested", preview: phase.preview, outcome: testOutcome(event.result.value) ?? { passed: false, interventions: 0 } };
    case "save":
      if (preview === undefined || !(phase.name === "preview" || phase.name === "tested" || phase.name === "failed")) return phase;
      return { name: "saving", preview, outcome: phase.name === "tested" ? phase.outcome : undefined };
    case "saveFinished":
      if (phase.name !== "saving") return phase;
      return event.result.ok ? { name: "saved" } : failure(event.result, phase.preview);
  }
}

/** The review after `event`; `model` undefined is the review before any status. */
export function reduceReview(model: ReviewModel | undefined, event: ReviewEvent): ReviewModel {
  const current = model ?? { phase: HIDDEN, recording: undefined };
  if (event.type !== "status") return { ...current, phase: next(current.phase, event) };
  const { status } = event;
  const recording = status.recordingState === "recording" || status.recordingState === "paused";
  if (recording) return { phase: HIDDEN, recording };
  const ended = current.recording === true && status.connectionState === "connected";
  return { phase: ended ? { name: "offer" } : current.phase, recording };
}
