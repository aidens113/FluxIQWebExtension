// The lists and tables on a page that are positively whole, so an item absent
// from one can witness that an act's effect is gone (FluxIQ Core site reset).
//
// A list vouches for itself one of two ways, never by DOM absence alone:
//
// - **ARIA set sizes** (unchanged): every item of a `list` says how many the
//   set holds and where it stands, and the page holds them all.
// - **Native** (l1 D1): most pages write no set sizes, so a plain list or
//   table vouches where the capture saw it whole -- the extension's own
//   continuation detectors found no Next, Load more or declared feed
//   (`WebLlmEvidenceElement.listWayOn === "none"`,
//   `apps/extension/src/content/extraction/read-coverage/list-way-on.ts`), the
//   capture was not cut, and the list is not marked busy. An absent word is
//   not `none`. A list whose items carry set sizes is read by them alone.
//
// Either way each item -- a list's `listitem`, a table's or grid's `row` less
// its header rows -- holds exactly one subject, and no two the same.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webControlSpotToken } from "./token";

type Page = Partial<Pick<WebLlmSnapshotBinding, "evidence" | "selectors" | "subjects" | "resetResource">>;

type Collection = { scope: string; group: string; subjects: string[]; states: Record<string, string> };

/** A kind of container: the roles it has, the role of its items, and whether ARIA set sizes may vouch for it. */
type Kind = { containers: ReadonlySet<string>; item: string; aria: boolean };

const KINDS: readonly Kind[] = [
  { containers: new Set(["list"]), item: "listitem", aria: true },
  { containers: new Set(["table", "grid"]), item: "row", aria: false }
];

const CELL_ROLES: ReadonlySet<string> = new Set(["cell", "gridcell", "columnheader", "rowheader"]);

/** The fields a row's state token is made of, for the row and everything inside it. */
const STATE_KEYS = ["tag", "role", "implicitRole", "name", "text", "value", "checked", "selected", "disabled"] as const;

/** Only a positively complete semantic collection can witness absence. DOM absence alone cannot. */
export function webResetCollections(page: Page): { controls: ReadonlyMap<string, string>; collections: Collection[] } {
  const controls = new Map<string, string>();
  const collections: Collection[] = [];
  if (!page.resetResource || !page.evidence || !page.selectors || !page.subjects) return { controls, collections };
  const evidence = page.evidence;
  const tree = pageTree(evidence.elements);
  const whole = !evidence.truncated && evidence.captureTruncated !== true;
  for (const kind of KINDS) {
    const owner = (handle: string) => tree.ancestors(handle).find((above) => kind.containers.has(tree.role(above) ?? ""));
    const nearestItem = (handle: string) => tree.ancestors(handle).find((above) => tree.role(above) === kind.item);
    for (const list of evidence.elements.filter((element) => kind.containers.has(tree.role(element.target) ?? ""))) {
      const items = evidence.elements.filter((element) => tree.role(element.target) === kind.item && owner(element.target) === list.target);
      const rows = kind.item === "row" ? items.filter((row) => !isHeaderRow(tree, row.target, list.target)) : items;
      const aria = rows.some((row) => tree.attribute(row.target, "aria-setsize") !== undefined);
      // Unknown, virtualized, lazy or partial sets cannot vouch for absence.
      if (aria ? !(kind.aria && ariaWhole(tree, rows)) : !(whole && nativeWhole(tree, list, rows))) continue;
      const rowSubjects = subjectsOf(rows, page.subjects, nearestItem);
      if (rowSubjects === undefined) continue;
      const selector = page.selectors.get(list.target);
      if (!selector) continue;
      const group = webControlSpotToken("scope", `${page.resetResource}\0${evidence.location}\0${list.frameId ?? 0}`);
      const scope = webControlSpotToken("scope", `${group}\0${selector}`);
      const rowStates = statesOf(tree, evidence.elements, rows);
      collections.push({ scope, group, subjects: rowSubjects, states: Object.fromEntries(rowSubjects.map((subject, index) => [subject, rowStates[index]!])) });
      for (const element of evidence.elements) {
        if (owner(element.target) === list.target) controls.set(element.target, scope);
      }
    }
  }
  return { controls, collections };
}

/** The packet as a tree, asked by handle; ancestors are walked once per element. */
type PageTree = {
  role(handle: string): string | undefined;
  tag(handle: string): string | undefined;
  ancestors(handle: string): readonly string[];
  children(handle: string): readonly string[];
  attribute(handle: string, name: string): string | undefined;
  count(handle: string, name: string): number | undefined;
};

function pageTree(elements: readonly WebLlmEvidenceElement[]): PageTree {
  const byHandle = new Map(elements.map((element) => [element.target, element]));
  const above = new Map<string, readonly string[]>();
  const below = new Map<string, string[]>();
  for (const element of elements) {
    if (element.parent === undefined) continue;
    const siblings = below.get(element.parent);
    if (siblings) siblings.push(element.target);
    else below.set(element.parent, [element.target]);
  }
  const attribute = (handle: string, name: string) => byHandle.get(handle)?.attributes?.find(([key]) => key === name)?.[1];
  return {
    role: (handle) => {
      const element = byHandle.get(handle);
      return element?.role ?? element?.implicitRole;
    },
    tag: (handle) => byHandle.get(handle)?.tag,
    ancestors: (handle) => {
      const known = above.get(handle);
      if (known) return known;
      const found: string[] = [];
      for (let at = byHandle.get(handle)?.parent; at !== undefined && found.length < 256; at = byHandle.get(at)?.parent) found.push(at);
      above.set(handle, found);
      return found;
    },
    children: (handle) => below.get(handle) ?? [],
    attribute,
    count: (handle, name) => {
      const value = attribute(handle, name);
      return value !== undefined && /^(?:0|[1-9][0-9]*)$/u.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
    }
  };
}

/** Every item says the set's size, every size agrees and is the count of items, and every position is in it once. */
function ariaWhole(tree: PageTree, rows: readonly WebLlmEvidenceElement[]): boolean {
  const total = rows[0] ? tree.count(rows[0].target, "aria-setsize") : undefined;
  if (total === undefined || total < 1 || total !== rows.length) return false;
  const positions = rows.map((row) => tree.count(row.target, "aria-posinset"));
  return !positions.some((position) => position === undefined || position < 1 || position > total)
    && new Set(positions).size === total
    && rows.every((row) => tree.count(row.target, "aria-setsize") === total);
}

/** The capture saw the list end, it holds an item, and the page does not say it is still changing it. */
function nativeWhole(tree: PageTree, list: WebLlmEvidenceElement, rows: readonly WebLlmEvidenceElement[]): boolean {
  return list.listWayOn === "none" && rows.length > 0 && tree.attribute(list.target, "aria-busy") !== "true";
}

/** A row in the table's `thead`, or one whose every cell is a column header. */
function isHeaderRow(tree: PageTree, row: string, table: string): boolean {
  const path = tree.ancestors(row);
  const between = path.slice(0, Math.max(0, path.indexOf(table)));
  if (between.some((handle) => tree.tag(handle) === "thead")) return true;
  const cells = tree.children(row).filter((handle) => CELL_ROLES.has(tree.role(handle) ?? ""));
  return cells.length > 0 && cells.every((handle) => tree.role(handle) === "columnheader");
}

/** Each row's one subject token, in row order, or `undefined` when a row holds none or several, or two rows share one. */
function subjectsOf(rows: readonly WebLlmEvidenceElement[], subjects: ReadonlyMap<string, string>, nearestItem: (handle: string) => string | undefined): string[] | undefined {
  const byRow = new Map<string, Set<string>>(rows.map((row) => [row.target, new Set<string>()]));
  for (const [handle, subject] of subjects) {
    const row = byRow.get(handle) ?? byRow.get(nearestItem(handle) ?? "");
    row?.add(webControlSpotToken("subject", subject));
  }
  const tokens: string[] = [];
  for (const row of rows) {
    const held = byRow.get(row.target)!;
    if (held.size !== 1) return undefined;
    tokens.push([...held][0]!);
  }
  return new Set(tokens).size === tokens.length ? tokens : undefined;
}

/** Each row's state token: the semantic fields of the row and of everything inside it, in page order. */
function statesOf(tree: PageTree, elements: readonly WebLlmEvidenceElement[], rows: readonly WebLlmEvidenceElement[]): string[] {
  const inside = new Map<string, unknown[][]>(rows.map((row) => [row.target, []]));
  for (const element of elements) {
    const state = element as unknown as Record<string, unknown>;
    const semantic = STATE_KEYS.map((key) => state[key] ?? null);
    for (const handle of [element.target, ...tree.ancestors(element.target)]) inside.get(handle)?.push(semantic);
  }
  return rows.map((row) => webControlSpotToken("scope", `state\0${JSON.stringify(inside.get(row.target))}`));
}
