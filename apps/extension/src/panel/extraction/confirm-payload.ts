// The message the panel sends when the user confirms: structure only.
//
// Two rules are worth stating because both are easy to break silently.
//
// First, **no preview row reaches this payload.** The draft holds none, and the
// rows the panel displays are a separate value that this function is never
// given, so a recorded definition cannot carry a sample of the page.
//
// Second, a field spec's `attribute` and `header` are required by their own kind
// and refused on every other (`domain/src/actions/extraction/request.ts`). The
// proposal supplies both for a column read out of a table header, so a user who
// switches that column to plain text would otherwise send a request the
// parameter lift refuses whole. Each is written only under the kind that reads
// it.
//
// Record keys are derived here rather than held in the draft: a rename may
// collide with another column's key, and `webAutomationExtractionFieldKey`
// settles the collision the one way the domain settles it (D16).

import { webAutomationExtractionFieldKey } from "@fluxiq-web-extension/domain/client";
import type { ExtractionConfirmField, ExtractionConfirmRequest } from "./messages";
import type { ExtractionDraft, ExtractionFieldRow } from "./view-model";

/** What `fluxiq.extractionConfirm` carries for `draft`. An excluded column is present, with `handling: "exclude"`, so the page never reads it and detection does not propose it again (D12). */
export function extractionConfirmPayload(draft: ExtractionDraft): ExtractionConfirmRequest {
  const taken = new Set<string>();
  const fields = draft.fields.map((field) => {
    const key = webAutomationExtractionFieldKey(field.label, taken);
    taken.add(key);
    return confirmField(key, field);
  });
  return {
    label: draft.label,
    item: draft.item,
    fields,
    paginate: draft.paginate ? draft.pagination : undefined,
    itemCount: draft.itemCount
  };
}

function confirmField(key: string, field: ExtractionFieldRow): ExtractionConfirmField {
  return {
    key,
    label: field.label,
    kind: field.kind,
    selector: field.selector,
    attribute: field.kind === "attribute" ? field.attribute : undefined,
    header: field.kind === "column" ? field.header : undefined,
    required: field.required,
    handling: field.handling
  };
}
