// Whether a replayed press the client could not find was a control the page
// still showed by name (lane A round 3, F1 fix 2, run mux6n7m4).
//
// A press whose target the extension answered `web.target.not_found` on the
// very page it acted on reads as `remembered` (`./missing-target.ts`): the
// site's memory took the control away. But the swatch "Space Grey" was there
// -- the read taken before the press showed it as `clickable "Space Grey"` --
// and the resolver could not enumerate it. Calling that remembered passed a
// step the Flow could not take. When the whole read before the press, at the
// step's own location, holds a control named exactly as the step's identity
// names it, the miss is the step's, and the replay answers `failed`.
//
// Three restrictions keep what `remembered` still rightly covers:
//   - only the accessible `name` counts, never `text`, `ownText` or a label's
//     words: the "Color: Space Grey" label carries the same words (t74);
//   - only a control counts: an element the page view gives a control kind
//     (`../page-view/element/kind.ts`), not a heading, image or plain text;
//   - a step recorded in a record -- a card, a row -- counts only a control in
//     that same record, by the record's words (`within`). Bigbox's store
//     chooser (run-munri5gr) shows "Set as my store" on every other card once
//     the step's own card is chosen, and that step stays remembered. A record
//     known only by its key has no words to compare, so nothing counts.

import type { JsonObject } from "fluxiq/core";
import { webLlmElementKind } from "../page-view";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { isJsonRecord } from "../untrusted-json";

/** Kinds the page view gives an element that does nothing when pressed. */
const NOT_CONTROL_KINDS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "img", "dialog", "layer"]);

/**
 * The name of the control the read before a replayed press showed for the
 * step's target, or `undefined` when the read does not show one beyond doubt:
 * a cut read, one taken elsewhere than the step's `from.location`, a step with
 * no accessible name, or no control of that name (in the step's record, where
 * it has one).
 */
export function webNodeNamedControlShown(before: WebLlmSnapshotBinding, parameters: JsonObject, value: JsonObject): string | undefined {
  const from = isJsonRecord(value.from) ? value.from : undefined;
  if (before.evidence.truncated || typeof from?.location !== "string" || before.evidence.location !== from.location) return undefined;
  const identity = isJsonRecord(parameters.element) ? parameters.element : undefined;
  const accessibleName = typeof identity?.accessibleName === "string" ? identity.accessibleName : "";
  const name = compared(accessibleName);
  if (name === "") return undefined;
  const context = isJsonRecord(identity?.context) ? identity.context : undefined;
  const record = isJsonRecord(context?.record) ? context.record : undefined;
  const recordText = record === undefined ? undefined : typeof record.text === "string" ? compared(record.text) : "";
  if (recordText === "") return undefined;
  const shown = before.evidence.elements.some((element) => {
    if (element.hidden === true || typeof element.name !== "string" || compared(element.name) !== name) return false;
    const kind = webLlmElementKind(element);
    if (kind === undefined || NOT_CONTROL_KINDS.has(kind)) return false;
    return recordText === undefined || (typeof element.within === "string" && compared(element.within) === recordText);
  });
  return shown ? accessibleName.trim() : undefined;
}

/** Words as compared: case and spacing aside. */
function compared(words: string): string {
  return words.replace(/\s+/gu, " ").trim().toLowerCase();
}
