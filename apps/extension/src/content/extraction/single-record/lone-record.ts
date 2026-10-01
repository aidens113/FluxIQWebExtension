// The one record around a target, measured on the page and proposed as a run
// of one. The rule that picks the level is `lone-record-level.ts`; this module
// describes each level to it and names the level it picks.
//
// A level is measured only as far as the rule needs: a boundary ends the walk
// before anything else about it is read, and a level holding a run is not
// asked for its fields. At most the target and four of its ancestors are
// walked, so a target deep inside a card never climbs to the page.
//
// The proposal is the picker's, as for a run (`infer-list.ts`): the level's
// container, a selector naming exactly the level, and the fields the level
// exposes read as a run of one (`infer-fields.ts`). Its confidence is the
// selector's strength times the fields' mean coverage, halved: one element
// that holds values is a weaker claim to be a record than a template the page
// repeats, and the caller answers it beside a run, never instead of one
// (`detect-structure.ts`). It never carries pagination.

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { selectorFor } from "../../selector";
import { contentFieldCount } from "../content-fields";
import { inferFields } from "../infer-fields";
import { isRecordItemTag } from "../infer-list";
import { generalizedItemSelector } from "../item-selector";
import { largestRunsFirst } from "../largest-runs";
import { chooseLoneRecordLevel, type LoneRecordLevel } from "./lone-record-level";

/** The target and at most four of its ancestors. */
const MAX_LEVELS = 5;

/** How much of a run's confidence one element holding values earns; see the header. */
const LONE_RECORD_DISCOUNT = 0.5;

/** The page's main region, past which an element is a region rather than a record. */
const MAIN_REGION = 'main,[role~="main"]';

/**
 * Regions whose contents are navigation or chrome rather than data. The same
 * list `largest-runs.ts` keeps its own runs out of, restated here because that
 * module does not export it.
 */
const NON_DATA_REGIONS = [
  "nav",
  "footer",
  "svg",
  "select",
  "datalist",
  '[role~="navigation"]',
  '[role~="contentinfo"]',
  '[role~="menu"]',
  '[role~="menubar"]',
  '[role~="listbox"]',
  '[role~="tablist"]',
  '[role~="tree"]'
].join(",");

/** A level the walk stops at, or one the rule passes over, measured no further. */
const UNMEASURED = { contentFields: 0, holdsRun: false, namedExactly: false } as const;

/** The one record `target` belongs to, as a run of one, or `undefined` when there is none; see the header. */
export function loneRecordAround(target: Element): WebAutomationExtractionProposal | undefined {
  const levels = levelsAround(target);
  const index = chooseLoneRecordLevel(describedLevels(levels));
  const record = index === undefined ? undefined : levels[index];
  return record === undefined ? undefined : proposalFor(record);
}

/** The target and its ancestors, nearest first, up to the bound and never the document's root. */
function levelsAround(target: Element): Element[] {
  const levels: Element[] = [];
  for (let level: Element | null = target; level && level !== document.documentElement && levels.length < MAX_LEVELS; level = level.parentElement) {
    levels.push(level);
  }
  return levels;
}

function* describedLevels(levels: readonly Element[]): Generator<LoneRecordLevel> {
  for (const level of levels) {
    if (isBoundary(level)) {
      yield { cell: false, boundary: true, ...UNMEASURED };
      return;
    }
    if (!isRecordItemTag(level.tagName)) {
      yield { cell: true, boundary: false, ...UNMEASURED };
      continue;
    }
    if (largestRunsFirst(level).length > 0) {
      yield { cell: false, boundary: false, ...UNMEASURED, holdsRun: true };
      return;
    }
    yield {
      cell: false,
      boundary: false,
      contentFields: contentFieldCount(inferFields(level, [level])),
      holdsRun: false,
      namedExactly: naming(level) !== undefined
    };
  }
}

function isBoundary(level: Element): boolean {
  return level === document.body || level.matches(MAIN_REGION) || level.closest(NON_DATA_REGIONS) !== null;
}

/** The level's container and a selector naming it and nothing else, or `undefined` when there is none. */
function naming(level: Element): { container: string; selector: string; confidence: number } | undefined {
  const parent = level.parentElement;
  if (!parent) return undefined;
  const container = selectorFor(parent);
  const item = generalizedItemSelector([level], container);
  return item === undefined ? undefined : { container, selector: item.selector, confidence: item.confidence };
}

function proposalFor(record: Element): WebAutomationExtractionProposal | undefined {
  const named = naming(record);
  const fields = inferFields(record, [record]);
  if (!named || fields.length === 0) return undefined;
  const coverage = fields.reduce((total, field) => total + field.coverage, 0) / fields.length;
  return {
    container: named.container,
    item: named.selector,
    itemCount: 1,
    fields,
    confidence: Math.round(named.confidence * coverage * LONE_RECORD_DISCOUNT * 100) / 100
  };
}
