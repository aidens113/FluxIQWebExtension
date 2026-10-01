// What stands in front of the page, marked on each element's own entry (t200).
//
// Until 2026-09-30 an open modal's controls were moved to the front of the
// packet (`frontLayerFirst`), and that order was how a model building a Flow
// noticed a consent wall or a robot check standing between it and the page.
// The packet no longer ranks anything: every element is where the page put it.
// So the information the order carried is now carried as facts, on the element
// each fact is about, in document order:
//
//  - `isDialog` on the element that is an open dialog, with whether it is modal
//    or native and what kind of layer it is;
//  - `covers` (and `coversCount`, `kind`) on an element painted over others,
//    naming by handle every control it takes the click for;
//  - `coveredBy` on each control so covered;
//  - `inDialog` on every element inside an open modal dialog, naming it.
//
// The dialogs and blockers come from the capture's page evidence
// (`evidence.dialogs.open[]`, `evidence.overlays.blockers[]`), which names each
// by selector. A selector is joined to the handle of the element the capture
// described with it, frame and all; a selector no element carries marks
// nothing, because there is no handle to name. Selectors never leave this
// module.
//
// `inDialog` is geometry, as `./front-layer.ts` reads it for look-alikes: the
// element's centre inside the dialog's box. Two further conditions keep the
// page behind a dialog from being counted as inside it: the element comes after
// the dialog in document order, as a descendant must, and nothing covers it --
// a control a modal holds answers its own click, and one behind the modal's
// backdrop does not.

import type { PageEvidenceWire, WebAutomationOverlayEvidence, WebAutomationOverlayEvidenceItem, WebAutomationPageEvidence } from "../../page-evidence";
import { pageEvidenceWire } from "../../page-evidence";
import { FRAME_SELECTOR_PATTERN, type WebLlmEvidenceElement } from "./elements";
import { centreInside, evidenceRect, openDialogs } from "./front-layer";
import { webLlmLayerKind } from "./layer-marks";
import { present } from "./present";
import { countValue, pageText } from "./untrusted-json";

/** One described element, with what the join needs from its capture: the selector and frame that address it, and its raw descriptor for geometry. */
export type WebLlmLayerSubject = {
  element: WebLlmEvidenceElement;
  selector: string;
  raw: unknown;
};

/**
 * Marks every dialog, cover and covered control on its own element, and
 * returns how a capture selector is named by handle, for the page-level
 * `dialogs[]` and `blockedBy[]` (`./page-evidence.ts`).
 */
export function joinWebLlmLayers(snapshot: Record<string, unknown>, subjects: readonly WebLlmLayerSubject[]): (selector: unknown) => string | undefined {
  const handles = new Map<string, string>();
  const byHandle = new Map<string, { subject: WebLlmLayerSubject; index: number }>();
  subjects.forEach((subject, index) => {
    const key = selectorKey(subject.selector, subject.element.frameId);
    // A selector the page gave several elements names the first of them, as a
    // browser's `querySelector` would.
    if (key !== undefined && !handles.has(key)) handles.set(key, subject.element.target);
    byHandle.set(subject.element.target, { subject, index });
  });
  const handleOf = (selector: unknown): string | undefined => {
    const key = selectorKey(pageText(selector));
    return key === undefined ? undefined : handles.get(key);
  };

  markDialogs(snapshot, handleOf, byHandle);
  const covered = markCovers(snapshot, handleOf, byHandle);
  markInsideModals(snapshot, handleOf, subjects, byHandle, covered);
  return handleOf;
}

function markDialogs(snapshot: Record<string, unknown>, handleOf: (selector: unknown) => string | undefined, byHandle: ReadonlyMap<string, { subject: WebLlmLayerSubject }>): void {
  for (const dialog of openDialogs(snapshot)) {
    const element = byHandle.get(handleOf(dialog.selector) ?? "")?.subject.element;
    if (!element || element.isDialog) continue;
    element.isDialog = present<NonNullable<WebLlmEvidenceElement["isDialog"]>>({
      modal: dialog.modal === true,
      native: dialog.native === true ? true : undefined,
      kind: webLlmLayerKind(dialog.kind)
    });
  }
}

/** Marks each cover and what it covers, and returns every covered handle, whether or not its cover is in the packet. */
function markCovers(snapshot: Record<string, unknown>, handleOf: (selector: unknown) => string | undefined, byHandle: ReadonlyMap<string, { subject: WebLlmLayerSubject }>): Set<string> {
  const everyCovered = new Set<string>();
  for (const blocker of overlayBlockers(snapshot)) {
    const cover = handleOf(blocker.selector);
    const element = byHandle.get(cover ?? "")?.subject.element;
    const blocked = Array.isArray(blocker.blocked) ? blocker.blocked : [];
    const covered = [...new Set(blocked.flatMap((selector) => {
      const handle = handleOf(selector);
      return handle === undefined || handle === cover ? [] : [handle];
    }))];
    for (const handle of covered) everyCovered.add(handle);
    if (cover !== undefined) {
      for (const handle of covered) {
        const victim = byHandle.get(handle)?.subject.element;
        if (victim && !victim.coveredBy?.includes(cover)) victim.coveredBy = [...(victim.coveredBy ?? []), cover];
      }
    }
    if (!element) continue;
    // One element reported as a blocker twice -- a selector repeated across
    // frames -- covers what both entries say.
    const before = element.coversCount ?? element.covers?.length ?? 0;
    const covers = [...new Set([...(element.covers ?? []), ...covered])];
    const count = before + Math.max(countValue(blocker.blocks) ?? 0, blocked.length);
    if (covers.length) element.covers = covers;
    if (count > covers.length) element.coversCount = count;
    const kind = webLlmLayerKind(blocker.kind);
    if (kind !== undefined) element.kind = kind;
  }
  return everyCovered;
}

/** Every element inside an open modal dialog is marked with the dialog's handle; the top-most dialog holding it wins. */
function markInsideModals(snapshot: Record<string, unknown>, handleOf: (selector: unknown) => string | undefined, subjects: readonly WebLlmLayerSubject[], byHandle: ReadonlyMap<string, { index: number }>, covered: ReadonlySet<string>): void {
  const modals = openDialogs(snapshot).flatMap((dialog) => {
    const handle = dialog.modal === true ? handleOf(dialog.selector) : undefined;
    const bounds = evidenceRect(dialog.bounds);
    const at = handle === undefined ? undefined : byHandle.get(handle)?.index;
    return handle !== undefined && bounds && at !== undefined ? [{ handle, bounds, at }] : [];
  });
  if (!modals.length) return;
  subjects.forEach(({ element, raw }, index) => {
    if (covered.has(element.target)) return;
    const modal = modals.find((dialog) => index > dialog.at && centreInside(raw, dialog.bounds));
    if (modal) element.inDialog = modal.handle;
  });
}

function overlayBlockers(snapshot: Record<string, unknown>): Array<PageEvidenceWire<WebAutomationOverlayEvidenceItem>> {
  const evidence = pageEvidenceWire<WebAutomationPageEvidence>(snapshot.evidence);
  const overlays = pageEvidenceWire<WebAutomationOverlayEvidence>(evidence?.overlays);
  const blockers = Array.isArray(overlays?.blockers) ? overlays.blockers : [];
  return blockers.flatMap((item) => {
    const blocker = pageEvidenceWire<WebAutomationOverlayEvidenceItem>(item);
    return blocker ? [blocker] : [];
  });
}

/**
 * One spelling for a selector wherever it was written: a child frame's
 * `frame[<id>] >> <selector>`, as the frame merge qualifies it, or the bare
 * selector of the top frame. An element whose frame is known only from its
 * stamp is keyed as if the merge had qualified it.
 */
function selectorKey(selector: string | undefined, frameId?: number): string | undefined {
  if (selector === undefined) return undefined;
  const match = FRAME_SELECTOR_PATTERN.exec(selector);
  const inner = match ? pageText(match[2]) : selector;
  const frame = frameId ?? (match ? countValue(Number(match[1])) : undefined);
  if (inner === undefined) return undefined;
  return frame ? `frame[${frame}] >> ${inner}` : inner;
}
