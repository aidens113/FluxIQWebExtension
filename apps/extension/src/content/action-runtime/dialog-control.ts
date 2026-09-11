// Answering native dialogs.
//
// `alert`, `confirm`, and `prompt` block the page's script, so nothing in an
// isolated content script can answer one after it opens: the override has to be
// installed in the page's own world at `document_start`, before any page script
// can capture the originals. `arm` records how the next dialog should be
// answered and returns false when that page-world override is absent, so the
// verb can fail honestly rather than hang. `observed` reports the dialog the
// override actually handled, which is the evidence the verb validates against
// and which the snapshot's pending-dialog evidence reads (Phase 1.4).
//
// Owned by `w2-upload-dialog`, which replaces this stub and installs the
// page-world script.

import type { WebAutomationDialogRequest } from "../types";

export type ObservedDialog = {
  kind: "alert" | "confirm" | "prompt" | "beforeunload";
  message: string;
  response: "accept" | "dismiss";
  promptText?: string | undefined;
  at: number;
};

export type DialogControl = {
  /** Arms the answer to the next dialog. False when the page-world override is not installed. */
  arm(request: WebAutomationDialogRequest): boolean;
  /** The most recent dialog the override handled, if any. */
  observed(): ObservedDialog | undefined;
};

export const dialogControl: DialogControl = {
  arm(_request: WebAutomationDialogRequest): boolean {
    throw new Error("The dialog-control capability is not implemented yet.");
  },
  observed(): ObservedDialog | undefined {
    throw new Error("The dialog-control capability is not implemented yet.");
  }
};
