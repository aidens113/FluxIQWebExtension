import type { ElementHandle, Locator } from "@playwright/test";
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

/** How long a followed `next` may take to replace the page it was clicked on, when the step names no `timeoutMs`. */
const PAGE_ADVANCE_TIMEOUT_MS = 15_000;
const PAGE_ADVANCE_POLL_MS = 50;

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
 * Reads the records an extract step names. A field whose element is absent is
 * left out of its record rather than read as empty text.
 *
 * Without `pagination` it reads the current page and never clicks. With it, the
 * step pages the way a user does: it reads a page, clicks `pagination.next` as
 * trusted input, waits until the page it read has been replaced, and reads
 * again, until `next` is absent or `maxPages` pages, the first included, were
 * read. The extension records those clicks, so the recording holds the
 * navigation a paginated workflow's final state describes, and a Flow built
 * from it replays that navigation. This reader used to stop at the first page
 * and leave following `next` to the Flow, but a recording's extract step yields
 * no extract node, so nothing followed it: W05's and W07's final state, page 3
 * of 3, failed on both lanes before any Flow existed.
 *
 * Only `next` pagination is followed, whether `mode` names it or is absent. Any
 * other mode fails the step as `fixture.invalid` before a page is read, rather
 * than reading the first page as if it were the whole list.
 */
export async function extractRecords(scope: TargetScope, step: ScenarioStep): Promise<ExtractedRecord[]> {
  const fields = Object.entries(step.fields ?? {}).map(([name, spec]) => [name, parseExtractField(spec)] as const);
  if (!fields.length) throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} names no fields`);
  const itemTarget = parseScenarioTarget(step.target);
  const pagination = nextPagination(step);
  const nextTarget = pagination ? parseScenarioTarget(pagination.next) : undefined;
  const records: ExtractedRecord[] = [];
  for (let page = 1; ; page += 1) {
    const items = await locateTarget(scope, itemTarget).all();
    for (const item of items) records.push(await readRecord(item, fields));
    if (!pagination || !nextTarget || page >= pagination.maxPages) return records;
    const next = locateTarget(scope, nextTarget);
    if (await next.count() === 0) return records;
    await followNext(next, items[0] ?? next, step, page);
  }
}

/** The step's pagination when it follows `next`, which is the mode when `mode` is absent (D14). Any other mode has no reader here. */
function nextPagination(step: ScenarioStep): { next: string; maxPages: number } | undefined {
  const pagination = step.pagination;
  if (!pagination || pagination.mode === undefined || pagination.mode === "next") return pagination;
  throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} paginates by ${pagination.mode}, and the Lab's extract reader follows only next`, { details: { stepId: step.id, mode: pagination.mode } });
}

async function readRecord(item: Locator, fields: ReadonlyArray<readonly [string, ExtractField]>): Promise<ExtractedRecord> {
  const record: ExtractedRecord = {};
  for (const [name, field] of fields) {
    const value = await readField(item, field);
    if (value !== undefined) record[name] = value;
  }
  return record;
}

/**
 * Clicks `next`, then waits until `marker` -- the first item read on this page,
 * or `next` itself when the page had none -- has left the document. Reading
 * before then reads the page just read a second time: product-catalog keeps
 * its old results on screen for a fixed latency after Next for that reason.
 */
async function followNext(next: Locator, marker: Locator, step: ScenarioStep, page: number): Promise<void> {
  const timeoutMs = step.timeoutMs ?? PAGE_ADVANCE_TIMEOUT_MS;
  const handle = await marker.elementHandle({ timeout: timeoutMs });
  // Without a hold on the page just read, its replacement cannot be told from a second read of it.
  if (!handle) throw new RunnerFailure("runtime.behavior", `Extract step ${step.id} could not hold page ${page} before following next`, { details: { stepId: step.id, page } });
  try {
    await next.click({ timeout: timeoutMs });
    const deadline = Date.now() + timeoutMs;
    while (await stillAttached(handle)) {
      if (Date.now() >= deadline) {
        throw new RunnerFailure("runtime.behavior", `Extract step ${step.id} followed next from page ${page}, and that page was not replaced within ${timeoutMs} ms`, { details: { stepId: step.id, page, timeoutMs } });
      }
      await new Promise((resolve) => setTimeout(resolve, PAGE_ADVANCE_POLL_MS));
    }
  } finally {
    await handle.dispose().catch(() => undefined);
  }
}

/** A document that navigated away took the element with it, so an element whose context is gone has been replaced too. */
async function stillAttached(handle: ElementHandle<SVGElement | HTMLElement>): Promise<boolean> {
  return handle.evaluate((element) => element.isConnected).catch(() => false);
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
