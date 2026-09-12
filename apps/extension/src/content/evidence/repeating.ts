// Repeating structures: the runs of siblings a page renders from one template.
//
// A list of forty products is one fact, not forty. Without it a reader sees
// forty near-identical descriptors and cannot tell a catalogue from a form,
// cannot say how many rows there are, and cannot name the fields a row exposes
// -- which is exactly what `web.dom.extract_list` needs to be aimed. Worse, the
// state pipeline keys elements by test id, so a run whose rows all carry the
// same one collapses to a single element and the count is lost outright.
//
// Detection is sibling-similarity clustering: group each element's siblings by
// what they have in common, and keep the groups big enough to be a template
// rather than a coincidence. The signature deliberately reduces a test id to
// its shape (`pagination-page-1` becomes `pagination-page-#`), because a page
// that numbers its rows is still rendering one template -- keying on the exact
// id would split every numbered run into singletons.

import { boundedText } from "../identity";
import { selectorFor, testIdFor } from "../describe-element";
import type { RepeatingStructureEvidence } from "./types";

const ITEM_SELECTOR = "li,tr,article,[data-testid],[role='listitem'],[role='row'],[role='option'],[role='article'],[role='treeitem']";
const MAX_SCANNED_ITEMS = 2_000;
const MIN_ITEMS_PER_RUN = 3;
const MAX_STRUCTURES = 6;
const MAX_SIGNATURE_CLASSES = 3;
const MAX_FIELDS = 8;
const MAX_REPRESENTATIVE_TEXT = 160;

/** The page's repeating runs, biggest first, or `undefined` when nothing repeats. */
export function repeatingEvidence(): RepeatingStructureEvidence[] | undefined {
  const runs = clusterSiblings();
  if (!runs.length) return undefined;
  return runs
    .sort((left, right) => right.items.length - left.items.length)
    .slice(0, MAX_STRUCTURES)
    .map(describeRun);
}

type SiblingRun = { container: Element; signature: string; items: Element[] };

function clusterSiblings(): SiblingRun[] {
  const byContainer = new Map<Element, Map<string, Element[]>>();
  let scanned = 0;
  for (const element of document.querySelectorAll(ITEM_SELECTOR)) {
    scanned += 1;
    if (scanned > MAX_SCANNED_ITEMS) break;
    const container = element.parentElement;
    if (!container) continue;
    const groups = byContainer.get(container) ?? new Map<string, Element[]>();
    byContainer.set(container, groups);
    const signature = itemSignature(element);
    const group = groups.get(signature);
    if (group) group.push(element);
    else groups.set(signature, [element]);
  }

  const runs: SiblingRun[] = [];
  for (const [container, groups] of byContainer) {
    for (const [signature, items] of groups) {
      if (items.length >= MIN_ITEMS_PER_RUN) runs.push({ container, signature, items });
    }
  }
  return runs;
}

/** What two rows of the same template share: tag, role, test-id shape, and the classes they are styled by. */
function itemSignature(element: Element): string {
  const role = element.getAttribute("role")?.trim().toLowerCase() ?? "";
  const classes = [...element.classList].sort().slice(0, MAX_SIGNATURE_CLASSES).join(".");
  return `${element.tagName.toLowerCase()}|${role}|${identifierShape(testIdFor(element))}|${classes}`;
}

/** A test id with its numbers replaced, so `row-1` and `row-2` are one template rather than two. */
function identifierShape(value: string | undefined): string {
  return value === undefined ? "" : value.replace(/\d+/gu, "#");
}

function describeRun(run: SiblingRun): RepeatingStructureEvidence {
  const first = run.items[0];
  const testId = first ? testIdFor(first) : undefined;
  const text = first ? boundedText(first.textContent, MAX_REPRESENTATIVE_TEXT) : undefined;
  const fields = first ? itemFields(first) : [];
  return {
    containerSelector: selectorFor(run.container),
    signature: run.signature,
    itemCount: run.items.length,
    representative: {
      selector: first ? selectorFor(first) : run.signature,
      ...(testId ? { testId } : {}),
      ...(text ? { text } : {})
    },
    ...(fields.length ? { fields } : {})
  };
}

/** The test ids inside one item, which is how a page names the fields of a row. */
function itemFields(item: Element): string[] {
  const fields = new Set<string>();
  for (const element of item.querySelectorAll("[data-testid],[data-test],[data-cy]")) {
    const id = testIdFor(element);
    if (id) fields.add(identifierShape(id));
    if (fields.size >= MAX_FIELDS) break;
  }
  return [...fields];
}
