// "Forget this pairing" (was "Reset Session"), which asks first (UI audit,
// section 4, and defect F4: the old button discarded the pairing token in one
// click with no word of what it did). The question sits inline under the
// button rather than in a modal, with Cancel focused, so a stray Enter cancels.

import { createElement } from "../dom";

/** The button and its confirmation; `setBusy` guards both while the forget is in flight. */
export type ForgetConfirmation = { readonly element: HTMLElement; setBusy(busy: boolean): void };

/** Builds the control; `onForget` runs when the viewer confirms. */
export function createForgetConfirmation(onForget: () => Promise<boolean>): ForgetConfirmation {
  let busy = false;
  let pending = false;
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
  const notice = createElement("p", { className: "card-line", hidden: true, attrs: { role: "alert" } });
  confirm.append(notice);

  function ownsFocus(source: HTMLElement): boolean {
    const doc = source.ownerDocument;
    if (!source.isConnected || doc.visibilityState !== "visible" || !doc.hasFocus() || doc.activeElement !== source) return false;
    for (let parent: HTMLElement | null = source; parent !== null; parent = parent.parentElement) {
      if (parent.hidden || parent.hasAttribute("inert")) return false;
    }
    return true;
  }

  function setOpen(open: boolean, restoreFocus: boolean): void {
    confirm.hidden = !open;
    openButton.hidden = open;
    openButton.setAttribute("aria-expanded", String(open));
    if (restoreFocus) (open ? cancelButton : openButton).focus();
  }

  openButton.addEventListener("click", () => {
    if (!busy && !pending) setOpen(true, ownsFocus(openButton));
  });
  cancelButton.addEventListener("click", () => {
    if (!busy && !pending) setOpen(false, ownsFocus(cancelButton));
  });
  forgetButton.addEventListener("click", () => void forget());

  async function forget(): Promise<void> {
    if (busy || pending) return;
    const restoreFocus = ownsFocus(forgetButton);
    pending = true;
    notice.hidden = true;
    renderBusy();
    try {
      if (await onForget()) {
        pending = false;
        renderBusy();
        setOpen(false, restoreFocus && ownsFocus(forgetButton));
      } else {
        notice.textContent = "Pairing wasn't forgotten. Try Forget again.";
        notice.hidden = false;
      }
    } catch {
      notice.textContent = "Couldn't forget this pairing. Try Forget again.";
      notice.hidden = false;
    } finally {
      pending = false;
      renderBusy();
    }
  }

  function renderBusy(): void {
    for (const button of [openButton, forgetButton, cancelButton]) button.disabled = busy || pending;
  }

  return {
    element: createElement("div", { className: "forget-pairing" }, [openButton, confirm]),
    setBusy(value) {
      busy = value;
      renderBusy();
    }
  };
}
