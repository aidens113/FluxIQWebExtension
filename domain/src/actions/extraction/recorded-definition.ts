// What the picker recorded: the extraction a user defined, as it may be stored
// in a recording (D3).
//
// **A recording carries no value read from the page.** That is the whole reason
// this module exists rather than the recorded event carrying what the picker
// sent. The picker runs in the page, and the object it hands the recorder is
// page-adjacent: a careless or compromised producer could put a sample row, a
// cell's text, or a whole page beside the fields the definition declares, and a
// recording is persisted, replayed, shown and exported. So the definition is
// **rebuilt field by field** here, and only the fields below survive. An unknown
// key is not refused, it is simply never copied -- refusing would make a
// producer's extra key break recording, while copying it would be the leak.
//
// What does survive is structure, never content:
//
// - selectors, the item selector and each field's, which name where a value is
//   read rather than what was read;
// - field **keys**, checked against the one key rule (D16) so a key cannot be a
//   sentence of page text;
// - field **labels**, which are a column's header or the name the user gave it.
//   D16 settles that a column header is page structure rather than a sample
//   value, and `docs/architecture/sensitive-values.md` says so;
// - counts, and the dataset's own id and name.
//
// The request itself is read by `webAutomationExtractListRequestValue`, which
// copies field by field on the same principle. Its field specs may carry an
// element fingerprint, which does hold the element's text and value -- that is
// why a *proposal* (`extraction/proposal.ts`) cannot carry one, and why a
// recorded definition may: by then the user has seen the columns and chosen
// which to exclude.

import type { JsonObject } from "fluxiq/core";
import { isWebAutomationExtractFieldKey } from "./field-key";
import { webAutomationExtractListRequestValue, webAutomationExtractReadValue } from "./read-request";
import type { WebAutomationExtractListRequest, WebAutomationExtractRead } from "./request";

/**
 * Core's bound on a dataset id, restated because the domain must refuse one
 * Core would (`datasetIdPattern`, `record-sets/output.ts` in Core's contracts).
 * Core also refuses `.` and `..`, which name a directory rather than a dataset.
 */
const DATASET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/u;

const RESERVED_DATASET_IDS: ReadonlySet<string> = new Set([".", ".."]);

/** Core's bound on a dataset label and a field label (`labelMaxLength`, the same file). */
const LABEL_MAX_LENGTH = 200;

/** A list extraction the user recorded: the request to run, and what to save its records as. */
export type WebAutomationRecordedListExtraction = {
  form: "list";
  /** The dataset the records are saved into, from `webAutomationDatasetId`. */
  datasetId: string;
  /** The name the user saved the dataset under. Never page text. */
  label: string;
  request: WebAutomationExtractListRequest;
  /** The human column name beside each field key: a column header, or the name the user gave it. */
  fieldLabels: Record<string, string>;
  /** How many items the list held when it was recorded. */
  itemCount: number;
};

/** A single-value extraction the user recorded. It saves no dataset: one value is not a list of records. */
export type WebAutomationRecordedValueExtraction = {
  form: "value";
  /** What the user called the value. Never the value itself. */
  label: string;
  read: WebAutomationExtractRead;
};

export type WebAutomationRecordedExtraction = WebAutomationRecordedListExtraction | WebAutomationRecordedValueExtraction;

/**
 * The recorded definition, rebuilt field by field, or `undefined` when what was
 * sent is not one.
 *
 * No sample value and no unknown key survives (D3). Every field key is checked
 * against the domain key rule and the dataset id against Core's, so a definition
 * this returns cannot make Core refuse the whole candidate at approval.
 */
export function webAutomationRecordedExtraction(value: unknown): WebAutomationRecordedExtraction | undefined {
  const definition = jsonObject(value);
  if (!definition) return undefined;
  if (definition.form === "value") return recordedValueExtraction(definition);
  return definition.form === "list" ? recordedListExtraction(definition) : undefined;
}

function recordedListExtraction(definition: JsonObject): WebAutomationRecordedListExtraction | undefined {
  const datasetId = datasetIdValue(definition.datasetId);
  const label = labelValue(definition.label);
  const request = webAutomationExtractListRequestValue(definition.request);
  const itemCount = nonNegativeInteger(definition.itemCount);
  if (datasetId === undefined || label === undefined || request === undefined || itemCount === undefined) return undefined;
  const fieldLabels = fieldLabelsValue(definition.fieldLabels, request);
  if (fieldLabels === undefined) return undefined;
  return { form: "list", datasetId, label, request, fieldLabels, itemCount };
}

function recordedValueExtraction(definition: JsonObject): WebAutomationRecordedValueExtraction | undefined {
  const label = labelValue(definition.label);
  const read = webAutomationExtractReadValue(definition.read);
  return label === undefined || read === undefined ? undefined : { form: "value", label, read };
}

/**
 * The human name of each column, keyed by the field key it belongs to.
 *
 * A label for a field the request does not read is dropped: it names no column,
 * and carrying it would let a producer attach text to a key that was excluded
 * from the request. A label that is sent but is not a usable one refuses the
 * whole definition, as an unreadable request property does -- a column silently
 * falling back to its key is a worse answer than recording nothing.
 */
function fieldLabelsValue(value: unknown, request: WebAutomationExtractListRequest): Record<string, string> | undefined {
  if (value === undefined) return {};
  const labels = jsonObject(value);
  if (!labels) return undefined;
  const read: [string, string][] = [];
  for (const [key, entry] of Object.entries(labels)) {
    if (!isWebAutomationExtractFieldKey(key) || !(key in request.fields)) continue;
    const label = labelValue(entry);
    if (label === undefined) return undefined;
    read.push([key, label]);
  }
  return Object.fromEntries(read);
}

/** An id Core will accept as a dataset key, and nothing else. */
function datasetIdValue(value: unknown): string | undefined {
  return typeof value === "string" && !RESERVED_DATASET_IDS.has(value) && DATASET_ID_PATTERN.test(value) ? value : undefined;
}

/** A name a person reads: non-blank, and within Core's label bound so a schema built from it parses. */
function labelValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= LABEL_MAX_LENGTH ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
