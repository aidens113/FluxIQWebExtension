// Reviewing the columns the extension's picker proposed, the way a person does
// it: look at the preview, keep the columns that hold what they want under the
// names they want, and remove the rest.
//
// "What they want" is the scenario's own record oracle. A column is kept for an
// oracle field when every previewed row shows that field's expected value, with
// equality decided by `extractedValueMatches`, the one rule every judge of
// extracted records uses. The comparison happens in memory; nothing here writes
// a previewed value anywhere. A column the picker marked sensitive opened
// excluded and stays excluded: it is never read, so it is left as it is (D12).
//
// Keeping the right columns does not pass the journey. The stored dataset of a
// separate deterministic run is judged against the full oracle afterwards; this
// only decides what the recording asks the page for.
import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { RunnerFailure } from "../../failure.js";
import { type ExtractedValueContext, type ExtractionRecord, extractedValueMatches } from "../../run-expectations/index.js";

/** One proposed column as the review panel shows it. `sourceKey` is the proposal's key and never changes. */
export type PickedColumn = Readonly<{ sourceKey: string; label: string; included: boolean }>;

/** What the review does: which columns take which oracle field's name, and which are removed. */
export type FieldReviewPlan = Readonly<{
  kept: readonly Readonly<{ sourceKey: string; field: string }>[];
  removed: readonly string[];
  /** Oracle fields, required by the expectation, that no previewed column held. Manifest names, never page text. */
  unmatchedFields: readonly string[];
}>;

/** The counts a review leaves behind; no label, key or value. */
export type FieldReviewSummary = Readonly<{
  proposedFields: number;
  includedFields: number;
  excludedFields: number;
  previewRows: number;
  keptFields: number;
  renamedFields: number;
  removedFields: number;
}>;

/**
 * Decides the review from the proposal, its preview and the oracle.
 *
 * `previewRows[i][c]` is the i-th previewed item's value in the c-th *included*
 * column, `null` where the panel showed the column empty; the preview shows
 * included columns only, in proposal order. Rows are compared to the oracle by
 * position, as the judgement compares them. Each oracle field takes the first
 * included column not already taken whose every previewed value matches. A
 * field `optionalFields` names may go unmatched; any other is reported. With
 * no previewed row there is nothing to decide by, and every required field is
 * unmatched.
 */
export function planFieldReview(input: {
  columns: readonly PickedColumn[];
  previewRows: readonly (readonly (string | null)[])[];
  expected: readonly ExtractionRecord[];
  optionalFields?: readonly string[];
  context?: ExtractedValueContext;
}): FieldReviewPlan {
  const included = input.columns.filter(column => column.included);
  const compared = Math.min(input.previewRows.length, input.expected.length);
  const optional = new Set(input.optionalFields ?? []);
  const fields = [...new Set(input.expected.flatMap(record => Object.keys(record)))];
  const taken = new Set<number>();
  const kept: Array<{ sourceKey: string; field: string }> = [];
  const unmatchedFields: string[] = [];
  for (const field of fields) {
    const at = compared === 0 ? -1 : included.findIndex((_column, index) => !taken.has(index)
      && input.previewRows.slice(0, compared).every((row, position) => extractedValueMatches(input.expected[position]![field] ?? null, row[index] ?? null, input.context)));
    if (at < 0) {
      if (!optional.has(field)) unmatchedFields.push(field);
      continue;
    }
    taken.add(at);
    kept.push({ sourceKey: included[at]!.sourceKey, field });
  }
  const removed = included.filter((_column, index) => !taken.has(index)).map(column => column.sourceKey);
  return { kept, removed, unmatchedFields };
}

/**
 * Reads the proposal and its preview off the extension's review panel, plans
 * the review against `expected`, and carries it out through the panel's own
 * controls: a rename is typed into the column's name box, a removal is its
 * Remove button. Fails with a closed code when the preview disagrees with the
 * columns or an oracle field has no column.
 */
export async function reviewPickedFields(extensionPage: Page, evidence: BrowserEvidenceRecorder, input: { expected: readonly ExtractionRecord[]; optionalFields?: readonly string[]; context: ExtractedValueContext }): Promise<FieldReviewSummary> {
  const columns = await readPickedColumns(extensionPage);
  const previewRows = await readPreviewRows(extensionPage);
  const includedFields = columns.filter(column => column.included).length;
  const headerCount = await extensionPage.locator("#extractionPreviewHead th").count();
  if (headerCount !== includedFields) {
    throw reviewFailure("extraction.preview_columns_mismatch", "The extraction preview does not show one column per included field", { includedFields, previewColumns: headerCount });
  }
  const plan = planFieldReview({ columns, previewRows, expected: input.expected, ...(input.optionalFields ? { optionalFields: input.optionalFields } : {}), context: input.context });
  const counts = { proposedFields: columns.length, includedFields, excludedFields: columns.length - includedFields, previewRows: previewRows.length };
  await evidence.diagnostic("extension", "extraction-field-review-plan", "ui-e2e.extraction.field-review", { ...counts, keptFields: plan.kept.length, removedFields: plan.removed.length, unmatchedFields: plan.unmatchedFields.length });
  if (plan.unmatchedFields.length > 0) {
    throw reviewFailure("extraction.field_unavailable", "The picker proposed no column holding an oracle field", { ...counts, unmatchedFields: plan.unmatchedFields });
  }
  let renamedFields = 0;
  for (const { sourceKey, field } of plan.kept) {
    const label = columnRow(extensionPage, sourceKey).locator(".extraction-field-label");
    if (await label.inputValue() === field) continue;
    await evidence.step("extension", "extraction-field-rename", "Name a kept column after the field it holds", async () => {
      await label.fill(field);
      await label.dispatchEvent("change");
    });
    await waitForLabel(extensionPage, sourceKey, field);
    renamedFields += 1;
  }
  for (const sourceKey of plan.removed) {
    await evidence.step("extension", "extraction-field-remove", "Remove a column the task does not want", () => columnRow(extensionPage, sourceKey).locator(".extraction-field-remove").click());
    await columnRow(extensionPage, sourceKey).waitFor({ state: "detached", timeout: 5_000 });
  }
  const includedAfterReview = (await readPickedColumns(extensionPage)).filter(column => column.included).length;
  if (includedAfterReview !== plan.kept.length) {
    throw reviewFailure("extraction.review_not_applied", "The review panel did not keep exactly the reviewed columns", { ...counts, keptFields: plan.kept.length, includedAfterReview });
  }
  return { ...counts, keptFields: plan.kept.length, renamedFields, removedFields: plan.removed.length };
}

async function readPickedColumns(page: Page): Promise<PickedColumn[]> {
  return page.locator("#extractionFields .extraction-field").evaluateAll(rows => rows.map(row => ({
    sourceKey: (row as HTMLElement).dataset.field ?? "",
    label: (row.querySelector(".extraction-field-label") as HTMLInputElement | null)?.value ?? "",
    included: (row.querySelector('input[type="radio"][value="include"]') as HTMLInputElement | null)?.checked === true,
  })));
}

async function readPreviewRows(page: Page): Promise<Array<Array<string | null>>> {
  return page.locator("#extractionPreviewBody tr").evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll("td"), cell => (
    cell.classList.contains("extraction-preview-empty") ? null : cell.textContent ?? ""
  ))));
}

function columnRow(page: Page, sourceKey: string) {
  return page.locator(`#extractionFields .extraction-field[data-field="${sourceKey.replace(/["\\]/gu, character => `\\${character}`)}"]`);
}

async function waitForLabel(page: Page, sourceKey: string, field: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    // Read over every matching row at once: a row the panel is re-rendering is simply not there yet.
    const labels = await columnRow(page, sourceKey).locator(".extraction-field-label").evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
    if (labels.length === 1 && labels[0] === field) return;
    await page.waitForTimeout(50);
  }
  throw reviewFailure("extraction.review_not_applied", "The review panel did not keep a column's new name", {});
}

function reviewFailure(reasonCode: string, message: string, details: Readonly<Record<string, unknown>>): RunnerFailure {
  return new RunnerFailure("runtime.behavior", message, { details: { reasonCode, ...details } });
}
