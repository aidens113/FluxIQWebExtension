// A grid of grouped controls, read one row per control (t885, R2).
//
// A run is siblings, so a list's item is a group whenever the page groups its
// controls: a timetable's day columns, each holding its times; a cinema's days,
// each holding its showings; a bus timetable's stops, each holding its
// departures. Read as that run, every group is one row and its controls are
// positional columns -- `div:2` to `div:5` -- so a read cannot say which times
// are free, and it cannot keep one time and not the next. A slot-level read was
// impossible besides: a run of controls aimed at loses to the rich list around
// it (`../detect-structure.ts`), and controls in different groups are not
// siblings, so they were never one run (`run-mwc6ut8u-52e3c1b3`, where every
// read of a booking calendar came back as one row per day with columns `a` to
// `d`).
//
// So beside the run, detection also offers its cells: every control of one
// kind inside the groups, in page order (`./grid-cells.ts`), each a row with
// its group's heading as a column (`./cell-fields.ts`). "The free times on
// Saturday" is then a read with two conditions and no position anywhere. The
// cells continue as the run does, so they keep its pagination.
//
// Nothing here reads a value into the proposal: selectors, labels built from
// structure, counts and coverage (D3). A grid with a sensitive control in it
// is not offered.

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { selectorFor } from "../../selector";
import { isWithinSensitiveControl } from "../../sensitive-text";
import { generalizedItemSelector } from "../item-selector";
import { cellFields } from "./cell-fields";
import { gridCells } from "./grid-cells";

/** The cells of the run's groups as a list of their own, or `undefined` when the groups hold no grid; see the header. */
export function cellRunProposal(groups: readonly Element[], container: Element, run: WebAutomationExtractionProposal): WebAutomationExtractionProposal | undefined {
  const cells = gridCells(groups);
  if (cells === undefined || cells.some(isWithinSensitiveControl)) return undefined;
  const containerSelector = selectorFor(container);
  const item = generalizedItemSelector(cells, containerSelector);
  if (item === undefined) return undefined;
  const fields = cellFields(groups, cells, run);
  if (fields.length === 0) return undefined;
  const coverage = fields.reduce((total, field) => total + field.coverage, 0) / fields.length;
  return {
    container: containerSelector,
    item: item.selector,
    itemCount: cells.length,
    fields,
    ...(run.pagination === undefined ? {} : { pagination: structuredClone(run.pagination) }),
    confidence: Math.round(item.confidence * coverage * 100) / 100
  };
}
