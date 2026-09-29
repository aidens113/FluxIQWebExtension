// The manual actions row: "Start recording", for doing a job yourself (UI
// audit, section 4, "4. Manual actions row"). When it cannot be pressed, the
// line under it says why (`recordControl`). A request that fails is said here
// and stays until recording starts or the person presses again.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelViewContext } from "../shell";
import { recordControl } from "./record-control";
import { createStickyError } from "./sticky-error";

/** The mounted manual actions row. */
export type ManualActions = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
};

/** Creates the manual actions row. */
export function createManualActions(context: PanelViewContext): ManualActions {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();
  // "Start recording" is the exact name the Lab presses; the id is kept from the single-file popup.
  const recordButton = createElement("button", { id: "recordButton", className: "primary-button", text: "Start recording", attrs: { type: "button" } });
  const reason = createElement("p", { className: "card-line", hidden: true });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("section", { className: "card simple-manual", attrs: { "aria-label": "Do it yourself" } }, [recordButton, reason, notice]);
  let latest: ExtensionStatus | undefined;
  let sending = false;

  recordButton.addEventListener("click", () => {
    void (async () => {
      error.clear();
      sending = true;
      if (latest) render(latest);
      const result = await store.request({ type: RUNTIME_MESSAGES.startRecording });
      sending = false;
      if (!result.ok) error.show(result.sentence, (status) => status.recordingState === "recording", result.detail);
      if (latest) render(latest);
    })();
  });

  function render(status: ExtensionStatus): void {
    latest = status;
    const control = recordControl(status);
    element.hidden = control.hidden;
    recordButton.disabled = control.disabled || sending;
    reason.textContent = control.reason ?? "";
    reason.hidden = control.reason === undefined;
    error.observe(status);
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  return { element, render };
}
