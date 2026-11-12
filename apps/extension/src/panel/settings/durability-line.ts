// What Settings says about how long the pairing lasts. Only a pairing that ends with the browser
// session says anything; a lasting one, or a status that does not say, adds no line.

import type { ExtensionStatus } from "../../shared/protocol";

export const BROWSER_SESSION_PAIRING_LINE = "Paired until you close this browser. This browser cannot keep the pairing between sessions (Firefox with history off), so you will pair again next time.";

/** The sentence for `status`, or "" when there is nothing to add. */
export function durabilityLine(status: ExtensionStatus): string {
  return status.credentialDurability === "browser_session" ? BROWSER_SESSION_PAIRING_LINE : "";
}
