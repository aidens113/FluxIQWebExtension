// While a modal dialog is open, its own controls are the only ones on the page
// that can be pressed. The capture ranks elements for a page without one --
// what was touched, then the standard controls in document order -- and a
// dialog a page opens over itself is usually appended at the end of the
// document, so its buttons ranked past the packet's forty-element bound. Live
// on 2026-09-21, a promotion opened over a feed and the model was refused its
// press as `blocked_by_dialog`, shown a packet saying a modal dialog blocked
// thirty-eight controls, and given no handle for any control inside it: it
// could see what was in the way and had no way to close it.
//
// So the packet takes the elements inside the top-most open modal dialog
// first, keeping the capture's order within each group. Inside is decided by
// geometry the capture already reports -- the element's box and the dialog's,
// both in viewport coordinates -- because nothing else on the wire says which
// dialog an element belongs to.

import type { PageEvidenceWire, WebAutomationDialogEvidence, WebAutomationDialogEvidenceItem, WebAutomationEvidenceRect, WebAutomationPageEvidence } from "../../page-evidence";
import { pageEvidenceWire } from "../../page-evidence";
import { isJsonRecord } from "./untrusted-json";

/** The capture's elements with the top-most open modal dialog's own ahead of the rest; the same array when there is none. */
export function frontLayerFirst(snapshot: Record<string, unknown>, elements: readonly unknown[]): readonly unknown[] {
  const dialog = topModalDialogBounds(snapshot);
  if (!dialog) return elements;
  const inside = new Set(elements.filter((element) => centreInside(element, dialog)));
  if (!inside.size || inside.size === elements.length) return elements;
  return [...inside, ...elements.filter((element) => !inside.has(element))];
}

function topModalDialogBounds(snapshot: Record<string, unknown>): WebAutomationEvidenceRect | undefined {
  const evidence = pageEvidenceWire<WebAutomationPageEvidence>(snapshot.evidence);
  const dialogs: PageEvidenceWire<WebAutomationDialogEvidence> | undefined = pageEvidenceWire<WebAutomationDialogEvidence>(evidence?.dialogs);
  const open = Array.isArray(dialogs?.open) ? dialogs.open : [];
  // Top-most first, as the producer orders them.
  for (const item of open) {
    const dialog = pageEvidenceWire<WebAutomationDialogEvidenceItem>(item);
    if (dialog?.modal !== true) continue;
    return rect(dialog.bounds);
  }
  return undefined;
}

function centreInside(element: unknown, box: WebAutomationEvidenceRect): boolean {
  const bounds = isJsonRecord(element) ? rect(element.bounds) : undefined;
  if (!bounds) return false;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function rect(value: unknown): WebAutomationEvidenceRect | undefined {
  if (!isJsonRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (![x, y, width, height].every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
  if ((width as number) <= 0 || (height as number) <= 0) return undefined;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}
