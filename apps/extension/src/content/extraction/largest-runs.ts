// The page's repeating runs, largest first, as places to start an inference
// when nobody picked an element.
//
// A run is three or more siblings of one template, grouped by the same
// signature the picker groups a picked element's siblings by
// (`infer-list.ts`), so a run found here is a run the inference will accept.
// Every element that has children is a candidate container, which is broader
// than the page evidence's own scan (`evidence/repeating.ts` looks only at
// list-like tags): a product grid of plain `div`s is a list to a person, and it
// is here.
//
// What is left out is what is not data: runs inside navigation, a footer, a
// menu, a listbox, a tab list, a `<select>` or an `<svg>`, and runs whose first
// item is not rendered. A site's menu is a list of links, and "the largest
// list on the page" should not be its mega-menu.

import { isRecordItemTag, itemTemplateSignature } from "./infer-list";

/** What the page's own repeating evidence calls a template rather than a coincidence. */
const MIN_ITEMS_PER_RUN = 3;

/** Elements scanned for containers, so a huge page costs a bounded walk. Containers met early are kept either way. */
const MAX_SCANNED_ELEMENTS = 10_000;

/** How many runs are offered, largest first. Each costs an inference. */
const MAX_OFFERED_RUNS = 12;

/** Tags whose children are never records. */
const NON_DATA_CONTAINER_TAGS = new Set(["HEAD", "SCRIPT", "STYLE", "TEMPLATE", "SELECT", "DATALIST", "OPTGROUP", "NOSCRIPT"]);

/** Regions a run inside is navigation or chrome rather than data. */
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

/** The first item of each run on the page, largest run first, document order breaking ties. */
export function largestRunsFirst(): Element[] {
  const runs: Array<{ first: Element; size: number }> = [];
  const seen = new Set<Element>();
  let scanned = 0;
  for (const element of document.body?.querySelectorAll("*") ?? []) {
    scanned += 1;
    if (scanned > MAX_SCANNED_ELEMENTS) break;
    const container = element.parentElement;
    if (!container || seen.has(container)) continue;
    seen.add(container);
    if (container.childElementCount < MIN_ITEMS_PER_RUN || !holdsData(container)) continue;
    for (const items of templateGroups(container)) {
      const first = items[0];
      if (first && items.length >= MIN_ITEMS_PER_RUN && first.getClientRects().length > 0) runs.push({ first, size: items.length });
    }
  }
  // `sort` is stable, so equal runs stay in document order.
  return runs.sort((left, right) => right.size - left.size).slice(0, MAX_OFFERED_RUNS).map((run) => run.first);
}

function holdsData(container: Element): boolean {
  return !NON_DATA_CONTAINER_TAGS.has(container.tagName.toUpperCase()) && container.closest(NON_DATA_REGIONS) === null;
}

function templateGroups(container: Element): Element[][] {
  const groups = new Map<string, Element[]>();
  for (const child of container.children) {
    if (!isRecordItemTag(child.tagName)) continue;
    const signature = itemTemplateSignature(child);
    const group = groups.get(signature);
    if (group) group.push(child);
    else groups.set(signature, [child]);
  }
  return [...groups.values()];
}
