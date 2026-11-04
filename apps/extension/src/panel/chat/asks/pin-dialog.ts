// The dialog that asks for the person's PIN before a confirmation with a lasting
// effect is answered. A real modal: focus moves into the field, Escape cancels,
// Enter submits, and a refusal stays open saying why, with the field empty and
// focused for another try.
//
// The PIN is read from the field once, as the press happens, and the field is
// emptied before anything is sent. It goes to `submit` as that one call's
// parameter: nothing here logs it, stores it or keeps a reference past the call.

import type { ChatReauthorizeOutcome, ChatReauthorizeRequest } from "@fluxiq/ui-components";
import { createElement } from "../../dom";

/** Core's shape for a PIN (`programAuthorizationPinError`), said before anything is sent. */
const PIN_SHAPE = /^\d{4,12}$/u;
const NOT_A_PIN = "A PIN is 4 to 12 digits.";
const NOT_SENT = "That didn't go through. Try again.";
const CHECKING = "Checking…";

/** Draws the dialog for `request` in `host`, and hands focus back when it closes. */
export function showPinDialog(request: ChatReauthorizeRequest, host: HTMLElement = document.body): void {
  const opener = document.activeElement as HTMLElement | null;
  const openerWords = opener?.textContent ?? "";
  const field = createElement("input", {
    className: "ask-pin-field",
    attrs: { type: "password", inputmode: "numeric", autocomplete: "off", maxlength: "12", "aria-label": "Your PIN" }
  });
  const refusal = createElement("p", { className: "ask-pin-refusal", attrs: { role: "alert" } });
  const cancel = createElement("button", { className: "ask-pin-button", text: "Cancel", attrs: { type: "button" } });
  const confirm = createElement("button", { className: "ask-pin-button", text: request.actionLabel, attrs: { type: "submit", "data-tone": "danger" } });
  const form = createElement("form", { className: "ask-pin-form" }, [
    createElement("p", { className: "ask-pin-title", text: request.title }),
    createElement("p", { className: "ask-pin-lead", text: request.description }),
    field,
    refusal,
    createElement("div", { className: "ask-pin-actions" }, [cancel, confirm])
  ]);
  const dialog = createElement("dialog", { className: "ask-pin", attrs: { "aria-label": request.title } }, [form]);
  let sending = false;

  const close = (): void => {
    field.value = "";
    dialog.close?.();
    dialog.remove();
    returnFocus(opener, openerWords, host);
  };
  const dismiss = (): void => {
    if (sending) return;
    close();
    request.cancel();
  };
  const sendingNow = (now: boolean): void => {
    sending = now;
    field.disabled = now;
    cancel.disabled = now;
    confirm.disabled = now;
    confirm.textContent = now ? CHECKING : request.actionLabel;
  };
  const refused = (why: string): void => {
    refusal.textContent = why;
    field.focus();
  };
  const send = async (): Promise<void> => {
    if (sending) return;
    const pin = field.value;
    field.value = "";
    if (!PIN_SHAPE.test(pin)) {
      refused(NOT_A_PIN);
      return;
    }
    refusal.textContent = "";
    sendingNow(true);
    const outcome = await submitted(request, pin);
    sendingNow(false);
    if (outcome.ok) close();
    else refused(outcome.error || NOT_SENT);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void send();
  });
  cancel.addEventListener("click", dismiss);
  // Escape on a modal dialog arrives as `cancel`; the dialog closes itself only through `dismiss`, so the person's cancel always reaches the chat.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  host.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.open = true;
  field.focus();
}

/**
 * Back to the button that opened it. An answer on its way redraws the question,
 * so after a refusal that button is its redrawn self, found by its words; once the
 * question has gone, the composer.
 */
function returnFocus(opener: HTMLElement | null, words: string, host: HTMLElement): void {
  if (opener?.isConnected) {
    opener.focus();
    return;
  }
  const redrawn = words === "" ? undefined : Array.from(host.querySelectorAll?.("button") ?? []).find((button) => button.textContent === words && !button.disabled);
  (redrawn ?? host.querySelector?.<HTMLElement>("#conversationInput"))?.focus();
}

async function submitted(request: ChatReauthorizeRequest, pin: string): Promise<ChatReauthorizeOutcome> {
  try {
    return await request.submit(pin);
  } catch {
    return { ok: false, error: NOT_SENT };
  }
}
