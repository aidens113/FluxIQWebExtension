// The status card's buttons and link for each connection state, from the table
// in the UI audit, section 4 ("1. Status card"). The words above them are
// `connectionCopy` (panel/copy); this is only what the person can press.
//
// "Connect" keeps its exact name: the Lab presses it by that name
// (`demo-workspace/browser-session.ts`).

import type { ExtensionStatus } from "../../shared/protocol";

/** What a status-card button does. */
export type StatusAction = "connect" | "disconnect" | "openFluxIQ";

/** One status-card button. `primary` is the card's one main button. */
export type StatusButton = { label: string; action: StatusAction; primary: boolean };

/** Everything pressable on the status card for one status. */
export type StatusControls = {
  buttons: StatusButton[];
  /** A link under the sentence that opens Advanced on the Connection tab. */
  addressLink?: string;
  /** Shows the pairing card: the code in large type. */
  pairing: boolean;
};

/** The status card's controls for `status`. */
export function statusControls(status: ExtensionStatus): StatusControls {
  switch (status.connectionState) {
    case "disconnected":
      return { buttons: [{ label: "Connect", action: "connect", primary: true }], pairing: false };
    case "connecting":
      return { buttons: [{ label: "Cancel", action: "disconnect", primary: false }], pairing: false };
    case "reconnecting":
      return { buttons: [{ label: "Try now", action: "connect", primary: true }], pairing: false };
    case "error":
      return {
        buttons: [{ label: "Try again", action: "connect", primary: true }],
        addressLink: "Check the connection address",
        pairing: false
      };
    case "pairing":
      return {
        buttons: [
          { label: "Open FluxIQ", action: "openFluxIQ", primary: true },
          { label: "Cancel", action: "disconnect", primary: false }
        ],
        pairing: true
      };
    case "connected":
      return { buttons: [], pairing: false };
  }
}
