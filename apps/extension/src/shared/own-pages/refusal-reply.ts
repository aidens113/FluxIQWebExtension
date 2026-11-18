// The words and the wire shapes of an own-page refusal, shared by the two sides
// that refuse: the background's tab gate before it sends, and the content script
// in a document that turns out to be FluxIQ's own when a command reaches it.
//
// A content script that refuses answers `OwnPageRefusalReply`; the gate's send
// turns that reply into the same `OwnPageRefusal` error it throws itself, so
// every caller meets one refusal whichever side made it. Only the extension's
// own scripts answer a `tabs.sendMessage`, so a page cannot forge the reply.
//
// The content script learns where FluxIQ's pages are by asking the background
// (`OWN_PAGE_ADDRESSES_MESSAGE`), which answers from the connection's settings:
// the settings live in `chrome.storage.local`, which is closed to content
// scripts because the credential is stored there.

/** What the model and the person read, word for word, wherever FluxIQ refuses one of its own pages. */
export const OWN_PAGE_REFUSAL_MESSAGE = "FluxIQ does not act in its own pages";

/**
 * The content script's answer to a command that reached FluxIQ's own page, or
 * one that reached a document that could not learn where FluxIQ's pages are
 * (the background did not answer), which is refused rather than assumed safe.
 */
export type OwnPageRefusalReply = { readonly refused: "own_page" | "own_page_unconfirmed"; readonly error: string };

/** The content script asking the background where FluxIQ's own pages are. */
export const OWN_PAGE_ADDRESSES_MESSAGE = "fluxiq.ownPageAddresses";

/** The reply a document gives instead of acting, when it is one of FluxIQ's own pages. */
export function ownPageRefusalReply(): OwnPageRefusalReply {
  return { refused: "own_page", error: `${OWN_PAGE_REFUSAL_MESSAGE}: this document is a FluxIQ page, so nothing was done in it.` };
}

/** The reply a document gives instead of acting, when it could not learn where FluxIQ's pages are. */
export function ownPageUnconfirmedReply(): OwnPageRefusalReply {
  return { refused: "own_page_unconfirmed", error: "FluxIQ could not confirm this document is not one of its own pages, so nothing was done in it." };
}

/** Whether a content script's reply is one of those two refusals. */
export function isOwnPageRefusalReply(value: unknown): value is OwnPageRefusalReply {
  const refused = typeof value === "object" && value !== null ? (value as { refused?: unknown }).refused : undefined;
  return refused === "own_page" || refused === "own_page_unconfirmed";
}
