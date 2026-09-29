// Where a paged list is, in words, and which way it can move. Shared by the
// Activity and Recordings tabs. Core does not always say how many recordings
// there are, so an unknown total reads as "Page 2", and Next stays available
// while a page comes back full.

/** The pager's label and which of its buttons are live. */
export type PageCount = { readonly label: string; readonly hasPrevious: boolean; readonly hasNext: boolean };

/** Describes page `page` of `pageSize` rows, `shown` of which came back, out of `total` when known. */
export function pageCount(input: { page: number; pageSize: number; shown: number; total?: number | undefined }): PageCount {
  const page = Math.max(1, Math.floor(input.page) || 1);
  const hasPrevious = page > 1;
  if (input.total === undefined) {
    return { label: `Page ${page}`, hasPrevious, hasNext: input.shown >= input.pageSize };
  }
  const pages = Math.max(1, Math.ceil(input.total / Math.max(1, input.pageSize)));
  return { label: `Page ${Math.min(page, pages)} of ${pages}`, hasPrevious, hasNext: page < pages };
}
