// What "Save changes" would save, in the person's words: the labels of every setting whose
// value differs from the saved one. The draft bar names them, so an unsaved change is never
// a bare "you have changes". Theme and the on-page status apply at once and are not listed.

import type { FluxIQSettings } from "../../shared/protocol";
import { SETTING_FIELDS } from "./form-fields";

/** The labels, in display order, of what differs between `current` and `saved`. Addresses compare trimmed, as Save stores them. */
export function unsavedLabels(current: FluxIQSettings, saved: FluxIQSettings): string[] {
  const labels: string[] = [];
  for (const { key, label } of SETTING_FIELDS.addresses) if (current[key].trim() !== saved[key].trim()) labels.push(label);
  for (const { key, label } of SETTING_FIELDS.toggles) if (current[key] !== saved[key]) labels.push(label);
  return labels;
}

/** The sentence under the draft line: what is waiting for Save. Empty when nothing differs. */
export function unsavedSentence(labels: readonly string[]): string {
  return labels.length === 0 ? "" : `Not saved yet: ${labels.join(", ")}.`;
}
