// What a detected list says of its rows beyond its columns (contracts CC2 and
// CC3): which fields are marks, which field is the row's identity, and, item by
// item in list order, its key and its marks.
//
// `fieldMarks` comes from the page's own proposal and is said whatever the
// capture holds. `rowIdentity` and `items` are read off the detection's capture
// (`./row-identity.ts`, `./item-marks.ts`) and are absent where it cannot
// answer. An item carries only what was answered for it; a list where nothing
// was has no `items`, which is the packet as it was before t800.

import type { WebAutomationExtractFieldMark } from "../../../../actions/extraction";
import { present } from "../../present";
import type { WebLlmCaptureWalk } from "../first-item";
import { webLlmItemMarks, type WebLlmListItemField } from "./item-marks";
import { webLlmRowIdentity } from "./row-identity";

/** A field that marks a row by being there or not, named by its field key. */
export type WebLlmStructureMark = { id: string; label: string; kind: WebAutomationExtractFieldMark };

/** One item of the list, in list order: its key by the identity fields, and whether it carries each mark. */
export type WebLlmStructureItem = { itemKey?: string; marks?: Record<string, "on" | "off"> };

export type WebLlmListItems = {
  fieldMarks: WebLlmStructureMark[] | undefined;
  rowIdentity: string[] | undefined;
  items: WebLlmStructureItem[] | undefined;
};

/** The list's marks, identity and items, each `undefined` where there is nothing to say. */
export function webLlmListItems(itemCount: number, fields: readonly WebLlmListItemField[], walk: WebLlmCaptureWalk | undefined): WebLlmListItems {
  const fieldMarks = fields.flatMap((field) => field.spec.mark === undefined ? [] : [{ id: field.key, label: field.label, kind: field.spec.mark }]);
  const identity = webLlmRowIdentity(itemCount, fields, walk);
  const marks = webLlmItemMarks(itemCount, fields, walk);
  const count = identity?.keys.length ?? marks?.length ?? 0;
  const items = count === 0 ? undefined : Array.from({ length: count }, (_, index) => present<WebLlmStructureItem>({
    itemKey: identity?.keys[index],
    marks: marks?.[index]
  }));
  return { fieldMarks: fieldMarks.length === 0 ? undefined : fieldMarks, rowIdentity: identity === undefined ? undefined : [identity.field], items };
}
