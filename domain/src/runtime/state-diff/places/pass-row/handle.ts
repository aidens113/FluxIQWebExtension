// Where a loop pass's control sat on the page before it (job rerun round 4).
//
// The node a pass runs keeps the selector the build recorded, on the build's
// row; the pass reaches its own row only through the values dispatch writes
// into the recorded element (`output-nodes/targets/row-scope.ts`), and the page
// presses the control in the record holding them
// (`apps/extension/src/content/action-runtime/pass-row/`). A diff that looked
// only at the selector said every pass pressed the build's row, so Core tied
// each pass's act to the template's item and subject: the exact undo of a
// pass's act was refused, and an undo on another row sharing only the
// template's title was admitted (run `run-mvgw1854-5d10955b`).
//
// So the control is placed by the page's rule, read from the capture:
//
// 1. A control the page placed in no record is the same control on every
//    pass -- a dialog's Close, a toolbar -- and is the one the selector names.
// 2. A control whose record holds every value of the row is the pass's own.
// 3. Otherwise the one other record holding every value is the pass's row,
//    and its control is the one at the build's control's place in it: the
//    same path down from the record's root, each step a tag and its index
//    among same-tag siblings, and a copy differing from the build's only by
//    row data (`./copy.ts`).
//
// No record holding the row, two of them, or no such copy in it gives no
// handle: never the template's, which is another row's.

import type { WebLlmEvidenceElement, WebLlmSnapshotBinding } from "../../../llm-evidence";
import { webRowCopyMatches } from "./copy";
import { webRecordHoldsRowValues } from "./holds";

/** As much of a captured page as the rule reads: its elements and the record each sits in. */
type WebPassRowPage = Pick<WebLlmSnapshotBinding, "records"> & { evidence?: WebLlmSnapshotBinding["evidence"] };

/** One step down from a record's root: a child of this tag, at this index among its same-tag siblings. */
type Step = { tag: string; index: number };

/** Far past any page's nesting; a guard on the walk up, not a bound on what is read. */
const MAX_DEPTH = 256;

/** The handle of the control the pass holding `values` acted on, from the build's `template` (header); `undefined` where none is. */
export function webPassRowHandle(page: WebPassRowPage, template: string, values: readonly string[]): string | undefined {
  const built = page.records.get(template);
  if (built === undefined) return template;
  const elements = page.evidence?.elements ?? [];
  const location = page.evidence?.location ?? "";
  const members = new Map<string, WebLlmEvidenceElement[]>();
  for (const element of elements) {
    const record = page.records.get(element.target);
    if (record === undefined) continue;
    const held = members.get(record) ?? [];
    held.push(element);
    members.set(record, held);
  }
  if (webRecordHoldsRowValues(members.get(built) ?? [], values, location)) return template;
  const holding = [...members].filter(([record, held]) => record !== built && webRecordHoldsRowValues(held, values, location));
  const row = holding.length === 1 ? holding[0] : undefined;
  const control = elements.find((element) => element.target === template);
  if (!row || !control) return undefined;
  const copy = placedIn(row[1], control, members.get(built) ?? []);
  return copy && page.records.get(copy.target) === row[0] && webRowCopyMatches(control, copy, values) ? copy.target : undefined;
}

/** The element at `control`'s place below the root of its record, whose elements are `builtRow`, in the record whose elements are `row`. */
function placedIn(row: readonly WebLlmEvidenceElement[], control: WebLlmEvidenceElement, builtRow: readonly WebLlmEvidenceElement[]): WebLlmEvidenceElement | undefined {
  const inBuilt = new Map(builtRow.map((element) => [element.target, element]));
  const steps: Step[] = [];
  let current = control;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const parent = current.parent === undefined ? undefined : inBuilt.get(current.parent);
    if (!parent) break;
    steps.unshift({ tag: current.tag, index: sameTag(childrenOf(builtRow, parent.target), current.tag).indexOf(current) });
    current = parent;
  }
  const rootIndex = sameTag(rootsOf(builtRow), current.tag).indexOf(current);
  let found: WebLlmEvidenceElement | undefined = sameTag(rootsOf(row), current.tag)[rootIndex];
  for (const step of steps) found = found === undefined ? undefined : sameTag(childrenOf(row, found.target), step.tag)[step.index];
  return found;
}

/** The record's elements whose parent is not one of them, in page order. */
function rootsOf(held: readonly WebLlmEvidenceElement[]): WebLlmEvidenceElement[] {
  const handles = new Set(held.map((element) => element.target));
  return held.filter((element) => element.parent === undefined || !handles.has(element.parent));
}

function childrenOf(held: readonly WebLlmEvidenceElement[], parent: string): WebLlmEvidenceElement[] {
  return held.filter((element) => element.parent === parent);
}

function sameTag(elements: readonly WebLlmEvidenceElement[], tag: string): WebLlmEvidenceElement[] {
  return elements.filter((element) => element.tag === tag);
}
