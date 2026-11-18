// The one message that takes a tab's content script out of service: the
// background sends it when a tab it had treated as ordinary turns out to be
// one FluxIQ must not touch (it moved to one of FluxIQ's own pages). The
// content script then discards what it holds without sending any of it, and
// answers nothing further about the page (`content/revoked/`).

/** The content message that revokes a document's content script. */
export const CONTENT_REVOKED_MESSAGE = "fluxiq.revoked";
