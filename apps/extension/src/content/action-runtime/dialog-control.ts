// Answering native dialogs, from the isolated world.
//
// `alert`, `confirm`, and `prompt` block the page's script, so nothing here can
// answer one after it opens: the override lives in the page's own world
// (`src/page-world/`), installed at `document_start` before any page script can
// capture the originals. This module is the isolated half of that pair and
// speaks to it only through the DOM contract in `shared/dialog-channel.ts`.
//
// `arm` records how the next dialog should be answered and returns false when
// the page-world override is absent, so the verb can fail honestly rather than
// arm a dialog nothing will ever answer. It learns that synchronously: the
// arming is written to an attribute and a DOM event is dispatched on
// `document`, which listeners in both worlds receive on the dispatching call
// stack, so by the time `dispatchEvent` returns an installed override has
// already consumed the attribute. A still-present attribute means nobody was
// listening.
//
// `observed` reports the dialog the override actually handled, which is the
// evidence the verb reports and which the snapshot's pending-dialog evidence
// reads (Phase 1.4).

import {
  DIALOG_ARM_ATTRIBUTE,
  DIALOG_ARM_EVENT,
  DIALOG_OBSERVED_ATTRIBUTE,
  decodeDialogObserved,
  encodeDialogArm,
  type DialogObserved
} from "../../shared/dialog-channel";
import type { WebAutomationDialogRequest } from "../types";

/** A dialog the page-world override handled. The channel owns the shape; this is the name the verbs use. */
export type ObservedDialog = DialogObserved;

export type DialogControl = {
  /** Arms the answer to the next dialog. False when the page-world override is not installed. */
  arm(request: WebAutomationDialogRequest): boolean;
  /** The most recent dialog the override handled, if any. */
  observed(): ObservedDialog | undefined;
};

export const dialogControl: DialogControl = {
  arm(request: WebAutomationDialogRequest): boolean {
    const root = document.documentElement;
    if (!root) return false;
    try {
      root.setAttribute(DIALOG_ARM_ATTRIBUTE, encodeDialogArm({
        response: request.response,
        ...(request.promptText === undefined ? {} : { promptText: request.promptText })
      }));
    } catch {
      return false;
    }
    document.dispatchEvent(new CustomEvent(DIALOG_ARM_EVENT));
    // An installed override removed the attribute while dispatching. If it is
    // still there nobody is listening, so leave the page as we found it.
    if (!root.hasAttribute(DIALOG_ARM_ATTRIBUTE)) return true;
    root.removeAttribute(DIALOG_ARM_ATTRIBUTE);
    return false;
  },

  observed(): ObservedDialog | undefined {
    const raw = document.documentElement?.getAttribute(DIALOG_OBSERVED_ATTRIBUTE);
    return raw === null || raw === undefined ? undefined : decodeDialogObserved(raw);
  }
};
