import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control/index.js";
import type { ExtractionRecord } from "../run-expectations/index.js";

/**
 * Core's run datasets are the only place a Flow run's extracted records exist.
 *
 * An extract node's records never reach `get-flow-run-detail`: Core replaces an
 * attempt's captured rows with a `$dataset` marker before storing the trace
 * (Core `service/summaries/conversions.ts`, `datasetMarkerRecordCount`), so the
 * attempt carries `metadata.recordCount` and nothing else. The rows are in the
 * run's dataset store, and K5's `runDetail.datasets` plus K8's
 * `get-run-dataset-page` are how they are read. There is deliberately no
 * interim reader over the run detail (D16): a second reader would be a second
 * implementation of the same thing, and the one it duplicated could never
 * return a record at all.
 */

/** The one Core call this reader makes; `ExistingFluxIQControlClient` satisfies it. */
export type RunDatasetControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** K5's `AutomationStudioRunDatasetSummary`, narrowed to what the lane reads. Core's own fields, never page content. */
export type RunDatasetSummary = {
  datasetId: string;
  /** The nodes that wrote rows to this dataset during the run. */
  nodeIds: string[];
  recordCount: number;
  /** Core dropped rows past its per-run cap. **Not** the extraction's own `truncated`, which is the page's item cap. */
  storeTruncated: boolean;
  /** Rows Core's own record validation refused. */
  invalidCount: number;
};

/**
 * One run dataset, read whole.
 *
 * `records` are the stored rows rebuilt over the page's schema: every schema
 * field is present on every record, with `null` restored for one the row lacks
 * (D16 — Core stores an optional field the page could not read as an absent
 * key, and an expectation spells it `null`). Rebuilding beats copying the row,
 * because a row that lost a field silently would otherwise match an
 * expectation that omits it.
 *
 * `nonStringValues` counts the cells that were neither a string nor null,
 * never the values (D6). `pages` is how many pages of rows this reader read
 * from Core, which is Core's paging and has nothing to do with the pagination
 * the extraction followed on the page.
 */
export type FlowRunDataset = RunDatasetSummary & {
  records: ExtractionRecord[];
  nonStringValues: number;
  pages: number;
};

/** Core clamps a dataset page to 200 rows (CD20), so asking for more reads no faster and asking for fewer costs a round trip. */
const DATASET_PAGE_LIMIT = 200;
/** A cursor that never ends is Core misbehaving, not a large dataset: 200 pages is 40,000 rows, far past the 1,000-item extraction cap. */
const MAX_DATASET_PAGES = 200;

/**
 * The dataset summaries a run detail carries, or `[]` when it carries none.
 * Absent is how Core states that the run stored no dataset (Core
 * `storage/project/runtime-stream-store.ts`, `withRunDatasets`), so it is not
 * an error here; a workflow that expected an extraction fails on the
 * expectation instead, where the failure can name what was missing.
 */
export function runDatasetSummaries(detail: Record<string, unknown>): RunDatasetSummary[] {
  const datasets = Array.isArray(detail.datasets) ? detail.datasets : [];
  return datasets.flatMap((value): RunDatasetSummary[] => {
    const summary = optionalRecord(value);
    if (typeof summary?.datasetId !== "string" || !summary.datasetId) return [];
    return [{
      datasetId: summary.datasetId,
      nodeIds: (Array.isArray(summary.nodeIds) ? summary.nodeIds : []).filter((nodeId): nodeId is string => typeof nodeId === "string"),
      recordCount: wholeNumber(summary.recordCount),
      storeTruncated: summary.truncated === true,
      invalidCount: wholeNumber(summary.invalidCount),
    }];
  });
}

/**
 * Every row of every dataset the run stored, in the summaries' order.
 *
 * Each dataset is paged until Core reports no further cursor, so a dataset
 * larger than one page is read whole; stopping at the first page would have
 * made a paginated extraction look like a single-page one. A page whose
 * `nextCursor` repeats the cursor just used ends the read, because a cursor
 * that does not advance would otherwise loop forever.
 *
 * The rows read are compared against the summary's own `recordCount`: a reader
 * that silently returned fewer rows than Core says it stored would understate
 * an extraction and could turn a real record regression into a missing one.
 */
export async function readRunDatasets(
  control: RunDatasetControl,
  input: { projectId: string; runId: string; summaries: readonly RunDatasetSummary[] },
  bounds: FluxIQHttpOptions = {},
): Promise<FlowRunDataset[]> {
  const datasets: FlowRunDataset[] = [];
  for (const summary of input.summaries) datasets.push(await readDataset(control, input.projectId, input.runId, summary, bounds));
  return datasets;
}

async function readDataset(
  control: RunDatasetControl,
  projectId: string,
  runId: string,
  summary: RunDatasetSummary,
  bounds: FluxIQHttpOptions,
): Promise<FlowRunDataset> {
  const records: ExtractionRecord[] = [];
  let nonStringValues = 0;
  let cursor: string | null = null;
  let pages = 0;
  while (pages < MAX_DATASET_PAGES) {
    const payload = asRecord(
      await control.automationStudioCall("get-run-dataset-page", { projectId, runId, datasetId: summary.datasetId, limit: DATASET_PAGE_LIMIT, cursor }, bounds),
      "run dataset page payload",
    );
    const page = asRecord(payload.dataset, "run dataset page");
    pages += 1;
    const fields = schemaFieldIds(page.schema);
    for (const row of Array.isArray(page.rows) ? page.rows : []) {
      const read = recordOverSchema(row, fields);
      records.push(read.record);
      nonStringValues += read.nonStringValues;
    }
    const next = typeof page.nextCursor === "string" && page.nextCursor ? page.nextCursor : null;
    if (next === null || next === cursor) break;
    cursor = next;
  }
  if (records.length !== summary.recordCount) {
    throw new RunnerFailure("runtime.behavior", `Core stored ${summary.recordCount} record(s) for a run dataset and returned ${records.length}`, {
      details: { storedRecords: summary.recordCount, readRecords: records.length, pages },
    });
  }
  return { ...summary, records, nonStringValues, pages };
}

/**
 * The stored schema's field ids, in order. The stored schema holds no
 * `exclude` field (Core `record-sets/dataset.ts`), so a field excluded at
 * recording is not a field a row is missing — it is not part of the shape at
 * all, and restoring `null` for it would invent a value the expectation would
 * then have to carry.
 */
function schemaFieldIds(schema: unknown): string[] {
  const fields = optionalRecord(schema)?.fields;
  return (Array.isArray(fields) ? fields : []).flatMap((value) => {
    const id = optionalRecord(value)?.id;
    return typeof id === "string" && id ? [id] : [];
  });
}

/**
 * One stored row over the schema's fields: each field's string value, `null`
 * for one the row lacks or stored as null, and a count for every other type.
 *
 * A cell Core stored as a number, a boolean or an object is **left out of the
 * record and counted**, exactly as the run detail reader counted the values it
 * could not carry: a record that silently lost a value it did hold could match
 * an expectation that omits that field.
 *
 * A key the schema does not name is read rather than dropped, so it reaches
 * the measurement's `unexpectedFields` — a field the run produced and the
 * expectation never named is a difference to see, and counting it as a
 * non-string value instead would file it under the wrong defect.
 */
function recordOverSchema(row: unknown, fields: readonly string[]): { record: ExtractionRecord; nonStringValues: number } {
  const values = optionalRecord(row);
  if (!values) return { record: {}, nonStringValues: 1 };
  const record: ExtractionRecord = {};
  let nonStringValues = 0;
  const named = new Set(fields);
  for (const key of [...fields, ...Object.keys(values).filter((key) => !named.has(key))]) {
    const value = Object.hasOwn(values, key) ? values[key] : null;
    if (typeof value === "string") record[key] = value;
    else if (value === null || value === undefined) record[key] = null;
    else nonStringValues += 1;
  }
  return { record, nonStringValues };
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function asRecord(value: unknown, at: string): Record<string, unknown> {
  const record = optionalRecord(value);
  if (!record) throw new RunnerFailure("runtime.behavior", `${at} must be an object`);
  return record;
}
function wholeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}
