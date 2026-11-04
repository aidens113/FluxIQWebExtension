// The browser's approval, in one sentence under the connection state. FluxIQ approves
// a browser once; after that this browser is trusted until the pairing is forgotten.
// `paired` is true once an approval is stored (`ExtensionStatus.paired`).

import type { ExtensionStatus } from "../../shared/protocol";

/** What to say about FluxIQ's approval of this browser. */
export function approvalLine(status: ExtensionStatus | undefined): string {
  if (status === undefined) return "";
  if (status.connectionState === "pairing") return "Waiting for you to approve this browser in FluxIQ.";
  if (status.connectionState === "connected") return status.paired ? "FluxIQ approved this browser." : "FluxIQ is connected, but hasn't approved this browser yet.";
  return status.paired ? "FluxIQ approved this browser earlier." : "This browser isn't approved yet. Connect, then approve it in FluxIQ.";
}
