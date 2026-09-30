// "Forget this pairing" (was "Reset Session"), which asks first (UI audit,
// section 4, and defect F4: the old button discarded the pairing token in one
// click with no word of what it did). The question sits inline under the
// button rather than in a modal, with Cancel focused, so a stray Enter cancels.

import { createElement } from "../dom";

/** The button and its confirmation; `setBusy` guards both while the forget is in flight. */
export type ForgetConfirmation = { readonly element: HTMLElement; setBusy(busy: boolean): void };

/** Builds the control; `onForget` runs when the viewer confirms. */
export function createForgetConfirmation(onForget: () => Promise<void>): ForgetConfirmation {
  const openButton = createElement("button", {
    id: "forgetPairingButton",
    className: "small-button danger-button",
    text: "Forget this pairing",
    attrs: { type: "button", "aria-expanded": "false", "aria-controls": "forgetPairingConfirm" }
  });
  const forgetButton = createElement("button", { className: "small-button danger-button", text: "Forget", attrs: { type: "button" } });
  const cancelButton = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" } });
  const question = createElement("p", { id: "forgetPairingQuestion", className: "card-line", text: "FluxIQ will need to approve this browser again." });
  const confirm = createElement("div", {
    id: "forgetPairingConfirm",
    className: "confirm",
    hidden: true,
    attrs: { role: "group", "aria-labelledby": "forgetPairingQuestion" }
  }, [question, createElement("div", { className: "card-actions" }, [forgetButton, cancelButton])]);

  function setOpen(open: boolean): void {
    confirm.hidden = !open;
    openButton.hidden = open;
    openButton.setAttribute("aria-expanded", String(open));
    (open ? cancelButton : openButton).focus();
  }

  openButton.addEventListener("click", () => setOpen(true));
  cancelButton.addEventListener("click", () => setOpen(false));
  forgetButton.addEventListener("click", () => {
    void onForget().then(() => setOpen(false));
  });

  return {
    element: createElement("div", { className: "forget-pairing" }, [openButton, confirm]),
    setBusy(busy) {
      for (const button of [openButton, forgetButton, cancelButton]) button.disabled = busy;
    }
  };
}
