// The extraction a confirmed pick records, and the read its preview asks for.
//
// The panel sends the columns the user settled on: a record key, the name they
// left in the label box, what the column reads, and the Include or Exclude
// choice (D12). The **item selector comes from the proposal this worker is
// still holding**, never from the message, because the panel does not offer to
// edit it and the worker has the authoritative copy.
//
// **D12, twice over.** A column the user excluded stays in the *recorded*
// request as `handling: "exclude"`: that is what keeps the exclusion durable,
// so field detection does not propose the column again and Core's record schema
// can carry it. The page never reads it. The *preview* request built here does
// not name an excluded column at all, so no value of one is ever read,
// previewed, stored or exported -- it is absent rather than hidden.
//
// Nothing is trusted on the way out either. `runnableExtractListRequest` puts
// the finished definition through the one reader that decides whether a
// recorded extraction is executable (`webAutomationRecordedAction`), and uses
// the request that reader rebuilt. A definition it refuses is never recorded
// and never run, so the worker cannot run a read the replayed Flow would not.

import {
  WEB_AUTOMATION_EVENTS,
  WEB_AUTOMATION_INPUT_IDS,
  webAutomationDatasetId,
  webAutomationRecordedAction,
  type WebAutomationExtractFieldHandling,
  type WebAutomationExtractFieldKind,
  type WebAutomationExtractFieldSpec,
  type WebAutomationExtractionProposal,
  type WebAutomationExtractListPagination,
  type WebAutomationExtractListRequest,
  type WebAutomationRecordedListExtraction
} from "@fluxiq-web-extension/domain/client";
import type { ExtractionConfirmField, ExtractionConfirmRequest, ExtractionPreviewColumn } from "../../shared/extraction-messages";
import type { JsonObject } from "../../shared/protocol";
import { EXTRACTION_PREVIEW_MAX_ROWS } from "./session-store";

// The confirm payload is one declaration, in `shared/extraction-messages.ts`,
// which the panel writes and this file reads; it is re-exported here so the
// worker's own modules keep one local import.
export type { ExtractionConfirmField, ExtractionConfirmRequest, ExtractionPreviewColumn } from "../../shared/extraction-messages";

type BuiltColumns = {
  fields: Record<string, WebAutomationExtractFieldSpec>;
  labels: Record<string, string>;
};

/**
 * The definition to record, or `undefined` when the panel sent no usable
 * columns, left the dataset unnamed, repeated a key, or produced a request the
 * domain would refuse.
 *
 * `nonce` makes the dataset id unique: a re-recorded extraction is a new
 * dataset, never a second writer into the rows an earlier recording saved.
 */
export function recordedListExtraction(
  proposal: WebAutomationExtractionProposal,
  confirm: ExtractionConfirmRequest,
  nonce: string
): WebAutomationRecordedListExtraction | undefined {
  const label = typeof confirm.label === "string" ? confirm.label.trim() : "";
  const columns = buildColumns(proposal, confirm.fields);
  if (label.length === 0 || columns === undefined) return undefined;
  const request: WebAutomationExtractListRequest = {
    item: proposal.item,
    fields: columns.fields,
    ...(confirm.paginate !== undefined ? { paginate: confirm.paginate } : {}),
    ...(confirm.maxItems !== undefined ? { maxItems: confirm.maxItems } : {})
  };
  const definition: WebAutomationRecordedListExtraction = {
    form: "list",
    datasetId: webAutomationDatasetId(label, nonce),
    label,
    request,
    fieldLabels: columns.labels,
    itemCount: typeof confirm.itemCount === "number" ? confirm.itemCount : proposal.itemCount
  };
  return runnableExtractListRequest(definition) === undefined ? undefined : definition;
}

/**
 * What the page is asked to read for the confirmation preview: one page, at
 * most `EXTRACTION_PREVIEW_MAX_ROWS` rows, and no minimum, since a preview that
 * finds nothing is an answer rather than a failure.
 *
 * The rows come back keyed by the **proposal's** field keys, which is how the
 * panel names a column for as long as the session lasts, however the user
 * renames it. A column the proposal already marked `exclude` -- which is what
 * the sensitivity rule pre-selects (D12) -- is not named here at all, so its
 * values are never read.
 *
 * `columnsKey` is the stable name of the columns the rows were read under. The
 * session holds it beside the rows, so the read happens once and a caller that
 * names a different set of columns gets a fresh read rather than the old rows
 * filtered.
 */
export function extractionPreviewRequest(
  proposal: WebAutomationExtractionProposal,
  columns: readonly ExtractionPreviewColumn[] | undefined
): { request: WebAutomationExtractListRequest; columnsKey: string } | undefined {
  const fields: Record<string, WebAutomationExtractFieldSpec> = {};
  for (const field of proposal.fields) {
    const handling = columns?.find((column) => column.key === field.key)?.handling ?? field.spec.handling;
    if (handling !== undefined && handling !== "include") continue;
    fields[field.key] = fieldSpec(field.spec.kind, field.spec, "include");
  }
  const names = Object.keys(fields);
  if (names.length === 0) return undefined;
  return {
    request: { item: proposal.item, fields, maxItems: EXTRACTION_PREVIEW_MAX_ROWS, minItems: 0 },
    columnsKey: names.join(",")
  };
}

/**
 * The request a definition would actually run, or `undefined` when the domain
 * refuses the definition.
 *
 * It asks the recorded-action reader rather than the request reader directly,
 * because that is the function deciding whether the recorded event becomes an
 * executable `web.dom.extract_list` node at all. Asking it here means the read
 * the worker runs now and the read a replayed Flow runs later are the same
 * request, rebuilt by the same code.
 */
export function runnableExtractListRequest(definition: unknown): WebAutomationExtractListRequest | undefined {
  const action = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.dataExtractionDefined, { extraction: definition as JsonObject });
  if (action === undefined || action.inputId !== WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined) return undefined;
  const request = action.parameters.extractList;
  return request === undefined ? undefined : request as unknown as WebAutomationExtractListRequest;
}

/**
 * The record field for each column the panel kept, with its human label beside
 * it. The panel sending no columns at all means "as proposed", which is what
 * the Lab's confirm path and a panel that never edited anything both mean.
 *
 * A repeated key refuses the whole set. The fields are an object, so the second
 * entry would overwrite the first and record one column fewer than the user
 * confirmed -- silently, and with the wrong label against the survivor.
 */
function buildColumns(
  proposal: WebAutomationExtractionProposal,
  columns: readonly ExtractionConfirmField[] | undefined
): BuiltColumns | undefined {
  const chosen = columns ?? proposedColumns(proposal);
  if (chosen.length === 0) return undefined;
  const fields: Record<string, WebAutomationExtractFieldSpec> = {};
  const labels: Record<string, string> = {};
  for (const column of chosen) {
    const label = typeof column.label === "string" ? column.label.trim() : "";
    if (typeof column.key !== "string" || column.key.length === 0 || label.length === 0) return undefined;
    if (column.key in fields) return undefined;
    fields[column.key] = fieldSpec(column.kind, column, column.handling);
    labels[column.key] = label;
  }
  return { fields, labels };
}

/** The proposal's own fields as the panel would first show them: the key it gave, its label, and the handling the sensitivity rule pre-selected. */
function proposedColumns(proposal: WebAutomationExtractionProposal): ExtractionConfirmField[] {
  return proposal.fields.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.spec.kind,
    ...(field.spec.selector !== undefined ? { selector: field.spec.selector } : {}),
    ...(field.spec.attribute !== undefined ? { attribute: field.spec.attribute } : {}),
    ...(field.spec.header !== undefined ? { header: field.spec.header } : {}),
    ...(field.spec.required !== undefined ? { required: field.spec.required } : {}),
    handling: field.spec.handling ?? "include"
  }));
}

/**
 * One field spec, written key by key.
 *
 * `attribute` is required by the `attribute` kind and refused on every other,
 * and `header` likewise by `column` (`domain/src/actions/extraction/request.ts`).
 * A user who switches a table column to plain text would otherwise send a
 * request the reader refuses whole, so each is written only under the kind that
 * reads it.
 */
function fieldSpec(
  kind: WebAutomationExtractFieldKind,
  source: { selector?: string | undefined; attribute?: string | undefined; header?: string | undefined; required?: boolean | undefined },
  handling: WebAutomationExtractFieldHandling
): WebAutomationExtractFieldSpec {
  return {
    kind,
    ...(source.selector !== undefined ? { selector: source.selector } : {}),
    ...(kind === "attribute" && source.attribute !== undefined ? { attribute: source.attribute } : {}),
    ...(kind === "column" && source.header !== undefined ? { header: source.header } : {}),
    ...(source.required !== undefined ? { required: source.required } : {}),
    handling
  };
}
