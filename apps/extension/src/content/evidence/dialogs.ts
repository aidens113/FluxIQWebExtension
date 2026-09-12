// Dialogs and modals: what stands in front of the page, and whether the page
// behind it can be acted on at all.
//
// Two unrelated things are called a dialog here and both matter. A page dialog
// is DOM -- a native `<dialog open>`, or an element the author gave
// `role="dialog"`, `role="alertdialog"` or `aria-modal="true"` -- and a modal
// one makes every control behind it unreachable, which is the difference
// between an action that will fail and one that was never possible. A native
// dialog is `alert`, `confirm` or `prompt`: it is not DOM at all, it blocks the
// page's script while it is open, and the only trace of it is what the
// page-world override (`page-world/dialog-override.ts`) writes back through
// `shared/dialog-channel.ts`. That override is the reason a snapshot can be
// taken at all while one is on screen, and reading its record here is what
// `action-runtime/dialog-control.ts` calls the snapshot's pending-dialog
// evidence.

import {
  DIALOG_ARM_ATTRIBUTE,
  DIALOG_OBSERVED_ATTRIBUTE,
  decodeDialogObserved
} from "../../shared/dialog-channel";
import { selectorFor } from "../describe-element";
import { accessibleNameFor } from "../identity";
import { visualViewportBounds } from "../visual-bounds";
import type { DialogEvidence, DialogEvidenceItem } from "./types";

const DIALOG_SELECTOR = "dialog[open],[role='dialog'],[role='alertdialog'],[aria-modal='true']";
const MAX_DIALOGS = 5;

/** The dialogs in front of the page, or `undefined` when there are none and nothing native happened. */
export function dialogEvidence(): DialogEvidence | undefined {
  const open = openDialogs();
  const armPending = document.documentElement?.hasAttribute(DIALOG_ARM_ATTRIBUTE) === true;
  const lastNative = lastNativeDialog();
  if (!open.length && !armPending && !lastNative) return undefined;
  return {
    open,
    modal: open.some((dialog) => dialog.modal),
    ...(armPending ? { armPending: true as const } : {}),
    ...(lastNative ? { lastNative } : {})
  };
}

/**
 * Every dialog currently shown, top-most first. A `<dialog>` that is not open,
 * and an ARIA dialog the page has hidden, are not dialogs a reader can act on,
 * so neither is reported.
 */
function openDialogs(): DialogEvidenceItem[] {
  const found: DialogEvidenceItem[] = [];
  for (const element of document.querySelectorAll(DIALOG_SELECTOR)) {
    if (isShown(element)) found.push(describeDialog(element));
  }
  return found.reverse().slice(0, MAX_DIALOGS);
}

function describeDialog(element: Element): DialogEvidenceItem {
  const native = element instanceof HTMLDialogElement;
  const role = element.getAttribute("role")?.trim().toLowerCase();
  const label = accessibleNameFor(element);
  const bounds = visualViewportBounds(element);
  return {
    selector: selectorFor(element),
    role: role || "dialog",
    // A native <dialog> opened with showModal() reports `::backdrop`; the
    // property the page can be asked for is `open`, so modality is taken from
    // the author's own declaration plus the inert page behind it.
    modal: element.getAttribute("aria-modal") === "true" || (native && isNativeModal(element)),
    native,
    ...(label ? { label } : {}),
    ...(bounds ? { bounds } : {})
  };
}

/**
 * A modal `<dialog>` is the top layer, so everything else is inert. `matches`
 * on `:modal` is the direct question; browsers without it fall back to the
 * author's `aria-modal`, which `describeDialog` has already read.
 */
function isNativeModal(element: HTMLDialogElement): boolean {
  try {
    return element.matches(":modal");
  } catch {
    return false;
  }
}

/** Hidden dialogs are not evidence: `hidden`, `aria-hidden`, and the display and visibility rules. */
function isShown(element: Element): boolean {
  if (element.closest("[hidden],[aria-hidden='true']")) return false;
  if (element instanceof HTMLDialogElement && !element.open) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
}

/**
 * The dialog the override answered, projected field by field. `promptText` is
 * deliberately dropped: it is whatever a person typed into a `prompt`, and
 * evidence has no business carrying it out of the page.
 */
function lastNativeDialog(): DialogEvidence["lastNative"] {
  const raw = document.documentElement?.getAttribute(DIALOG_OBSERVED_ATTRIBUTE);
  const observed = raw === null || raw === undefined ? undefined : decodeDialogObserved(raw);
  return observed && { kind: observed.kind, message: observed.message, response: observed.response, at: observed.at };
}
