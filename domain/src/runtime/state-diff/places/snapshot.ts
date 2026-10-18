// The places of one captured page (t609): the lists it shows with the items in
// each, and where every element that sits in an item or a dialog is, so the
// state diff of a step can say where its control sat and which items it made
// (FluxIQ Core t598, `service/candidate-trial/landed-acts.ts`).
//
// **An item** is a record -- row, card, list line -- the capture placed an
// element in (`../../llm-evidence/elements.ts`, the record address), named by
// the opaque token a permission declaration names a control's record by and a
// build's start-state read lists its items by
// (`../../llm-evidence/control-spot/token.ts`). The record's words never leave
// the domain.
//
// **A list** is where items sit side by side. An item's container is the
// nearest element above it that holds another item too; its list is that
// container together with the shape of the way down to the item: the tag and
// class of each wrapper in between, and the item's own tag and role. The shape
// keeps apart what one high container merely holds together: a header's
// single "recently viewed" card and a mini-cart drawer's single line both have
// the page's body as their nearest container, and only their wrappers tell the
// drawer's line from the card. The item's own class is left out, because a
// site marks a line it has just added ("is-new") and that line is still one of
// the list's. An item alone on its part of the page has no container and is in
// no list.
//
// Lists are keyed by the container's frame and selector (`./key.ts`), since
// handles are positional to one capture. Nothing here is page data on its own:
// the keys stay in the host runtime's memory, and only tokens reach a diff.

import { webControlSpotToken, type WebLlmEvidenceElement, type WebLlmSnapshotBinding } from "../../llm-evidence";
import { webStatePlaceKey } from "./key";

/** With the capture's own record and dialog of each handle, and what each and the page are about (Core t719), as `webTargetSpot` reads them. */
export type WebStateSnapshotPlaces = Pick<WebLlmSnapshotBinding, "records" | "dialogNames" | "subjects" | "pageSubject"> & {
  /** Each list the page shows, by its container's key and the shape down to its items: the items' tokens, in page order. */
  lists: ReadonlyMap<string, readonly string[]>;
  /** The handle of each element that sits in an item or a dialog, or that the page said what it is about (Core t719), by its frame and selector. */
  handles: ReadonlyMap<string, string>;
};

/** Far past any page's nesting; a guard on the walk up, not a bound on what is read. */
const MAX_DEPTH = 256;

/** The lists and the element places of the page `binding` was sanitized from (header). */
export function webStateSnapshotPlaces(binding: WebLlmSnapshotBinding): WebStateSnapshotPlaces {
  const { evidence, selectors, records } = binding;
  const dialogNames = binding.dialogNames ?? new Map<string, string>();
  const byHandle = new Map(evidence.elements.map((element) => [element.target, element]));
  const keyOf = (handle: string): string | undefined => {
    const selector = selectors.get(handle);
    return selector === undefined ? undefined : webStatePlaceKey(byHandle.get(handle)?.frameId, selector);
  };
  const ancestors = (handle: string): string[] => {
    const above: string[] = [];
    for (let at = byHandle.get(handle)?.parent; at !== undefined && above.length < MAX_DEPTH; at = byHandle.get(at)?.parent) above.push(at);
    return above;
  };

  // Each item's first element in page order, and the items every element holds.
  const first = new Map<string, string>();
  const under = new Map<string, Set<string>>();
  for (const element of evidence.elements) {
    const record = records.get(element.target);
    if (record === undefined) continue;
    const token = webControlSpotToken("item", record);
    if (!first.has(token)) first.set(token, element.target);
    for (const above of ancestors(element.target)) {
      const held = under.get(above) ?? new Set<string>();
      held.add(token);
      under.set(above, held);
    }
  }

  const lists = new Map<string, string[]>();
  for (const [token, handle] of first) {
    const above = ancestors(handle);
    const reach = above.findIndex((ancestor) => (under.get(ancestor)?.size ?? 0) >= 2);
    if (reach < 0) continue;
    const container = keyOf(above[reach] as string);
    if (container === undefined) continue;
    const wrappers = above.slice(0, reach).reverse().map((wrapper) => wrapperShape(byHandle.get(wrapper)));
    const list = [container, ...wrappers, itemShape(byHandle.get(handle))].join("\u0001");
    lists.set(list, [...(lists.get(list) ?? []), token]);
  }

  const handles = new Map<string, string>();
  for (const element of evidence.elements) {
    if (!records.has(element.target) && !dialogNames.has(element.target) && !binding.subjects?.has(element.target)) continue;
    const key = keyOf(element.target);
    if (key !== undefined && !handles.has(key)) handles.set(key, element.target);
  }
  return { lists, handles, records, dialogNames, ...(binding.subjects ? { subjects: binding.subjects } : {}), ...(binding.pageSubject !== undefined ? { pageSubject: binding.pageSubject } : {}) };
}

/** A wrapper between a container and its item: its tag and its class (header). */
function wrapperShape(element: WebLlmEvidenceElement | undefined): string {
  const className = element?.attributes?.find(([name]) => name.toLowerCase() === "class")?.[1] ?? "";
  return `${element?.tag ?? ""}.${className}`;
}

/** The item's own element: its tag and role, never its class (header). */
function itemShape(element: WebLlmEvidenceElement | undefined): string {
  return `${element?.tag ?? ""}#${element?.role ?? element?.implicitRole ?? ""}`;
}
