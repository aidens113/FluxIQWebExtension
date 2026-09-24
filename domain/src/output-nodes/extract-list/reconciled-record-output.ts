// An authored record output, holding the two things only the extraction beside
// it can know: what the rows carry, and where they are.
//
// **Why this exists.** On 2026-09-23 a Flow built from an instruction replayed
// every step, read the store's search results, produced exactly the sixteen
// rows the task expected -- and stored none of them. Core's own arithmetic
// reported `core.result.every_record_refused`: "16 rows were refused, 0 stored,
// across 1 record set" (`test-runs/run-mueqynzb-ac54aab9`). The rows were
// right. The schema they were validated against was not.
//
// Core's Flow Bootstrap shows a model this node's `recordOutput` parameter with
// the whole record-set contract and a worked example -- `{datasetId, schema:
// {fields: [{id, label, valueType}]}, writeMode}` -- and lists the value types
// it may choose from, `number` among them
// (`flow-bootstrap/plan/record-output-contract.ts`). It also reads `dataset`,
// `records` and `save` as names for that same parameter
// (`flow-bootstrap/authoring/matching.ts`). So a model asked for "a table with
// columns name, price, rating and url" writes one, and gives the columns the
// types a person would: price and rating as numbers.
//
// A page cannot hand back a number. `web.dom.extract_list` reads text -- a
// price reads `$79.99`, a rating reads `3.7` -- and a `link` field reads an
// absolute URL. Core's record validation refuses a row whose cell is the wrong
// type, so **every** row failed, the dataset stored nothing, and the node still
// reported success, because the page had done exactly what it was asked. The
// same total loss follows from an authored schema whose field ids are not the
// keys the field map reads: every required column is then absent from every
// row.
//
// **So the field map declares the columns, and the author keeps the rest.**
// Only the field map knows what the rows will carry -- which columns there
// are, what each one reads, and whether the page could read it in every item --
// and `./record-output.ts` already turns it into a schema. Everything else an
// author wrote stays exactly as they wrote it, including a key the record-set
// parser does not take, so a malformed record output is still refused at
// dispatch with its own code rather than quietly rebuilt.
//
// The records path is the node's own (CD19) whatever an author wrote, for the
// same reason: the node knows where its rows are, the catalog tells a model to
// leave it out, and a path naming anywhere else can only find nothing.
//
// A field's **label** is the one part of the schema an author does decide, and
// it is kept: a recording's own record output carries the names the user gave
// their columns (`domain/src/web-panel-host.ts`), and reconciling must leave a
// recorded Flow exactly as it was.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../actions/extraction";
import { webAutomationRecordOutput } from "./record-output";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "./records-path";

/**
 * The dataset name the schema builder is handed. Only its `schema` is taken --
 * the author's own `datasetId` and `label` are already on the value being
 * reconciled -- but the builder requires both, and a placeholder that says so
 * is better than passing the author's and implying they were used.
 */
const SCHEMA_ONLY = "schema-only";

/**
 * The record output the node saves under: the author's, with the columns the
 * extraction reads and the records path the node supplies.
 *
 * A value that is not an object is handed back untouched, so the dispatch's
 * parse refuses it with its own codes as it always did.
 */
export function webAutomationReconciledRecordOutput(authored: JsonValue, request: WebAutomationExtractListRequest): JsonValue {
  if (!isJsonObject(authored)) return authored;
  const schema = webAutomationRecordOutput({
    datasetId: SCHEMA_ONLY,
    label: SCHEMA_ONLY,
    request,
    fieldLabels: authoredFieldLabels(isJsonObject(authored.schema) ? authored.schema : undefined)
  }).schema;
  return { ...authored, schema: schema as unknown as JsonValue, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH };
}

/**
 * What the author called each column, by the field key it belongs to.
 *
 * An id the field map does not read contributes nothing: there is no column of
 * that name to label. `webAutomationRecordOutput` bounds each label and makes
 * it distinct, so a schema that named two columns the same is disambiguated
 * rather than refused by Core.
 */
function authoredFieldLabels(schema: JsonObject | undefined): Record<string, string> {
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  const labels: Record<string, string> = {};
  for (const field of fields) {
    if (!isJsonObject(field)) continue;
    const id = nonEmptyString(field.id);
    const label = nonEmptyString(field.label);
    if (id !== undefined && label !== undefined && !Object.hasOwn(labels, id)) labels[id] = label;
  }
  return labels;
}

function nonEmptyString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
