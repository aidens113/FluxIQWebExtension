// When the document last changed, for the page world's readiness rule
// (`./tracker.ts`, t1094): one `MutationObserver` over the whole document,
// from `document_start` for the document's whole life, so a question asked at
// any moment knows how long the page has been unchanged -- and how long a
// request has been out with nothing drawn around it -- without waiting to find
// out. Nothing of a change is kept but its moment.

/** Calls `changed` each time the document changes; false where no observer can watch it. */
export function watchDocumentChanges(changed: () => void): boolean {
  const Observer = typeof MutationObserver === "function" ? MutationObserver : undefined;
  if (Observer === undefined || typeof document === "undefined") return false;
  try {
    new Observer(() => { changed(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    return true;
  } catch {
    /* best-effort: a document that cannot be observed cannot say it is still, and readiness keeps the old second */
    return false;
  }
}
