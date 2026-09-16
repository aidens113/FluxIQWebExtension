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
import type { ExtractionPreviewRow } from "./messages";

/** The columns whose values may be shown: included, and never excluded or re-read since the preview was taken. */
export function extractionPreviewColumns(draft: ExtractionDraft): ExtractionFieldRow[] {
  return draft.fields.filter((field) => field.handling === "include" && !field.stale);
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
