// The confirmation preview: the first few records the picked list would yield,
// read for the panel to show while the user chooses columns.
//
// This is the one extraction path that reads page values before anything is
// recorded, so three things bound it.
//
// - **The rows go to the extension's own UI and nowhere else** (decision D3).
//   They are not recorded, not stored, and not part of the definition the user
//   confirms; the background worker holds at most `limit` of them in memory and
//   drops them when the extraction is recorded.
// - **An excluded column is never read** (decision D12). The request arrives
//   without it -- the worker rebuilds the request whenever a column choice
//   changes rather than filtering rows afterwards -- so there is no value of an
//   excluded column anywhere in this path to withhold.
// - **The preview never moves the page.** Whatever the request says, the read
//   here is of the page as it stands: no `paginate`, so the user is looking at
//   the page they picked on when they confirm.
//
// `minItems` is 0 because an empty preview is a fact to show, not a failure --
// the verb's own minimum is checked when the extraction runs, not here.

import type { ExtractionPreviewRow } from "../../shared/extraction-messages";
import { EXTRACTION_PREVIEW_MAX_ROWS } from "../../shared/extraction-messages";
import { extractList } from "../extraction";
import type { WebAutomationExtractListRequest } from "../types";

/** How many rows a preview may hold. The worker's `EXTRACTION_PREVIEW_MAX_ROWS` is the same number. */
export const PICKER_PREVIEW_MAX_ROWS = EXTRACTION_PREVIEW_MAX_ROWS;

/**
 * The first rows `request` reads on this page, at most `limit` of them.
 *
 * Throws what `extractList` throws -- a request that reads no field, a `column`
 * field on items that are not table rows, a field that resolved to a sensitive
 * control -- which the caller answers as a refusal.
 */
export async function readPreviewRows(request: WebAutomationExtractListRequest, limit: number): Promise<ExtractionPreviewRow[]> {
  const outcome = await extractList({
    item: request.item,
    fields: request.fields,
    maxItems: previewBound(limit, request.maxItems),
    minItems: 0
  });
  return outcome.records;
}

function previewBound(limit: number, requested: number | undefined): number {
  const bounds = [PICKER_PREVIEW_MAX_ROWS, limit, requested].filter((bound): bound is number => typeof bound === "number" && Number.isFinite(bound) && bound > 0);
  return Math.min(...bounds);
}
