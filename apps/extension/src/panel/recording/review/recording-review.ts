import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import { createOpenFluxIQButton } from "../../open-fluxiq";
import type { PanelContext } from "../../shell";
import "../recording.css";

export type RecordingReview = { readonly element: HTMLElement; render(status: ExtensionStatus): void };

/** What the review can hand to the chat. */
export type RecordingReviewOptions = {
  /** Attaches the recording just stopped to the next chat message; answers whether it was found. */
  onAttach?: () => Promise<boolean>;
};

export const ATTACH_NEXT_LABEL = "Attach to my next message";
export const ATTACHED_SENTENCE = "Attached. Say what to automate in the Chat tab.";
export const NOT_ATTACHED_SENTENCE = "Couldn't find this recording to attach. Try Attach a recording in the chat.";

/** A recording is supporting evidence; authoring always starts with explicit task instructions. */
export function createRecordingReview(context: PanelContext, options: RecordingReviewOptions = {}): RecordingReview {
  const open = createOpenFluxIQButton(context.store.request, { label: "Author task instructions in FluxIQ", look: "primary" });
  const done = createElement("button", { text: "Done", className: "small-button", attrs: { type: "button" } });
  const attach = createElement("button", { text: ATTACH_NEXT_LABEL, className: "small-button", attrs: { type: "button" } });
  const attachNote = createElement("p", { attrs: { role: "status" } });
  const element = createElement("section", { className: "card recording-review", hidden: true, attrs: { "aria-label": "Recording review" } }, [
    createElement("h3", { text: "Recording saved as supporting evidence" }),
    createElement("p", { text: "Author the automation's task instructions in FluxIQ, then optionally attach this described recording. A recording alone does not build or approve an automation." }),
    open.element, ...(options.onAttach ? [attach, attachNote] : []), done
  ]);
  let recording: boolean | undefined;
  attach.addEventListener("click", () => {
    attach.disabled = true;
    void (options.onAttach?.() ?? Promise.resolve(false)).catch(() => false).then((found) => {
      attach.disabled = false;
      attachNote.textContent = found ? ATTACHED_SENTENCE : NOT_ATTACHED_SENTENCE;
    });
  });
  done.addEventListener("click", () => { element.hidden = true; });
  return {
    element,
    render(status) {
      open.observe(status);
      const active = status.recordingState === "recording" || status.recordingState === "paused";
      if (active) element.hidden = true;
      else if (recording === true && status.connectionState === "connected") {
        attachNote.textContent = "";
        element.hidden = false;
      }
      recording = active;
    }
  };
}
