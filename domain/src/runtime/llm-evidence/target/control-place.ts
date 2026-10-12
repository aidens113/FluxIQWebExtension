// Whether a proposed control stands where the recorded one stood (t446).
//
// A place is what the recording says about where the control sat that does not
// change from one visit of the page to the next: the landmark it was in, the
// form it belonged to, and whether it was one of a repeated list's or table's
// rows. The nearest heading is deliberately not one: on a detail page it is the
// record's own title (the item's product title in R4b), so the same control
// under another record's title would read as elsewhere.
//
// Two answers come back, because the two rungs that read them need different
// strengths:
//
// - `conflicting`: the page says the proposal is somewhere else -- another
//   landmark or another form, both stated, or a row of a repeated list where
//   the recorded control was in none, or the other way round. A control with
//   the recorded name there is a same-named control elsewhere: the one-row
//   "related items" list's own button, a sidebar's copy of the toolbar.
// - `kept`: every place the recording stated, the proposal is in, and at least
//   a landmark or a form was stated, and neither sits in a repeated list or
//   table, where a place is a position and a position is not an identity. Only
//   this is strong enough to anchor a control whose name has changed.
//
// A recording that stated no place at all -- a created node carries none --
// conflicts with nothing and keeps nothing.

import type { WebAutomationElementContext } from "../../../actions/types";
import { type WebLlmEvidenceElement } from "../elements";

/** Where the recorded control sat: its recorded context, and its form wherever the recording kept it. */
export type WebRecordedPlace = { context?: WebAutomationElementContext | undefined; formId?: string | undefined };

/** Whether a proposal stands elsewhere, and whether it keeps every place the recording stated. */
export type WebControlPlace = { conflicting: boolean; kept: boolean };

export function webControlPlace(recorded: WebRecordedPlace, named: WebLlmEvidenceElement): WebControlPlace {
  const landmark = lower(recorded.context?.landmark);
  const form = text(recorded.formId);
  const recordedRepeated = recorded.context?.listPosition !== undefined || recorded.context?.tablePosition !== undefined || recorded.context?.record !== undefined;
  const stated = landmark !== undefined || form !== undefined || recordedRepeated;
  if (!stated) return { conflicting: false, kept: false };
  const namedLandmark = lower(named.landmark);
  const namedForm = text(named.form);
  const namedRepeated = named.item !== undefined || named.cell !== undefined || (named.repeats ?? 0) > 1;
  const conflicting = (landmark !== undefined && namedLandmark !== undefined && landmark !== namedLandmark)
    || (form !== undefined && namedForm !== undefined && form !== namedForm)
    || recordedRepeated !== namedRepeated;
  const kept = !conflicting
    && !recordedRepeated
    && (landmark !== undefined || form !== undefined)
    && (landmark === undefined || landmark === namedLandmark)
    && (form === undefined || form === namedForm);
  return { conflicting, kept };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function lower(value: unknown): string | undefined {
  return text(value)?.toLowerCase();
}
