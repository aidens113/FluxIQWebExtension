// The `fluxiq.pageChanges` content message: what the background worker asks a
// frame before it takes a look at the page, and what the frame answers (task
// speed S4).
//
// The frame answers with the copy of the content script answering and how many
// changes it has counted since it started (`content/page-changes/`). A look
// the worker kept still stands while every frame of the tab answers the same
// mark it answered around that look (`runtime/look-reuse/`). Nothing of the
// page is in the answer.

/** The message name, which the background worker and the content script must spell identically. */
export const PAGE_CHANGES_MESSAGE = "fluxiq.pageChanges";

/** A frame's mark: which copy of the content script answers, and the count of changes it has seen. */
export type PageChangesResponse = { instance: string; changes: number };

