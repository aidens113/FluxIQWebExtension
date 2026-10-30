// Which of a detected list's fields say which item a row is, and each item's
// key by them (contract CC3: `rowIdentity?: fieldId[]` and a stable per-row
// `itemKey?`).
//
// The fields that name an item rather than describe it are its link and its
// id: the item's own address, or the address of a link every item has, or an
// attribute named as the item's id (`data-item-id`). These are what Core's
// re-find already keys on (`../../../target-reacquire/row-key-columns.ts`:
// link targets and ids, never a count or a time), and what the extension's
// tracking-free link identity exists for (`content/extraction/link-identity/`).
//
// One field is the identity only when the capture proves it: every one of the
// run's items is in the capture, each has exactly one element for the field
// with a value, and no two items share a value. The first field that does, in
// the order above, is the identity, and each item's key is its value: a link's
// path and query on its own site (no origin, no fragment), an attribute as
// written, screened as every page string the domain publishes. No field that
// passes means no `rowIdentity`, which Core reads as the whole row.

import type { WebLlmCaptureWalk, WebLlmTreeNode } from "../first-item";
import { isWithheldText, screenedPageText } from "../../withheld";
import type { WebLlmListItemField } from "./item-marks";

/** An attribute named as the item's id. */
const ID_ATTRIBUTE = /^data-(?:[\w-]*-)?(?:id|sku|key|slug)$/iu;

/** The identity field and each item's key, in list order, or `undefined` when no field proves one (header). */
export function webLlmRowIdentity(itemCount: number, fields: readonly WebLlmListItemField[], walk: WebLlmCaptureWalk | undefined): { field: string; keys: string[] } | undefined {
  if (walk === undefined || walk.items.length === 0 || walk.items.length !== itemCount) return undefined;
  const candidates = fields.filter((field) => field.coverage >= 1 && field.spec.mark === undefined && identifying(field));
  // The item's own address first, then any other link, then an id attribute.
  const ordered = [
    ...candidates.filter((field) => field.spec.kind === "link" && field.spec.selector === undefined),
    ...candidates.filter((field) => field.spec.kind === "link" && field.spec.selector !== undefined),
    ...candidates.filter((field) => field.spec.kind === "attribute")
  ];
  for (const field of ordered) {
    const keys = walk.items.map((item) => keyOf(walk, item, field));
    if (keys.some((key) => key === undefined)) continue;
    if (new Set(keys).size !== keys.length) continue;
    return { field: field.key, keys: keys as string[] };
  }
  return undefined;
}

function identifying(field: WebLlmListItemField): boolean {
  if (field.spec.kind === "link") return true;
  return field.spec.kind === "attribute" && field.spec.attribute !== undefined && ID_ATTRIBUTE.test(field.spec.attribute);
}

/** The item's value for the field, as its key; `undefined` where it has none, several, or one the screen withholds. */
function keyOf(walk: WebLlmCaptureWalk, item: WebLlmTreeNode, field: WebLlmListItemField): string | undefined {
  const nodes = walk.elementsOf(item, field.spec);
  if (nodes === undefined || nodes.length !== 1) return undefined;
  const node = nodes[0]!;
  const raw = field.spec.kind === "link" ? linkPath(node.element.href ?? node.attributes.href) : node.attributes[(field.spec.attribute ?? "").toLowerCase()];
  const said = screenedPageText(raw);
  return said === undefined || isWithheldText(said) || said.trim() === "" ? undefined : said.trim();
}

/** A link's path and query on its own site: never its origin, never a fragment. */
function linkPath(href: string | undefined): string | undefined {
  if (href === undefined || !URL.canParse(href, "http://page.invalid/")) return undefined;
  const url = new URL(href, "http://page.invalid/");
  return url.protocol === "http:" || url.protocol === "https:" ? `${url.pathname}${url.search}` : undefined;
}
