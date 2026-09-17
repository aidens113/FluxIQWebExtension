// The extraction a picked element proposes (C4): the repeating list it belongs
// to, the fields each item exposes, and how the list continues.
//
// The user picks a value, not a record -- a product's name, a price cell -- so
// the record is found by walking outward from what was picked. At each level the
// element's siblings are grouped by the domain's template signature, the same
// string `content/evidence/repeating.ts` groups a page's repeating runs by, so
// the run the picker proposes is the run the page's own evidence reports. The
// nearest run of at least three items wins, three being what the evidence
// already calls a template rather than a coincidence.
//
// **A table cell is never the record.** A row's four cells are four siblings of
// one template, so a price cell's own level always looks like a run -- and it is
// a run of the record's columns, which `infer-fields.ts` proposes as `column`
// fields. Skipping `<td>` and `<th>` is what makes picking a cell propose the
// twelve rows rather than the four columns.
//
// A level is only accepted once it can be named: `item-selector.ts` must find a
// selector that matches exactly the run, and the item must expose at least one
// field. A level that fails either is not the record -- the walk goes on
// outward rather than proposing a list nothing can read.
//
// Confidence is the item selector's strength multiplied by the average coverage
// of the fields: a run named by a test id every item shares, whose fields are in
// every item, is 1, and everything read structurally or unevenly is less.
//
// Nothing here reads a page value (decision D3). What a proposal carries is
// selectors, labels built from structure, counts and coverage.

import { webAutomationItemSignature, type WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import { testIdFor } from "../describe-element";
import { selectorFor } from "../selector";
import { detectPagination } from "./detect-pagination";
import { inferFields } from "./infer-fields";
import { generalizedItemSelector } from "./item-selector";

/** What the page's own repeating evidence calls a template rather than a coincidence (`evidence/repeating.ts`). */
const MIN_ITEMS_PER_RUN = 3;

/** The elements that are a record's columns, never the record. */
const FIELD_CELL_TAGS = new Set(["TD", "TH"]);

/** Whether a run of these elements could be a record's items at all; see the header. */
export function isRecordItemTag(tagName: string): boolean {
  return !FIELD_CELL_TAGS.has(tagName.toUpperCase());
}

/**
 * The extraction `picked` proposes, or `undefined` when it belongs to no
 * repeating run that can be named and read.
 */
export function inferListFromElement(picked: Element): WebAutomationExtractionProposal | undefined {
  for (let level: Element | null = picked; level && level !== document.documentElement; level = level.parentElement) {
    const proposal = proposalForLevel(level);
    if (proposal) return proposal;
  }
  return undefined;
}

function proposalForLevel(level: Element): WebAutomationExtractionProposal | undefined {
  if (!isRecordItemTag(level.tagName)) return undefined;
  const container = level.parentElement;
  if (!container || container === document.documentElement) return undefined;
  const run = sameTemplateSiblings(level, container);
  if (run.length < MIN_ITEMS_PER_RUN) return undefined;

  const containerSelector = selectorFor(container);
  const item = generalizedItemSelector(run, containerSelector);
  if (!item) return undefined;
  const first = run[0];
  if (!first) return undefined;
  const fields = inferFields(first, run);
  if (fields.length === 0) return undefined;

  const pagination = detectPagination(run, container);
  return {
    container: containerSelector,
    item: item.selector,
    itemCount: run.length,
    fields,
    ...(pagination === undefined ? {} : { pagination }),
    confidence: Math.round(item.confidence * meanCoverage(fields) * 100) / 100
  };
}

/** The element's siblings rendered from the same template, itself included, in document order. */
function sameTemplateSiblings(element: Element, container: Element): Element[] {
  const signature = itemTemplateSignature(element);
  return Array.from(container.children).filter((child) => isRecordItemTag(child.tagName) && itemTemplateSignature(child) === signature);
}

/** The template an item is rendered from, as every grouping of siblings in this directory spells it. */
export function itemTemplateSignature(element: Element): string {
  return webAutomationItemSignature({
    tagName: element.tagName,
    role: element.getAttribute("role"),
    testId: testIdFor(element),
    classes: element.classList
  });
}

function meanCoverage(fields: ReadonlyArray<{ coverage: number }>): number {
  return fields.reduce((total, field) => total + field.coverage, 0) / fields.length;
}
