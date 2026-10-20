// Where the control a library call acts on sits, for Core's permission
// declaration (FluxIQ Core t475): the record -- row, card, list item -- and
// the dialog the look before acting placed it in, as the opaque tokens
// `./token.ts` makes. Neither when the call names no handle, or the
// handle sits in no record and no dialog. Core ties an undo of a build's own
// act to that act's own item by these, and refuses a control on another row
// unpressed.
//
// **And what it and its page are about (Core t719).** An act whose effect shows
// elsewhere -- an add pressed on a detail page, whose line appears in the
// basket; a line moved to a saved list -- has no item an undo there can match.
// So the spot also carries `subject`, the digest of what the control is about
// (`apps/extension/src/content/identity/record.ts` `recordSubject`: its row's
// title, or a lone control's nearest titled part), and `page`, the digest of
// what its page is about (the binding's `pageSubject`, its main heading). Both
// are digests of one kind, so a detail page's heading and the basket line's
// title, being the same words, are the same token. Core reads them only to tie
// an undo to its act, and never sees the words.
//
// **And the control's own place and state (L1 reset settlement).** For a
// visible stateful control -- a toggle a second press flips back -- `place` is
// its own slot on its page and `state` what it shows there before the act
// (`./place.ts`, `./state.ts`), so Core can tie the press that turns it back to
// the act, wherever the page shows it: a dialog over a page or the page itself.

import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webResetCollections } from "./collection";
import { webControlPlace } from "./place";
import { webControlState } from "./state";
import { webControlSpotToken } from "./token";

/** The tokens of the record and dialog `handle` sits in on `page`, and of what it and the page are about. */
export function webTargetSpot(page: Pick<WebLlmSnapshotBinding, "records" | "dialogNames" | "subjects" | "pageSubject"> & Partial<Pick<WebLlmSnapshotBinding, "evidence" | "selectors" | "resetResource">>, handle: string | undefined): WebTargetSpot {
  if (handle === undefined) return {};
  const record = page.records.get(handle);
  const dialog = page.dialogNames?.get(handle);
  const subject = page.subjects?.get(handle);
  const collection = webResetCollections(page).controls.get(handle);
  const place = webControlPlace(page, handle);
  const element = place === undefined ? undefined : page.evidence?.elements.find((candidate) => candidate.target === handle);
  return present<WebTargetSpot>({
    resource: page.resetResource,
    item: record ? webControlSpotToken("item", record) : undefined,
    dialog: dialog ? webControlSpotToken("dialog", dialog) : undefined,
    subject: subject ? webControlSpotToken("subject", subject) : undefined,
    page: page.pageSubject ? webControlSpotToken("subject", page.pageSubject) : undefined,
    scope: collection ?? (page.evidence?.location && page.resetResource ? webControlSpotToken("scope", `${page.resetResource}\0${page.evidence.location}`) : undefined),
    place,
    state: element === undefined ? undefined : webControlState(element)
  });
}

/** The opaque tokens of where a control sits and what it and its page are about; each absent where there is none. */
type WebTargetSpot = { item?: string; dialog?: string; subject?: string; page?: string; scope?: string; resource?: string; place?: string; state?: string };
