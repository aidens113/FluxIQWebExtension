// Where a control sits, as the opaque tokens Core's action declaration takes
// (`control.item`, `control.dialog`; FluxIQ Core t475).
//
// Core ties an undo of a build's own act to that act's own item -- the row,
// card or list item its control sat in (`../elements.ts` `recordAddress`, the
// extension's record and row identity, t463) and the dialog it sat in (t469)
// -- and lets an undo remove without asking only an item the act created.
// Core compares the tokens only for equality and never shows them, so they
// are digests: the record's words and the dialog's name never leave the
// domain. The same function names the items a start-state read lists
// (`../start-state/page-state.ts`), so a control and the item it sits in carry
// the same token.

import { createHash } from "node:crypto";

/** Hex characters kept of each digest: far past any collision a page could make. */
const DIGEST_LENGTH = 32;

/** The opaque token for a record address (`kind: "item"`) or a dialog's name (`kind: "dialog"`). */
export function webControlSpotToken(kind: "item" | "dialog", value: string): string {
  return `${kind === "item" ? "i" : "d"}:${createHash("sha256").update(`${kind}\0${value}`).digest("hex").slice(0, DIGEST_LENGTH)}`;
}
