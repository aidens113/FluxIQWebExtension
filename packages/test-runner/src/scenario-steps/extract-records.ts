import type { Locator } from "@playwright/test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { locateTarget, type TargetScope } from "./locate-target.js";
import { parseScenarioTarget, type ScenarioTarget } from "./parse-target.js";

export type ExtractedRecord = Record<string, string>;

/**
 * One extract field. `column:<header>` reads the cell under that header when
 * items are table rows. Otherwise the field is a target, resolved like a step
 * target but inside the item (empty means the item itself), and an
 * `@attribute` suffix reads that attribute instead of the text.
 */
export type ExtractField =
  | { kind: "column"; header: string }
  | { kind: "element"; target?: ScenarioTarget; attribute?: string };

const ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;

export function parseExtractField(spec: string): ExtractField {
  if (spec.startsWith("column:")) {
    const header = normalizeText(spec.slice("column:".length));
    if (!header) throw new RunnerFailure("fixture.invalid", "Extract column field names no header");
    return { kind: "column", header };
  }
  const at = spec.lastIndexOf("@");
  const attribute = at < 0 ? undefined : spec.slice(at + 1);
  const hasAttribute = attribute !== undefined && ATTRIBUTE_NAME.test(attribute);
  const selector = hasAttribute ? spec.slice(0, at) : spec;
  return {
    kind: "element",
    ...(selector ? { target: parseScenarioTarget(selector) } : {}),
    ...(hasAttribute ? { attribute: attribute! } : {}),
  };
}

/**
 * Reads the records an extract step names from the current page only. It never
 * clicks, since a click would be recorded; following `pagination` is the Flow's
 * job, not the recording lane's. A field whose element is absent is left out of
 * its record rather than read as empty text.
 */
export async function extractRecords(scope: TargetScope, step: ScenarioStep): Promise<ExtractedRecord[]> {
  const fields = Object.entries(step.fields ?? {}).map(([name, spec]) => [name, parseExtractField(spec)] as const);
  if (!fields.length) throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} names no fields`);
  const items = await locateTarget(scope, parseScenarioTarget(step.target)).all();
  const records: ExtractedRecord[] = [];
  for (const item of items) {
    const record: ExtractedRecord = {};
    for (const [name, field] of fields) {
      const value = await readField(item, field);
      if (value !== undefined) record[name] = value;
    }
    records.push(record);
  }
  return records;
}

async function readField(item: Locator, field: ExtractField): Promise<string | undefined> {
  if (field.kind === "column") return readColumn(item, field.header);
  const element = field.target ? locateTarget(item, field.target).first() : item;
  if (!await element.count()) return undefined;
  if (field.attribute !== undefined) return (await element.getAttribute(field.attribute)) ?? undefined;
  return normalizeText((await element.textContent()) ?? "");
}

type PageCell = { tagName: string; textContent: string | null };
type PageRow = { tagName: string; cells: ArrayLike<PageCell>; closest(selector: string): { tHead: { rows: ArrayLike<PageRow> } | null; rows: ArrayLike<PageRow> } | null };

// Cells are matched by position among their row's cells; colspan is not modelled.
async function readColumn(item: Locator, header: string): Promise<string | undefined> {
  const result = await item.evaluate((element, wanted) => {
    const normalize = (text: string | null) => (text ?? "").replace(/\s+/gu, " ").trim();
    const row = element as unknown as PageRow;
    if (row.tagName !== "TR") return { kind: "not-a-row" as const };
    const table = row.closest("table");
    if (!table) return { kind: "not-a-row" as const };
    const headerRow = table.tHead?.rows[0] ?? Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell) => cell.tagName === "TH"));
    const index = headerRow ? Array.from(headerRow.cells).findIndex((cell) => normalize(cell.textContent) === wanted) : -1;
    if (index < 0) return { kind: "no-header" as const };
    const cell = row.cells[index];
    return cell ? { kind: "cell" as const, text: normalize(cell.textContent) } : { kind: "no-cell" as const };
  }, header);
  if (result.kind === "not-a-row") throw new RunnerFailure("fixture.invalid", "A column field needs extract items that are table rows");
  if (result.kind === "no-header") throw new RunnerFailure("runtime.behavior", "Extract column header was not found", { details: { header } });
  return result.kind === "cell" ? result.text : undefined;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
