// Which open dialog a captured element sits in, by the geometry the capture
// already reports -- the element's box and the dialog's, both in viewport
// coordinates -- because nothing else on the wire says which dialog an element
// belongs to.
//
// It names the dialog two look-alike controls sit in -- a dialog's "Close" and
// a banner's -- so they can be told apart (`look-alikes.ts`). It is read for
// every open dialog the page names, modal or not, and the top-most one
// containing the element wins.
//
// It no longer reorders anything (t200). Until 2026-09-30 `frontLayerFirst`
// moved an open modal's own controls to the front of the packet, because a
// dialog appended at the end of the document ranked past the packet's
// forty-element bound and the model was shown a modal with no handle for any
// control inside it. The packet now carries every element in document order,
// so the modal's controls are there wherever the page put them, and the
// packet's `dialogs` says the modal is open. The same geometry now also marks,
// on each element's own entry and never by moving it, which open modal dialog
// it sits in (`./layers.ts`).

import type { PageEvidenceWire, WebAutomationDialogEvidence, WebAutomationDialogEvidenceItem, WebAutomationEvidenceRect, WebAutomationPageEvidence } from "../../page-evidence";
import { pageEvidenceWire } from "../../page-evidence";
import { isJsonRecord } from "./untrusted-json";
import { screenedPageText } from "./withheld";

/**
 * For this capture, the name of the open dialog a raw element sits in, or
 * `undefined` when it is in none the page named. A dialog with no name or no
 * box names nothing: there is nothing to call it by, or no way to say what is
 * inside it.
 */
export function openDialogNameOf(snapshot: Record<string, unknown>): (element: unknown) => string | undefined {
  const named = openDialogs(snapshot).flatMap((dialog) => {
    const bounds = evidenceRect(dialog.bounds);
    const name = screenedPageText(dialog.label);
    return bounds && name ? [{ bounds, name }] : [];
  });
  return (element) => named.find((dialog) => centreInside(element, dialog.bounds))?.name;
}

/** The open dialogs the capture reports, top-most first as the producer orders them. */
export function openDialogs(snapshot: Record<string, unknown>): Array<PageEvidenceWire<WebAutomationDialogEvidenceItem>> {
  const evidence = pageEvidenceWire<WebAutomationPageEvidence>(snapshot.evidence);
  const dialogs: PageEvidenceWire<WebAutomationDialogEvidence> | undefined = pageEvidenceWire<WebAutomationDialogEvidence>(evidence?.dialogs);
  const open = Array.isArray(dialogs?.open) ? dialogs.open : [];
  return open.flatMap((item) => {
    const dialog = pageEvidenceWire<WebAutomationDialogEvidenceItem>(item);
    return dialog ? [dialog] : [];
  });
}

/** Whether the centre of a raw element's viewport box lies inside `box`, which is also in viewport coordinates. */
export function centreInside(element: unknown, box: WebAutomationEvidenceRect): boolean {
  const bounds = isJsonRecord(element) ? evidenceRect(element.bounds) : undefined;
  if (!bounds) return false;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/** A rectangle with a finite position and a positive size, or `undefined`. */
export function evidenceRect(value: unknown): WebAutomationEvidenceRect | undefined {
  if (!isJsonRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (![x, y, width, height].every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
  if ((width as number) <= 0 || (height as number) <= 0) return undefined;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}
