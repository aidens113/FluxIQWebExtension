// The card that follows a recording: offer to turn it into an automation,
// show the analysis, preview what FluxIQ built, test it, and save it. The
// phases and their words are `review-model.ts` and `review-view.ts`; this file
// only sends the requests and draws.

import type { ExtensionStatus } from "../../../../shared/protocol";
import { createElement } from "../../../dom";
import type { PanelViewContext } from "../../../shell";
import { createOpenFluxIQButton } from "../../open-fluxiq-button";
import { SIMPLE_RELAY_MESSAGES } from "../../relay";
import { previewOf, reduceReview, type ReviewEvent, type ReviewModel } from "./review-model";
import { reviewView, type ReviewAction, type ReviewButton } from "./review-view";
import "../recording.css";

/** The mounted review card. */
export type RecordingReview = { readonly element: HTMLElement; render(status: ExtensionStatus): void };

/** How long "Analyzing your steps..." shows before "Building the automation...". */
const BUILDING_AFTER_MS = 2_500;
const LOOKS = { primary: "primary-button", small: "small-button" } as const;

/** Creates the review card; the owner calls `render` with every status. */
export function createRecordingReview(context: PanelViewContext): RecordingReview {
  const { request } = context.store;
  const heading = createElement("p", { className: "recording-heading" });
  const sentence = createElement("p", { className: "recording-sentence", attrs: { role: "status", "aria-live": "polite" } });
  const note = createElement("p", { className: "recording-note" });
  const name = createElement("p", { className: "recording-preview-name" });
  const steps = createElement("ol", { className: "recording-preview-steps", attrs: { "aria-label": "Steps in the automation" } });
  const more = createElement("p", { className: "recording-preview-more" });
  const preview = createElement("div", { className: "recording-preview" }, [name, steps, more]);
  const openFluxIQ = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "primary" });
  const buttons = createElement("div", { className: "recording-actions" });
  const element = createElement("section", { className: "card recording-review", hidden: true, attrs: { "aria-label": "Recording review" } }, [
    heading,
    sentence,
    note,
    preview,
    openFluxIQ.element,
    buttons
  ]);

  let model: ReviewModel = reduceReview(undefined, { type: "dismiss" });
  let buildingTimer: ReturnType<typeof setTimeout> | undefined;
  // Moves each time the review starts over (hidden, or a fresh offer), so a
  // reply to an earlier review cannot land in a later one.
  let review = 0;

  // Draws only when the phase changed, so a status push never rebuilds the
  // buttons under the person's pointer or focus.
  function dispatch(event: ReviewEvent): void {
    const before = model.phase;
    model = reduceReview(model, event);
    if (model.phase.name !== "analyzing" && buildingTimer !== undefined) {
      clearTimeout(buildingTimer);
      buildingTimer = undefined;
    }
    if (model.phase === before) return;
    if (model.phase.name === "hidden" || model.phase.name === "offer") review++;
    draw();
  }

  function ids(): Record<string, string> {
    const shown = previewOf(model.phase);
    return {
      ...(shown?.proposalId === undefined ? {} : { proposalId: shown.proposalId }),
      ...(shown?.flowId === undefined ? {} : { flowId: shown.flowId })
    };
  }

  function press(action: ReviewAction): void {
    const before = model.phase;
    if (action === "dismiss") return dispatch({ type: "dismiss" });
    dispatch({ type: action });
    if (model.phase === before) return;
    const asked = review;
    const settle = (event: ReviewEvent): void => {
      if (asked === review) dispatch(event);
    };
    if (action === "generate") {
      buildingTimer = setTimeout(() => dispatch({ type: "building" }), BUILDING_AFTER_MS);
      void request<unknown>({ type: SIMPLE_RELAY_MESSAGES.generateFromRecording }).then((result) => settle({ type: "generated", result }));
    } else if (action === "test") {
      void request<unknown>({ type: SIMPLE_RELAY_MESSAGES.testGeneratedAutomation, ...ids() }).then((result) => settle({ type: "testFinished", result }));
    } else {
      void request<unknown>({ type: SIMPLE_RELAY_MESSAGES.saveGeneratedAutomation, ...ids() }).then((result) => settle({ type: "saveFinished", result }));
    }
  }

  function buttonElement(button: ReviewButton, busy: boolean): HTMLButtonElement {
    const element = createElement("button", { className: LOOKS[button.look], text: button.label, attrs: { type: "button" } });
    element.disabled = busy && button.action !== "dismiss";
    element.addEventListener("click", () => press(button.action));
    return element;
  }

  function draw(): void {
    const view = reviewView(model.phase);
    element.hidden = view.hidden;
    element.setAttribute("aria-busy", String(view.busy));
    heading.textContent = view.heading;
    sentence.textContent = view.sentence ?? "";
    sentence.title = view.detail ?? "";
    sentence.hidden = view.sentence === undefined;
    note.textContent = view.note ?? "";
    note.hidden = view.note === undefined;
    preview.hidden = view.preview === undefined;
    name.textContent = view.preview?.name ?? "";
    steps.replaceChildren(...(view.preview?.steps ?? []).map((line) => createElement("li", { text: line })));
    steps.hidden = (view.preview?.steps.length ?? 0) === 0;
    const extra = view.preview?.more ?? 0;
    more.textContent = extra > 0 ? `and ${extra} more ${extra === 1 ? "step" : "steps"}` : "";
    more.hidden = extra === 0;
    openFluxIQ.element.hidden = !view.openFluxIQ;
    buttons.replaceChildren(...view.buttons.map((button) => buttonElement(button, view.busy)));
  }

  draw();

  return {
    element,
    render(status) {
      openFluxIQ.observe(status);
      dispatch({ type: "status", status });
    }
  };
}
