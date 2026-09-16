// Which columns the confirmation preview may show, and what the panel is
// allowed to keep in memory while it is open.
//
// This is where D12 is enforced rather than merely displayed. `retain` is
// applied to the rows the panel holds on **every** edit, and it rebuilds each
// row from the keys that survive, so a column the user excludes is not hidden
// from the table -- its values are gone from the object the panel holds before
// the next render runs. Nothing can then re-reveal them, and nothing can carry
// them into the confirm payload.

import type { ExtractionDraft, ExtractionFieldRow } from "./view-model";
import type { ExtractionPreviewColumn, ExtractionPreviewRow } from "./messages";

/** The columns whose values may be shown: included, and never excluded or re-read since the preview was taken. */
export function extractionPreviewColumns(draft: ExtractionDraft): ExtractionFieldRow[] {
  return draft.fields.filter((field) => field.handling === "include" && !field.stale);
}

/**
 * What the panel tells the background worker to read the preview under, so the
 * two halves hold the same columns rather than only displaying the same ones.
 *
 * Dropping a column's values from the panel is half the promise; the other half
 * is that the page is not asked for them again. Every column the panel may not
 * show -- excluded, or stale because its read changed -- is named here as
 * `exclude`, so the worker's re-read leaves it out of the request entirely
 * (D12) and the rows it stores lose it too.
 *
 * The key is the field's `sourceKey`: the proposal's own key, which is what a
 * preview row is keyed by and what the worker matches the proposal on. The
 * record key the confirm payload derives from the user's label is a different
 * name for the same column and would match nothing here.
 */
export function extractionPreviewSelection(draft: ExtractionDraft): ExtractionPreviewColumn[] {
  const shown = new Set(extractionPreviewColumns(draft).map((field) => field.sourceKey));
  return draft.fields.map((field) => ({ key: field.sourceKey, handling: shown.has(field.sourceKey) ? "include" : "exclude" }));
}

/** `rows` rebuilt to hold only those columns' values, dropping every other key rather than hiding it. */
export function retainExtractionPreview(rows: readonly ExtractionPreviewRow[], draft: ExtractionDraft): ExtractionPreviewRow[] {
  const keys = extractionPreviewColumns(draft).map((field) => field.sourceKey);
  return rows.map((row) => {
    const kept: ExtractionPreviewRow = {};
    for (const key of keys) if (key in row) kept[key] = row[key] ?? null;
    return kept;
  });
}
