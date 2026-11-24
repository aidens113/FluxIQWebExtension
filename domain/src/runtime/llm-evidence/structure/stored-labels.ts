// One label per stored field, none of which a declaration could bind to the
// wrong field (t997).
//
// Core binds a declaration's field name to an exact field id first, and then to
// the one field whose label folds to it -- case and runs of whitespace ignored
// (`bindAutomationStudioRecordProcessing`) -- and its schema reader refuses two
// fields with one label. So a label is taken when it folds to a label already
// given or to another field's id: `Price` on one field beside a field whose id
// is `price` would bind `PRICE` to the first and `price` to the second. A taken
// label gets the field's id and a number after it, as Core's own schema merge
// does, so no page value is ever added to tell two apart.

import { pageText } from "../untrusted-json";

/** Core's longest record field label (`AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.labelMaxLength`). */
const MAX_LABEL = 200;

/** Each field's label, in order: its preferred one where no other field answers to it, else that with its id and a number. */
export function webLlmUniqueStoredLabels(fields: readonly { id: string; label: string }[]): string[] {
  const ids = fields.map((field) => folded(field.id));
  const given = new Set<string>();
  return fields.map((field, index) => {
    const preferred = field.label.slice(0, MAX_LABEL);
    const taken = (label: string): boolean => {
      const name = folded(label);
      // A field's own id is its own to carry as a label; any other field's is not.
      return given.has(name) || (label !== field.id && ids.some((id, other) => other !== index && id === name));
    };
    let label = preferred;
    for (let suffix = 2; taken(label); suffix += 1) label = `${preferred.slice(0, 80)} (${field.id.slice(0, 100)} ${suffix})`;
    given.add(folded(label));
    return label;
  });
}

/** A name as Core's binding compares it: runs of whitespace one space, ends trimmed, lower case. */
function folded(name: string): string {
  return (pageText(name) ?? "").toLowerCase();
}
