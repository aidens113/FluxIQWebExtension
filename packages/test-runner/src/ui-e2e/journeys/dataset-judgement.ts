// The stored answer of one Flow run, read from Core and judged against the
// scenario's record oracle.
//
// Core's run datasets are the only place a run's extracted records exist
// (`flow-lane/run-datasets.ts`), so this is where an extraction journey is
// decided: `matchedRecords` against `expectedRecords`, from
// `run-expectations/extraction/judgement.ts`, never a count of rows that came
// back. The result carries counts and a digest only. The digest is the one
// `lab replay` publishes -- SHA-256 of the rows in Core's order, each record's
// keys sorted -- so two runs with equal digests stored the same answer.
import { createHash } from "node:crypto";
import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { type FlowRunDataset, readRunDatasets, type RunDatasetControl, runDatasetSummaries } from "../../flow-lane/index.js";
import { type ExtractedValueContext, type ExtractionRecord, measureExtraction } from "../../run-expectations/index.js";

/** The domain the demo project is bound to; Core refuses a dataset read with no scope. */
const DEMO_PROJECT_DOMAIN = "web-automation";

export type DatasetJudgement = Readonly<{
  datasetId: string;
  expectedRecords: number;
  observedRecords: number;
  matchedRecords: number;
  /** Records matched when position is set aside; `null` where the measurement could not pair them. */
  matchedInAnyOrder: number | null;
  expectedFields: number;
  presentFields: number;
  unexpectedFields: number;
  nonStringValues: number;
  storeTruncated: boolean;
  invalidCount: number;
  /** Stored schema fields, in order: the columns a preview of this dataset shows. */
  fieldCount: number;
  sha256: string;
}>;

/** The one dataset the run stored and its records, read whole. Fails `extraction.dataset_count` unless the run stored exactly one. */
export async function readSingleRunDataset(control: RunDatasetControl, input: { projectId: string; runId: string }): Promise<FlowRunDataset & { fieldCount: number }> {
  const payload = asRecord(await control.automationStudioCall("get-flow-run-detail", { projectId: input.projectId, runId: input.runId }));
  const detail = asRecord(payload.runDetail);
  const summaries = runDatasetSummaries(detail);
  if (summaries.length !== 1) {
    throw new RunnerFailure("runtime.behavior", "The extraction run did not store exactly one dataset", { details: { reasonCode: "extraction.dataset_count", datasetCount: summaries.length } });
  }
  const [dataset] = await readRunDatasets(control, { projectId: input.projectId, runId: input.runId, domainId: DEMO_PROJECT_DOMAIN, summaries });
  // The schema is read once more for its field count: `readRunDatasets` rebuilds
  // each record over it but does not return it, and the panel's preview has one
  // column per schema field.
  const page = asRecord(await control.automationStudioCall("get-run-dataset-page", { projectId: input.projectId, runId: input.runId, datasetId: dataset!.datasetId, limit: 1, cursor: null }, {}, DEMO_PROJECT_DOMAIN));
  const schema = asRecord(page.dataset).schema;
  const fields = schema && typeof schema === "object" ? (schema as { fields?: unknown }).fields : undefined;
  return { ...dataset!, fieldCount: Array.isArray(fields) ? fields.length : 0 };
}

/**
 * Judges `dataset` against the oracle entry. Passes only when every expected
 * record matched at its position and the run stored no more and no fewer,
 * with no value Core could not carry as text and nothing dropped or refused by
 * Core's store.
 */
export function judgeStoredDataset(dataset: FlowRunDataset & { fieldCount: number }, entry: ExpectedExtraction, context: ExtractedValueContext): DatasetJudgement {
  const measured = measureExtraction(entry, dataset.records, { nonStringValues: dataset.nonStringValues }, context);
  return {
    datasetId: dataset.datasetId,
    expectedRecords: measured.expectedRecords,
    observedRecords: measured.observedRecords,
    matchedRecords: measured.matchedRecords,
    matchedInAnyOrder: measured.matchedInAnyOrder,
    expectedFields: measured.expectedFields,
    presentFields: measured.presentFields,
    unexpectedFields: measured.unexpectedFields,
    nonStringValues: dataset.nonStringValues,
    storeTruncated: dataset.storeTruncated,
    invalidCount: dataset.invalidCount,
    fieldCount: dataset.fieldCount,
    sha256: datasetDigest(dataset.records),
  };
}

/** The closed reason a judgement fails for, or `undefined` when it passes. */
export function datasetJudgementFailure(judgement: DatasetJudgement): string | undefined {
  if (judgement.matchedRecords !== judgement.expectedRecords) return "extraction.records_mismatch";
  if (judgement.observedRecords !== judgement.expectedRecords) return "extraction.record_count_mismatch";
  if (judgement.nonStringValues > 0) return "extraction.non_string_values";
  if (judgement.storeTruncated || judgement.invalidCount > 0) return "extraction.store_incomplete";
  return undefined;
}

/** Throws the judgement's closed failure, carrying its counts and never a value. */
export function assertDatasetJudgement(judgement: DatasetJudgement): void {
  const reasonCode = datasetJudgementFailure(judgement);
  if (reasonCode === undefined) return;
  const { datasetId: _datasetId, sha256: _sha256, ...counts } = judgement;
  throw new RunnerFailure("runtime.behavior", `The stored dataset did not answer the record oracle (${reasonCode})`, { details: { reasonCode, ...counts } });
}

/** The rows as canonical JSON (rows in Core's order, each record's keys sorted), hashed: `lab replay`'s dataset digest. */
export function datasetDigest(records: readonly ExtractionRecord[]): string {
  const canonical = records.map(record => Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]])));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunnerFailure("runtime.behavior", "Core returned a run dataset answer that is not an object");
  return value as Record<string, unknown>;
}
