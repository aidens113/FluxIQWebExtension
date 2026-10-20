// A stateful control's own place on its page (L1 reset settlement, "Control
// states"): the slot a press that flips it and the press that flips it back
// both act on, as one opaque token.
//
// A toggle's words change with its state ("Like" becomes "Unlike"), so its
// name is no part of its place; that is its state (`./state.ts`). The place is
// the trusted source and the page's address it sits on, its role, and what the
// record it sits in is about: the subject of its row, card or list item
// (`page.records`, `page.subjects`), so one row's toggle is not another's.
// A control in no record has "" there, so the same control shown in a dialog
// over a page and on that page itself -- one address, one role, no row -- is
// at one place on both. Several controls may share a place; a read counts how
// many of them show each state (`./states.ts`), and Core asks only that the
// count of the act's states come back.
//
// A control in a record whose row the page titled by nothing has a place of its
// own kind ("record" with no subject), apart from the controls in no record, so
// a row's toggle never shares a place with the page's own.
//
// The literal `control` keeps the token apart from the page's scope token
// (`resource\0location`) and a list group's (`resource\0location\0frame`).

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webControlRole } from "./role";
import { isWebStatefulControl } from "./stateful";
import { webControlSpotToken } from "./token";

type Page = Pick<WebLlmSnapshotBinding, "records"> & Partial<Pick<WebLlmSnapshotBinding, "evidence" | "subjects" | "resetResource">>;

/** Each capture's elements by handle, built once per capture. */
const byHandle = new WeakMap<readonly WebLlmEvidenceElement[], ReadonlyMap<string, WebLlmEvidenceElement>>();

/** The place token of the visible stateful control `handle` names on `page`; undefined for any other element, or a page with no trusted source (header). */
export function webControlPlace(page: Page, handle: string | undefined): string | undefined {
  if (handle === undefined || !page.resetResource || !page.evidence) return undefined;
  const elements = page.evidence.elements;
  let index = byHandle.get(elements);
  if (index === undefined) {
    index = new Map(elements.map((element) => [element.target, element]));
    byHandle.set(elements, index);
  }
  const element = index.get(handle);
  if (element === undefined || !isWebStatefulControl(element)) return undefined;
  const record = page.records.has(handle) ? `record\0${page.subjects?.get(handle) ?? ""}` : "";
  return webControlSpotToken("scope", `${page.resetResource}\0${page.evidence.location}\0control\0${webControlRole(element)}\0${record}`);
}
