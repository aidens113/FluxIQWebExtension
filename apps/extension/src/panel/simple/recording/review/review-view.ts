// The review's words and buttons for each phase, as data, so the copy is
// tested without a DOM. The progress lines follow plan 3.2's wording and never
// show the model's reasoning.

import type { GeneratedPreview } from "./generated-preview";
import type { ReviewPhase } from "./review-model";

/** What a review button does. */
export type ReviewAction = "generate" | "test" | "save" | "dismiss";

/** One button: what it does, its words, and how it looks. */
export type ReviewButton = { readonly action: ReviewAction; readonly label: string; readonly look: "primary" | "small" };

/** Everything the review shows for one phase. */
export type ReviewView = {
  readonly hidden: boolean;
  readonly heading: string;
  /** The phase's one sentence: progress, an outcome, or why it failed. */
  readonly sentence?: string | undefined;
  readonly detail?: string | undefined;
  /** "AI activated N times", after a test in which the AI stepped in. */
  readonly note?: string | undefined;
  readonly busy: boolean;
  readonly preview?: GeneratedPreview | undefined;
  readonly buttons: readonly ReviewButton[];
  /** Shows the Open FluxIQ button, where the person finishes when this extension cannot. */
  readonly openFluxIQ: boolean;
};

export const REVIEW_COPY = {
  heading: "Recording finished",
  generate: "Turn this recording into an automation",
  analyzing: "Analyzing your steps...",
  building: "Building the automation...",
  test: "Test the generated automation",
  testing: "Testing the automation...",
  passed: "The test run worked.",
  notPassed: "The test run didn't finish. You can still save it and fix it in FluxIQ.",
  save: "Save",
  saving: "Saving...",
  saved: "Saved. Find it under Recent automations.",
  unavailable: "Finish this automation in FluxIQ: it has your recording.",
  retry: "Try again",
  done: "Done"
} as const;

const DONE: ReviewButton = { action: "dismiss", label: REVIEW_COPY.done, look: "small" };
const TEST: ReviewButton = { action: "test", label: REVIEW_COPY.test, look: "small" };
const SAVE: ReviewButton = { action: "save", label: REVIEW_COPY.save, look: "primary" };

function aiNote(interventions: number): string | undefined {
  if (interventions <= 0) return undefined;
  return `AI activated ${interventions} ${interventions === 1 ? "time" : "times"}`;
}

/** What the review shows in `phase`. */
export function reviewView(phase: ReviewPhase): ReviewView {
  const base = { hidden: false, heading: REVIEW_COPY.heading, busy: false, openFluxIQ: false };
  switch (phase.name) {
    case "hidden":
      return { ...base, hidden: true, buttons: [] };
    case "offer":
      return { ...base, buttons: [{ action: "generate", label: REVIEW_COPY.generate, look: "primary" }, DONE] };
    case "analyzing":
      return { ...base, busy: true, sentence: phase.stage === "building" ? REVIEW_COPY.building : REVIEW_COPY.analyzing, buttons: [DONE] };
    case "preview":
      return { ...base, preview: phase.preview, buttons: [SAVE, TEST, DONE] };
    case "testing":
      return { ...base, busy: true, preview: phase.preview, sentence: REVIEW_COPY.testing, buttons: [DONE] };
    case "tested":
      return {
        ...base,
        preview: phase.preview,
        sentence: phase.outcome.passed ? REVIEW_COPY.passed : REVIEW_COPY.notPassed,
        note: aiNote(phase.outcome.interventions),
        buttons: [SAVE, TEST, DONE]
      };
    case "saving":
      return { ...base, busy: true, preview: phase.preview, sentence: REVIEW_COPY.saving, buttons: [DONE] };
    case "saved":
      return { ...base, sentence: REVIEW_COPY.saved, buttons: [DONE] };
    case "unavailable":
      return { ...base, sentence: REVIEW_COPY.unavailable, openFluxIQ: true, buttons: [DONE] };
    case "failed":
      return {
        ...base,
        sentence: phase.sentence,
        detail: phase.detail,
        preview: phase.preview,
        buttons: phase.preview === undefined ? [{ action: "generate", label: REVIEW_COPY.retry, look: "primary" }, DONE] : [SAVE, TEST, DONE]
      };
  }
}
