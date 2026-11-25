// The label a stored record schema keeps for one detected column (t997).
//
// The model is shown a readable label (`./field-sample.ts`): where the page's
// own label is a generated class path, what the element is and its first
// item's value -- `link: '<a product title>'`. That label is evidence for one
// call. A stored schema outlives the call: it is copied into every dataset the
// read writes and an answer heads its column with it: it is the column's human
// name, as Core defines a label. For a column the plan renames the label is the
// plan's own name (`../plan-resolution/extraction/retained-schema.ts`, t1041,
// the lead's decision of 2026-11-25, reversing t997); the site's words bind
// through the name rewrite (`../plan-resolution/extraction/stored-columns.ts`). So it holds no page value (`docs/architecture/retained-extraction.md`):
// it is the page's own column words where the detection has them -- a header, a
// test id, an attribute's name, a badge's name -- screened as every page string
// the domain publishes, and the column's key where the page's label is a
// generated class path or nothing readable is left of it. A link's address
// column is labelled by its text column's path and ` url`
// (`apps/extension/src/content/extraction/infer-fields.ts`, `LINK_LABEL_SUFFIX`),
// so a generated path is still generated with that word after it.

import { isWithheldText, screenedPageText } from "../withheld";
import { webLlmGeneratedLabel } from "./generated-label";

/** Core's longest record field label (`AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.labelMaxLength`). */
const MAX_LABEL = 200;
/** The word the page side puts after a path to label a link's address column. */
const LINK_SUFFIX = /\s+url$/u;

/** The stored label of the column `key`, whose page label is `pageLabel`: the page's words, or the key. */
export function webLlmStoredColumnLabel(key: string, pageLabel: string): string {
  const words = screenedPageText(pageLabel);
  if (words === undefined || isWithheldText(words) || webLlmGeneratedLabel(words.replace(LINK_SUFFIX, ""))) return key;
  return words.slice(0, MAX_LABEL);
}
