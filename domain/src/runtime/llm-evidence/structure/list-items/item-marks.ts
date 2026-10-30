// Which of a detected list's items carry each mark (contract CC2: per item
// `marks?: {[id]: on|off}`), read off the detection's own capture.
//
// A mark is a field the page proposed as one (`mark` on its spec:
// `apps/extension/src/content/extraction/item-mark/`, `badge-name.ts`). An item
// carries it where the field's element is there in that item and states the
// mark: a badge's or a state's element at all (a state's selector names it only
// while it is on), a flag's attribute written anything but `"false"`.
//
// **A capture that cannot answer says nothing rather than "off".** The capture
// lists what the page renders, and a mark drawn by an element it does not list
// (an `<svg>`'s `<title>`) would read as missing on every item. So a mark's
// items are said only where the capture holds exactly the run's items and
// finds the field's element in exactly as many of them as the page counted
// when it measured the field's coverage over the same run; any other mark is
// left out of every item, and Core reads it as unknown.

import type { WebAutomationExtractionProposalFieldSpec } from "../../../../extraction";
import type { WebLlmCaptureWalk, WebLlmTreeNode } from "../first-item";

/** One readable field of the list, as the list's items are read for it. */
export type WebLlmListItemField = { key: string; label: string; spec: WebAutomationExtractionProposalFieldSpec; coverage: number };

/**
 * Each item's marks, in list order, for the marks the capture can answer for
 * (header); `undefined` when it can answer for none.
 */
export function webLlmItemMarks(itemCount: number, fields: readonly WebLlmListItemField[], walk: WebLlmCaptureWalk | undefined): Array<Record<string, "on" | "off">> | undefined {
  if (walk === undefined || walk.items.length === 0 || walk.items.length !== itemCount) return undefined;
  const items = walk.items.map((): Record<string, "on" | "off"> => ({}));
  let answered = false;
  for (const field of fields) {
    if (field.spec.mark === undefined) continue;
    const read = walk.items.map((item) => carries(walk, item, field.spec));
    if (read.some((entry) => entry === undefined)) continue;
    const present = read.filter((entry) => entry !== "absent").length;
    // The page's coverage is rounded to hundredths of the same run (`infer-fields.ts`).
    if (Math.abs(present - field.coverage * itemCount) > 0.5 + itemCount * 0.005) continue;
    read.forEach((entry, index) => {
      items[index]![field.key] = entry === "on" ? "on" : "off";
    });
    answered = true;
  }
  return answered ? items : undefined;
}

/**
 * Whether the item carries the mark: `on`; has the field's element but not the
 * mark (a flag written `"false"`): `off`; has no element for it: `absent`; or
 * `undefined` where the walk cannot tell (a selector form it does not read,
 * several elements where the page reads one).
 */
function carries(walk: WebLlmCaptureWalk, item: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): "on" | "off" | "absent" | undefined {
  const nodes = walk.elementsOf(item, spec);
  if (nodes === undefined || nodes.length > 1) return undefined;
  const node = nodes[0];
  if (node === undefined) return "absent";
  if (spec.kind !== "attribute" || spec.attribute === undefined) return "on";
  const name = spec.attribute.toLowerCase();
  if (!Object.hasOwn(node.attributes, name)) return "absent";
  const written = (node.attributes[name] ?? "").trim().toLowerCase();
  if (spec.mark === "flag") return written === "false" ? "off" : "on";
  return written === "" ? "off" : "on";
}
