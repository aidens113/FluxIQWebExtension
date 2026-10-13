import { createElement } from "../dom";

/** Collects supporting-evidence context without inventing automation instructions. */
export function requestRecordingDescription(_host: HTMLElement): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = createElement("textarea", { attrs: { "aria-label": "Recording description", maxlength: "4000", rows: "4" } });
    const error = createElement("p", { attrs: { role: "status" } });
    const start = createElement("button", { text: "Start described recording", attrs: { type: "submit" } });
    const cancel = createElement("button", { text: "Cancel", attrs: { type: "button" } });
    const form = createElement("form", { className: "card recording-description", attrs: { "aria-label": "Describe recording" } }, [
      createElement("h3", { text: "Describe this recording" }),
      createElement("p", { text: "Explain what this demonstration shows. Recordings support the task instructions you author in FluxIQ." }),
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
        error.textContent = "Describe this recording in 1-4000 characters.";
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
