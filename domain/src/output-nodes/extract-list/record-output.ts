// The dataset a list extraction saves its records into.
//
// Core's `recordOutput` is what turns an extraction into a node that stores
// rows. Two producers build one here, and both have to satisfy Core's parser:
//
// - a recording's mapper candidate (`web-panel-host.ts`), which the proposal
//   lift parses and writes into the approved Flow node's
//   `parameterValues.recordOutput` (Core K3, K4a, K7). An invalid one rejects
//   the whole candidate rather than being dropped;
// - the `web.dom.extract_list` output node itself, when a Flow's author gave it
//   none (`./derived-record-output.ts`).
//
// It lives under `output-nodes` rather than `recording/proposals`, which
// re-exports it, because the output node needs it and `recording/proposals`
// already depends on this directory through `io/input-model`: importing it
// from there would make a module cycle.
//
// Two rules here are not obvious and are both D12.
//
// **Every field is declared, excluded ones included.** An excluded column is
// left out of the page's read, the stored rows, the preview and every export --
// Core is what drops it, from `handling: "exclude"`. It must still appear in the
// schema, because the exclusion is the record of a decision the user made: drop
// it here and the next field detection proposes the column again, and the user
// has to exclude their password column a second time.
//
// **A label is never a sample value.** The label is the column's header or the
// name the user gave it, which D16 settles as page structure, and the recorded
// definition has already bounded and checked it. Core additionally refuses a
// schema whose labels collide, so a duplicate is disambiguated here rather than
// left to reject the candidate.
//
// There is no `recordsPath`. A proposal's comes from the output's own
// `metadata.recordsPath` (`../definitions.ts`, CD19), and the output node adds
// the same constant (`./records-path.ts`), so naming it here would be a second
// place for the key to drift.

import type { AutomationStudioRecordField, AutomationStudioRecordOutput, AutomationStudioRecordValueType } from "fluxiq/automation-studio";
import type { WebAutomationRecordedListExtraction } from "../../actions/extraction";

/** A record output with no path, which is the shape a mapper candidate proposes. */
export type WebAutomationRecordOutput = Omit<AutomationStudioRecordOutput, "recordsPath">;

/** What the dataset is built from: a recorded list extraction, or the same four parts of one a Flow authored. */
export type WebAutomationRecordOutputSource = Pick<WebAutomationRecordedListExtraction, "datasetId" | "label" | "request" | "fieldLabels">;

/** Core's default and ceiling for the rows one capture keeps (`AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS`). */
const DEFAULT_MAX_RECORDS = 1_000;
const MAX_RECORDS_CEILING = 10_000;

/** Core's bound on a field label (`labelMaxLength`). */
const LABEL_MAX_LENGTH = 200;

/**
 * The dataset a list extraction saves into: its id and name, a schema over
 * every field the request declares, and the rows one run may keep.
 *
 * `writeMode` is `append`, so a paginated read's later pages add to the rows the
 * earlier ones stored rather than replacing them.
 */
export function webAutomationRecordOutput(definition: WebAutomationRecordOutputSource): WebAutomationRecordOutput {
  const taken = new Set<string>();
  const fields = Object.entries(definition.request.fields).map(([key, field]): AutomationStudioRecordField => {
    const spec = typeof field === "string" ? undefined : field;
    return {
      id: key,
      label: distinctLabel(definition.fieldLabels[key] ?? key, key, taken),
      // A link's target is a URL; everything else the page reads is text. A
      // number on the page is text too, because nothing has parsed it.
      valueType: (spec?.kind === "link" ? "url" : "string") satisfies AutomationStudioRecordValueType,
      // A field is required unless it was picked as optional: an optional field
      // the page cannot read is `null`, which Core stores as an absent key (D16).
      required: spec?.required !== false,
      ...(spec?.handling !== undefined ? { handling: spec.handling } : {})
    };
  });
  return {
    datasetId: definition.datasetId,
    label: definition.label,
    schema: { schemaVersion: "0.1", fields },
    writeMode: "append",
    maxRecords: Math.min(definition.request.maxItems ?? DEFAULT_MAX_RECORDS, MAX_RECORDS_CEILING)
  };
}

/**
 * The label, made distinct from the ones already used and cut to Core's bound.
 *
 * Core refuses a schema with two equal labels, and two columns of a page can
 * easily carry the same header. The field key disambiguates them, since it is
 * unique within the request by construction.
 */
function distinctLabel(label: string, key: string, taken: Set<string>): string {
  const preferred = label.slice(0, LABEL_MAX_LENGTH);
  const distinct = taken.has(preferred) ? `${preferred} (${key})`.slice(0, LABEL_MAX_LENGTH) : preferred;
  const unique = taken.has(distinct) ? key.slice(0, LABEL_MAX_LENGTH) : distinct;
  taken.add(unique);
  return unique;
}
