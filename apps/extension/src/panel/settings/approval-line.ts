// The browser's approval, in one sentence under the connection state. FluxIQ approves
// a browser once, but only a live connection shows that it still does: `paired` is true once an
// approval is stored (`ExtensionStatus.paired`), and says nothing of whether FluxIQ removed it since.

import type { ExtensionStatus } from "../../shared/protocol";
import { APPROVED_EARLIER_LINE, MAY_HAVE_BEEN_REMOVED_LINE } from "../getting-started";

/** What to say about FluxIQ's approval of this browser. */
export function approvalLine(status: ExtensionStatus | undefined): string {
  if (status === undefined) return "";
  if (status.connectionState === "pairing") return "Waiting for you to approve this browser in FluxIQ.";
  if (status.connectionState === "connected") return status.paired ? "FluxIQ approved this browser." : "FluxIQ is connected, but hasn't approved this browser yet.";
  if (!status.paired) return "This browser isn't approved yet. Connect, then approve it in FluxIQ.";
  // A stored approval is not today's: after a refused or lost connection FluxIQ may have removed this browser.
  return status.connectionState === "error" || status.connectionState === "reconnecting" ? MAY_HAVE_BEEN_REMOVED_LINE : APPROVED_EARLIER_LINE;
}
