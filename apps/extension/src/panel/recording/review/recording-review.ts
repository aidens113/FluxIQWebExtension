import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import { createOpenFluxIQButton } from "../../open-fluxiq";
import type { PanelContext } from "../../shell";
import "../recording.css";

export type RecordingReview = { readonly element: HTMLElement; render(status: ExtensionStatus): void };

/** A recording is supporting evidence; authoring always starts with explicit task instructions. */
export function createRecordingReview(context: PanelContext): RecordingReview {
  const open = createOpenFluxIQButton(context.store.request, { label: "Author task instructions in FluxIQ", look: "primary" });
  const done = createElement("button", { text: "Done", className: "small-button", attrs: { type: "button" } });
  const element = createElement("section", { className: "card recording-review", hidden: true, attrs: { "aria-label": "Recording review" } }, [
    createElement("h3", { text: "Recording saved as supporting evidence" }),
    createElement("p", { text: "Author the automation's task instructions in FluxIQ, then optionally attach this described recording. A recording alone does not build or approve an automation." }),
    open.element, done
  ]);
  let recording: boolean | undefined;
  done.addEventListener("click", () => { element.hidden = true; });
  return {
    element,
    render(status) {
      open.observe(status);
      const active = status.recordingState === "recording" || status.recordingState === "paused";
      if (active) element.hidden = true;
      else if (recording === true && status.connectionState === "connected") element.hidden = false;
      recording = active;
    }
  };
}
