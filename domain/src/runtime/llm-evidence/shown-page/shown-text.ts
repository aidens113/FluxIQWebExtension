// The page text of a published page as a reader holds it (t1036): the text of
// its `pageView` -- every line's text joined by "\n", exactly as
// `../page-view/joined-text.ts` writes a view's text -- or, for a page published
// before keyed lines, as a stored state summary or a recorded result may be,
// its `page` string. Every domain reader that once read `page` reads through
// this, so it reads either form.
//
// It imports nothing: the extension's side panel reaches it through
// `../evidence-summary/` and must not bundle the page view's Node-only imports.

/** The page text `value` carries itself, or `undefined` when it carries none. */
export function webLlmShownPageText(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as { pageView?: unknown; page?: unknown };
  const view = record.pageView;
  if (typeof view === "object" && view !== null && Array.isArray((view as { lines?: unknown }).lines)) {
    const lines = (view as { lines: unknown[] }).lines;
    if (lines.every((line) => typeof line === "object" && line !== null && typeof (line as { text?: unknown }).text === "string")) {
      return lines.map((line) => (line as { text: string }).text).join("\n");
    }
  }
  return typeof record.page === "string" ? record.page : undefined;
}
