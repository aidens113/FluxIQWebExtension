// The pairing card: shown inside the status card while FluxIQ is being asked
// to approve this browser (UI audit, section 4, "1. Status card", the
// `pairing` row). It is inline, not a full-screen modal, so the person can
// still see what they are approving: the code in large type, then what to do
// with it, then Open FluxIQ and Cancel.

import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import type { OpenFluxIQButton } from "./open-fluxiq-button";

/** The mounted pairing card. */
export type PairingCard = {
  readonly element: HTMLElement;
  /** The Cancel button, which the status card wires and disables with its own. */
  readonly cancelButton: HTMLButtonElement;
  render(status: ExtensionStatus): void;
};

const NO_CODE = "------";

/** Creates the pairing card around `open`, the card's primary button. */
export function createPairingCard(open: OpenFluxIQButton): PairingCard {
  // The id is kept from the single-file popup and the wave-1 placeholder.
  const code = createElement("p", { id: "pairingReferenceCode", className: "pairing-code", attrs: { "aria-label": "Approval code" } });
  const cancelButton = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" } });
  const element = createElement("div", { className: "pairing-card", hidden: true }, [
    code,
    createElement("p", { className: "card-line", text: "In FluxIQ, approve the request that shows this code." }),
    createElement("div", { className: "card-actions" }, [open.element, cancelButton])
  ]);

  return {
    element,
    cancelButton,
    render(status) {
      element.hidden = status.connectionState !== "pairing";
      code.textContent = status.pairingReferenceCode ?? NO_CODE;
    }
  };
}
