// Whether a written `paginate` goes through more than one page, which a Flow's
// read no longer does (read-list redesign S4, contract C3).
//
// A Flow reads a list one page a pass: a Next page step moves the list on, and
// a repeat runs the read again. So a read that still says it pages by itself is
// refused -- at dispatch with `web.extract_list.paginate_retired`
// (`output-nodes/extract-list/dispatch.ts`), and before the Flow runs with the
// same code (`output-nodes/extract-list/issues.ts`) -- rather than read one page
// and report success.
//
// **It asks the value as written, not as read.** The request reader drops a
// `paginate` it cannot read (`./read-request.ts`), and `{next: null, maxPages:
// 5}` -- "keep reading, five pages" -- would then be a read of one page that
// nobody was told about. So any `maxPages` above one is more than one page,
// whatever else the value carries, and so is any scroll: a `scroll` mode or a
// `maxScrolls` bound, since scrolling is how a page shows more of itself.
//
// A one-page `paginate` -- `maxPages: 1`, which is what the picker records --
// is not: it reads the page the read was given, and the dispatch drops it.

/** Whether `paginate`, as written, asks a read to go through more than one page by itself. */
export function webAutomationExtractListPagesBeyondOne(paginate: unknown): boolean {
  if (typeof paginate !== "object" || paginate === null || Array.isArray(paginate)) return false;
  const written = paginate as Record<string, unknown>;
  if (written.mode === "scroll" || written.maxScrolls !== undefined) return true;
  return typeof written.maxPages === "number" && written.maxPages > 1;
}
