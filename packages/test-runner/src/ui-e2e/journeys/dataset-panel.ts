// What the panel shows of a run's stored dataset: Runtime Debug's "Run
// datasets" region, its row preview, and the CSV and JSON exports.
//
// The preview is checked against the rows Core stored, cell by cell, in
// memory: the table's columns are the stored schema's fields in order and an
// absent value renders as "-" (Core `datasets/RunDatasetTable.tsx`). Only
// counts and a yes/no leave this module; a cell, a header or an export body is
// never written anywhere. The exports are downloaded through the panel's own
// buttons, so what is measured is the file a person would receive.
import { readFile, stat } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { RunnerFailure } from "../../failure.js";
import type { ExtractionRecord } from "../../run-expectations/index.js";

export type DatasetPanelResult = Readonly<{
  storedDatasets: number;
  previewRows: number;
  previewFields: number;
  csvBytes: number;
  jsonBytes: number;
  jsonRows: number;
}>;

const PANEL_TIMEOUT_MS = 30_000;

/**
 * Opens the run's one stored dataset in Runtime Debug, requires its preview to
 * equal `stored`, and downloads both exports. The Action Log of the run must
 * already be on screen: a panel-started run lands there without a reload.
 */
export async function verifyRunDatasetPanel(panelPage: Page, evidence: BrowserEvidenceRecorder, stored: { records: readonly ExtractionRecord[]; fieldCount: number }): Promise<DatasetPanelResult> {
  const region = panelPage.getByRole("region", { name: "Run datasets" });
  if (!await region.waitFor({ state: "visible", timeout: PANEL_TIMEOUT_MS }).then(() => true, () => false)) {
    throw panelFailure("panel.datasets_not_shown", "Runtime Debug did not show the run's datasets after the run", {});
  }
  await region.getByText("1 stored", { exact: true }).waitFor({ state: "visible", timeout: PANEL_TIMEOUT_MS }).catch(() => {
    throw panelFailure("panel.dataset_count", "Runtime Debug did not list exactly one stored dataset", {});
  });
  const buttons = region.getByRole("group", { name: "Stored datasets" }).getByRole("button");
  const storedDatasets = await buttons.count();
  if (storedDatasets !== 1) throw panelFailure("panel.dataset_count", "Runtime Debug did not list exactly one stored dataset", { storedDatasets });
  await evidence.step("panel", "dataset-open", "Open the run's stored dataset", () => buttons.first().click());
  const expectedRows = stored.records.length;
  const settled = await panelPage.waitForFunction(({ rows, fields }) => {
    const table = document.querySelector('[aria-label="Run datasets"] table');
    return table?.querySelectorAll("tbody tr").length === rows && table.querySelectorAll("thead th").length === fields;
  }, { rows: expectedRows, fields: stored.fieldCount }, { timeout: PANEL_TIMEOUT_MS }).then(() => true, () => false);
  const table = region.locator("table");
  const previewRows = await table.locator("tbody tr").count();
  const previewFields = await table.locator("thead th").count();
  if (!settled) throw panelFailure("panel.preview_shape", "The dataset preview did not show one row per stored record and one column per stored field", { previewRows, previewFields, storedRows: expectedRows, storedFields: stored.fieldCount });
  const cells = await table.locator("tbody tr").evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll("td"), cell => cell.textContent ?? "")));
  const mismatchedRows = cells.filter((row, index) => !previewRowMatches(row, stored.records[index]!, stored.fieldCount)).length;
  if (mismatchedRows > 0) throw panelFailure("panel.preview_mismatch", "The dataset preview does not show the rows Core stored", { previewRows, mismatchedRows });
  const csvBytes = (await downloadExport(panelPage, region, evidence, "Export CSV", ".csv")).bytes;
  const json = await downloadExport(panelPage, region, evidence, "Export JSON", ".json");
  const jsonRows = jsonExportRows(json.body);
  if (jsonRows !== expectedRows) throw panelFailure("export.json_rows", "The JSON export does not hold one object per stored record", { jsonBytes: json.bytes, storedRows: expectedRows, jsonArray: jsonRows >= 0 });
  return { storedDatasets, previewRows, previewFields, csvBytes, jsonBytes: json.bytes, jsonRows };
}

/** How many rows a JSON export holds: Core writes an array of row objects. `-1` when it is JSON but not an array; not JSON fails. */
export function jsonExportRows(body: string): number {
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch (cause) { throw new RunnerFailure("runtime.behavior", "The JSON export is not JSON", { cause, details: { reasonCode: "export.json_unparseable" } }); }
  return Array.isArray(parsed) ? parsed.length : -1;
}

/**
 * Whether one preview row shows `record`: the stored schema's fields are the
 * record's first `fieldCount` keys, in order (`readRunDatasets` rebuilds each
 * record over the schema), and the table writes an absent value as "-".
 */
export function previewRowMatches(cells: readonly string[], record: ExtractionRecord, fieldCount: number): boolean {
  const keys = Object.keys(record).slice(0, fieldCount);
  if (cells.length !== keys.length) return false;
  return keys.every((key, index) => cells[index] === (record[key] ?? "-"));
}

async function downloadExport(page: Page, region: Locator, evidence: BrowserEvidenceRecorder, label: "Export CSV" | "Export JSON", suffix: ".csv" | ".json"): Promise<{ bytes: number; body: string }> {
  const code = suffix === ".csv" ? "export.csv_missing" : "export.json_missing";
  const download = await evidence.step("panel", suffix === ".csv" ? "dataset-export-csv" : "dataset-export-json", `Download the dataset through ${label}`, async () => {
    const pending = page.waitForEvent("download", { timeout: PANEL_TIMEOUT_MS });
    await region.getByRole("button", { name: label, exact: true }).click();
    return pending;
  }).catch(() => { throw panelFailure(code, `${label} produced no download`, {}); });
  const filePath = await download.path().catch(() => { throw panelFailure(code, `${label} produced a download that could not be saved`, {}); });
  if (!download.suggestedFilename().toLowerCase().endsWith(suffix)) throw panelFailure(code, `${label} produced no ${suffix} file`, {});
  const bytes = (await stat(filePath)).size;
  if (bytes <= 0) throw panelFailure(code, `${label} produced an empty file`, { bytes });
  return { bytes, body: suffix === ".json" ? await readFile(filePath, "utf8") : "" };
}

function panelFailure(reasonCode: string, message: string, details: Readonly<Record<string, unknown>>): RunnerFailure {
  return new RunnerFailure("runtime.behavior", message, { details: { reasonCode, ...details } });
}
