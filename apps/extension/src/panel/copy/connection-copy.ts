// The status card's words: one dot colour, one sentence and an optional line
// for every connection state, from the table in the UI audit, section 4
// ("1. Status card"). The buttons are the view's; this is text only.
//
// Red is for "can't reach FluxIQ" only. Recording never colours this dot.

import type { ExtensionStatus } from "../../shared/protocol";
import { pageHostname } from "./page-hostname";

/** What the status card says about the connection. */
export type ConnectionCopy = {
  dot: "grey" | "amber" | "green" | "red";
  sentence: string;
  line?: string;
};

// `paired` is being added to ExtensionStatus by workstream D. Reading it
// through this widening compiles before and after that lands; until it does,
// an absent `paired` reads as never paired.
type StatusWithPairing = ExtensionStatus & { paired?: boolean };

/** The dot, sentence and line for `status`'s connection. */
export function connectionCopy(status: ExtensionStatus): ConnectionCopy {
  switch (status.connectionState) {
    case "disconnected":
      return {
        dot: "grey",
        sentence: "FluxIQ isn't connected",
        line: (status as StatusWithPairing).paired === true
          ? "Connect to pick up where you left off."
          : "Connect this browser so FluxIQ can work in it."
      };
    case "connecting":
      return { dot: "amber", sentence: "Connecting to FluxIQ..." };
    case "reconnecting":
      return { dot: "amber", sentence: "Lost the connection. Trying again...", line: "FluxIQ reconnects on its own." };
    case "error":
      return { dot: "red", sentence: "Can't reach FluxIQ", line: "Make sure FluxIQ is running on this computer, then try again." };
    case "pairing":
      return { dot: "amber", sentence: "Approve this browser in FluxIQ", line: "In FluxIQ, approve the request that shows this code." };
    case "connected":
      return { dot: "green", sentence: "Connected to FluxIQ", line: connectedLine(status) };
  }
}

function connectedLine(status: ExtensionStatus): string {
  if (status.unsupportedPage) return `FluxIQ can't work on this page. ${status.unsupportedPage.reason}`.trim();
  const hostname = pageHostname(status.activeTabUrl);
  return hostname === undefined ? "Open a web page for FluxIQ to work on." : `Working in: ${hostname}`;
}
