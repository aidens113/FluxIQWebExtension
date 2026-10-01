// The card that follows a recording, at the top of the automations tab: offer to turn it into an automation,
// show the analysis, preview what FluxIQ built, test it, and save it. The
// phases and their words are `review-model.ts` and `review-view.ts`; this file
// only sends the requests and draws.

import { SIMPLE_PANEL_MESSAGES, type ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import { createOpenFluxIQButton } from "../../open-fluxiq";
import type { PanelContext } from "../../shell";
import { previewOf, reduceReview, type ReviewEvent, type ReviewModel } from "./review-model";
import { reviewView, type ReviewAction, type ReviewButton } from "./review-view";
import "../recording.css";

/** The mounted review card. */
export type RecordingReview = { readonly element: HTMLElement; render(status: ExtensionStatus): void };

/** How long "Analyzing your steps..." shows before "Building the automation...". */
const BUILDING_AFTER_MS = 2_500;
const LOOKS = { primary: "primary-button", small: "small-button" } as const;

/** Creates the review card; the owner calls `render` with every status. */
export function createRecordingReview(context: PanelContext): RecordingReview {
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
  const actions = new Map<ReviewAction, HTMLButtonElement>();

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
      void request<unknown>({ type: SIMPLE_PANEL_MESSAGES.generateFromRecording }).then((result) => settle({ type: "generated", result }));
    } else if (action === "test") {
      void request<unknown>({ type: SIMPLE_PANEL_MESSAGES.testGeneratedAutomation, ...ids() }).then((result) => settle({ type: "testFinished", result }));
    } else {
      void request<unknown>({ type: SIMPLE_PANEL_MESSAGES.saveGeneratedAutomation, ...ids() }).then((result) => settle({ type: "saveFinished", result }));
    }
  }

  function buttonElement(button: ReviewButton, busy: boolean): HTMLButtonElement {
    const element = createElement("button", { className: LOOKS[button.look], text: button.label, attrs: { type: "button" } });
    element.disabled = busy && button.action !== "dismiss";
    element.addEventListener("click", () => {
      if (!element.disabled && visible(element) && actions.get(button.action) === element && element.parentElement === buttons) press(button.action);
    });
    return element;
  }

  function visible(node: HTMLElement): boolean {
    if (!node.isConnected) return false;
    for (let current: HTMLElement | null = node; current; current = current.parentElement) {
      const style = current.ownerDocument.defaultView?.getComputedStyle(current);
      if (current.hidden || current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true" || current.style.display === "none" || current.style.visibility === "hidden" || style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
    }
    return true;
  }

  function draw(): void {
    const view = reviewView(model.phase);
    const doc = element.ownerDocument;
    const focused = doc.activeElement;
    const removedFocus = [...actions].some(([action, node]) => node === focused && !view.buttons.some((button) => button.action === action));
    const ownedFocus = removedFocus && visible(element) && doc.visibilityState === "visible" && doc.hasFocus();
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
    for (const [action, node] of actions) {
      if (!view.buttons.some((button) => button.action === action)) { actions.delete(action); node.remove(); }
    }
    const shown = view.buttons.map((button) => {
      const node = actions.get(button.action) ?? buttonElement(button, view.busy);
      actions.set(button.action, node);
      if (node.textContent !== button.label) node.textContent = button.label;
      node.className = LOOKS[button.look];
      node.disabled = view.busy && button.action !== "dismiss";
      return node;
    });
    shown.forEach((node, index) => {
      const current = buttons.children[index];
      if (current !== node) buttons.insertBefore(node, current ?? null);
    });
    // Only repair focus removed by this redraw. Dismissal has no local visible
    // target, and another field/page must keep any focus it acquired meanwhile.
    if (ownedFocus && !view.hidden && doc.visibilityState === "visible" && doc.hasFocus() && (doc.activeElement === focused || doc.activeElement === doc.body || doc.activeElement === null)) {
      shown.find((node) => !node.disabled && visible(node))?.focus({ preventScroll: true });
    }
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
