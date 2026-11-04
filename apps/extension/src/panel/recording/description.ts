import { createElement } from "../dom";

/** Said under the question while the panel is Firefox's popup, which closes when the page is clicked. */
export const POPUP_RECORDING_NOTE = "Clicking the page closes this window, and recording goes on. Open FluxIQ again to see it and stop it.";

/** Asks what the recording is for; FluxIQ reads it to understand what it is shown. Answers undefined when the person cancels. */
export function requestRecordingDescription(_host: HTMLElement, options: { popup?: boolean } = {}): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = createElement("textarea", { attrs: { "aria-label": "Recording description", maxlength: "4000", rows: "4", placeholder: "For example: add a coffee to the cart and open the cart." } });
    const error = createElement("p", { attrs: { role: "status" } });
    const start = createElement("button", { className: "primary-button", text: "Start described recording", attrs: { type: "submit" } });
    const cancel = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" } });
    const form = createElement("form", { className: "card recording-description", attrs: { "aria-label": "Describe recording" } }, [
      createElement("h3", { text: "What should FluxIQ learn from this?" }),
      createElement("p", { text: "Say in a sentence what you are about to show. FluxIQ watches this tab while you do it, then keeps it with your next message." }),
      ...(options.popup === true ? [createElement("p", { className: "recording-popup-note", text: POPUP_RECORDING_NOTE })] : []),
      input, error, start, cancel
    ]);
    const dialog = createElement("dialog", { className: "recording-description-dialog" }, [form]);
    function finish(value: string | undefined): void {
      dialog.close();
      dialog.remove();
      resolve(value);
    }
    cancel.addEventListener("click", () => finish(undefined));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value || value.length > 4000) {
        error.textContent = "Write a sentence about what you will show (up to 4,000 characters).";
        input.focus();
        return;
      }
      finish(value);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(undefined);
    });
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  });
}
