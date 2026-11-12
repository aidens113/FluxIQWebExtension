// The columns of a grid read one row per cell (`./cell-run.ts`, t885 R2): the
// group's heading, read in the cell's group, then what the cell offers as an
// item of its own (`../infer-fields.ts`: its `data-*` attributes, its link, its
// pressed, selected or disabled state, what it holds), and its own words where
// nothing inside it offers words -- a time drawn as the control's only text.
//
// **The heading** is the group run's first text column that every group has,
// outside the cells: a day's "Sat 03/10", a stop's name. Its spec is the run's
// own, read inside the group (`group` is the run's item selector,
// `../field-element/`), and it is labelled as what it is to the row, never by
// its words (D3).

import { webAutomationExtractionFieldKey, type WebAutomationExtractionProposal, type WebAutomationExtractionProposalField } from "@fluxiq-web-extension/domain/client";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { fieldElement } from "../field-element";
import { inferFields } from "../infer-fields";

/** What the group's heading column is labelled. */
const HEADING_LABEL = "group heading";

/** What the cell's own words are labelled where nothing inside it offers them. */
const OWN_WORDS_LABEL = "item";

/** The columns of the cells of `run`'s groups, in the order above. */
export function cellFields(groups: readonly Element[], cells: readonly Element[], run: WebAutomationExtractionProposal): WebAutomationExtractionProposalField[] {
  const first = cells[0];
  if (first === undefined) return [];
  const own = inferFields(first, cells);
  const taken = new Set(own.map((field) => field.key));
  const heading = headingField(groups, cells, run, taken);
  return [...heading, ...own, ...ownWords(cells, own, taken)];
}

/** The group's heading as a column of every cell, or none where the groups share no such column (header). */
function headingField(groups: readonly Element[], cells: readonly Element[], run: WebAutomationExtractionProposal, taken: Set<string>): WebAutomationExtractionProposalField[] {
  const isCell = (element: Element): boolean => cells.some((cell) => cell === element || cell.contains(element) || element.contains(cell));
  const heading = run.fields.find(({ spec, coverage }) => spec.kind === "text" && spec.mark === undefined && spec.lines !== true && spec.definition === undefined
    && spec.handling !== "exclude" && coverage >= 1 && groups.every((group) => {
      const element = fieldElement(group, spec.selector);
      return element !== null && element !== group && !isCell(element);
    }));
  if (heading === undefined) return [];
  const spec = { ...heading.spec, group: run.item, required: false };
  const found = cells.filter((cell) => fieldElement(cell, spec.selector, spec.group) !== null).length;
  const key = webAutomationExtractionFieldKey(HEADING_LABEL, taken);
  taken.add(key);
  return [{ key, label: HEADING_LABEL, spec, coverage: Math.round((found / cells.length) * 100) / 100 }];
}

/** The cell's own words as a column, where nothing inside it offers words (header). */
function ownWords(cells: readonly Element[], own: readonly WebAutomationExtractionProposalField[], taken: Set<string>): WebAutomationExtractionProposalField[] {
  if (own.some((field) => field.spec.kind === "text" && field.spec.mark === undefined)) return [];
  const worded = cells.filter((cell) => textOutsideSensitiveControls(cell).trim() !== "").length;
  if (worded === 0) return [];
  const coverage = Math.round((worded / cells.length) * 100) / 100;
  const key = webAutomationExtractionFieldKey(OWN_WORDS_LABEL, taken);
  taken.add(key);
  return [{ key, label: OWN_WORDS_LABEL, spec: { kind: "text", selector: ":scope", required: coverage >= 1 }, coverage }];
}
