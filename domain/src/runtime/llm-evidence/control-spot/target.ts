// Where the control a library call acts on sits, for Core's permission
// declaration (FluxIQ Core t475): the record -- row, card, list item -- and
// the dialog the look before acting placed it in, as the opaque tokens
// `./token.ts` makes. Neither when the call names no handle, or the
// handle sits in no record and no dialog. Core ties an undo of a build's own
// act to that act's own item by these, and refuses a control on another row
// unpressed.

import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webControlSpotToken } from "./token";

/** The tokens of the record and dialog `handle` sits in on `page`. */
export function webTargetSpot(page: Pick<WebLlmSnapshotBinding, "records" | "dialogNames">, handle: string | undefined): WebTargetSpot {
  if (handle === undefined) return {};
  const record = page.records.get(handle);
  const dialog = page.dialogNames?.get(handle);
  return present<WebTargetSpot>({ item: record ? webControlSpotToken("item", record) : undefined, dialog: dialog ? webControlSpotToken("dialog", dialog) : undefined });
}

/** The opaque tokens of where a control sits; each absent where it sits in none. */
type WebTargetSpot = { item?: string; dialog?: string };
