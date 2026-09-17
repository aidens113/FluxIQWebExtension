// The dataset an extraction node saves into when its author named none.
//
// A Flow built from an instruction authors the extraction -- which items, which
// fields, how to page -- and not a dataset schema, which would only restate the
// field map in Core's vocabulary. So the schema is derived from the field map by
// the same builder a recording uses (`./record-output.ts`), and the model never
// has to write it.
//
// **The id is a pure function of the extraction.** The node's implementation is
// given its parameters and nothing that names the node, the Flow or the run, so
// the id cannot come from any of them. It is the dataset name plus a digest of
// what shapes the rows: the item selector, and each field's key, what it reads,
// whether it is required and whether its column is kept. So:
//
// - running the Flow again saves under the same id, and Core keys a run's
//   datasets by run and id (`storage/project/run-dataset-store.ts`), so each run
//   gets its own rows under a name that stays stable across runs;
// - two extraction nodes of one Flow that read the same shape append into one
//   dataset, while two that read different shapes -- including one that
//   excludes a column the other keeps -- never share an id, since Core refuses
//   one id with two schemas;
// - an element fingerprint is left out of the digest. It identifies where a
//   field was picked, not what the column holds, and it carries the element's
//   text (`actions/extraction/recorded-definition.ts`).
//
// **The name is never page text (D3).** It lists the kept field keys, which the
// author chose and the key rule bounds (D16). An excluded column's key is left
// out of it, because Core keeps excluded field ids out of the stored dataset.

import type { AutomationStudioRecordOutput } from "fluxiq/automation-studio";
import type { WebAutomationExtractField, WebAutomationExtractListRequest } from "../../actions/extraction";
import { webAutomationDatasetId } from "../../extraction";
import { webAutomationRecordOutput } from "./record-output";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "./records-path";

/** Core's bound on a dataset label (`labelMaxLength`). */
const LABEL_MAX_LENGTH = 200;

const LABEL_PREFIX = "Extracted list: ";

/** Two FNV-1a passes with different offset bases, for a 64-bit digest in 16 hex characters. */
const DIGEST_SEEDS = [0x811c9dc5, 0x050c5d1f] as const;
const FNV_PRIME = 0x01000193;

/** The record output a list extraction saves under when its node names none: every field, in a dataset named after the kept ones. */
export function webAutomationDerivedRecordOutput(request: WebAutomationExtractListRequest): AutomationStudioRecordOutput {
  const label = derivedLabel(request);
  return {
    ...webAutomationRecordOutput({ datasetId: webAutomationDatasetId(label, shapeDigest(request)), label, request, fieldLabels: {} }),
    recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
  };
}

function derivedLabel(request: WebAutomationExtractListRequest): string {
  const kept = Object.entries(request.fields)
    .filter(([, field]) => typeof field === "string" || field.handling !== "exclude")
    .map(([key]) => key);
  return `${LABEL_PREFIX}${kept.join(", ")}`.slice(0, LABEL_MAX_LENGTH);
}

/** A digest of what shapes the rows, in field order, since the schema keeps that order. */
function shapeDigest(request: WebAutomationExtractListRequest): string {
  const shape = JSON.stringify([request.item, Object.entries(request.fields).map(([key, field]) => [key, fieldShape(field)])]);
  return DIGEST_SEEDS.map((seed) => fnv1a(shape, seed)).join("");
}

function fieldShape(field: WebAutomationExtractField): string | (string | boolean | null)[] {
  if (typeof field === "string") return field;
  return [field.kind, field.selector ?? null, field.attribute ?? null, field.header ?? null, field.required ?? null, field.handling ?? null];
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
