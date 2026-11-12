// Which controls of a run's groups are a grid's cells (`./cell-run.ts`, t885 R2).
//
// Controls of one tag and role at one place in their group (the same path of
// tags from the group down), found in at least two groups, sitting at least
// twice side by side in one of them, three or more in all. And they must say
// different things from group to group: a card's Like and Share buttons say
// the same words in every card, which is the card's chrome, not its data. A
// group with no cells counts as saying nothing, so a timetable whose open days
// all show the same times still differs from its closed ones. Words are read
// only to decide this, and never leave the page (D3).

import { textOutsideSensitiveControls } from "../../sensitive-text";

/** The controls a cell can be: what a person presses or picks, one at a time. */
const CELL_CONTROL = 'a[href],button,[role="button"],[role="link"],[role="option"],[role="radio"],[role="checkbox"],[role="gridcell"]';

/** How many cells a grid holds at least, as a run needs three items to be a template rather than a coincidence. */
const MIN_CELLS = 3;

/** The cells of the groups in page order: the controls of the one kind that makes a grid of them, the most such where several do; `undefined` when none does. */
export function gridCells(groups: readonly Element[]): Element[] | undefined {
  const byKind = new Map<string, Element[][]>();
  groups.forEach((group, index) => {
    for (const control of controlsIn(group)) {
      const kind = cellKind(group, control);
      const perGroup = byKind.get(kind) ?? groups.map((): Element[] => []);
      perGroup[index]!.push(control);
      byKind.set(kind, perGroup);
    }
  });
  let best: Element[] | undefined;
  for (const perGroup of byKind.values()) {
    const cells = perGroup.flat();
    if (isGrid(perGroup) && (best === undefined || cells.length > best.length)) best = cells;
  }
  return best;
}

/** The group's controls, leaving out one inside another, which belongs to the outer control. */
function controlsIn(group: Element): Element[] {
  const controls = Array.from(group.querySelectorAll(CELL_CONTROL));
  return controls.filter((control) => !controls.some((outer) => outer !== control && outer.contains(control)));
}

/** A control's kind: its tag, its role and the tags on its way down from the group. */
function cellKind(group: Element, control: Element): string {
  const path: string[] = [];
  for (let current = control.parentElement; current && current !== group; current = current.parentElement) path.push(current.tagName);
  return `${control.tagName}|${control.getAttribute("role") ?? ""}|${path.join(">")}`;
}

/** Whether one kind's controls, by group, make a grid (header). */
function isGrid(perGroup: readonly Element[][]): boolean {
  const total = perGroup.reduce((count, cells) => count + cells.length, 0);
  if (total < MIN_CELLS || perGroup.filter((cells) => cells.length > 0).length < 2) return false;
  if (!perGroup.some(hasSideBySide)) return false;
  const said = new Set(perGroup.map((cells) => JSON.stringify(cells.map(words))));
  return said.size > 1;
}

function hasSideBySide(cells: readonly Element[]): boolean {
  return cells.some((cell, index) => cells.slice(index + 1).some((other) => other.parentElement === cell.parentElement));
}

function words(element: Element): string {
  return textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim();
}
