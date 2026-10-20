// One element in full (t223, "`web.describe_element`").
//
// The page view prints each element as one short line, and a search prints a
// match the same way. When that is not enough -- which of two alike buttons is
// which, what a field is called in the form, why a control reads as disabled --
// this prints everything the capture holds about one element: its line, every
// attribute whole, its box and where that is, and every other field. It is the
// one place element detail reaches the model, one element at a time, and it is
// still the screened packet's own values: nothing the packet withholds appears.

import { present } from "../present";
import type { WebLlmEvidenceElement } from "../elements";
import { observedElement } from "../press";
import type { WebLlmPageEvidence } from "../sanitize";
import { quotedWords, undoubledWords, webLlmElementKind, webLlmElementWhere, webLlmElementWords, webLlmGroupNames, webLlmPageTree } from "../page-view";
import { WEB_LLM_DESCRIBE_SCHEMA_VERSION } from "./description-schema-version";

export type WebLlmDescribeResult = {
  schemaVersion: typeof WEB_LLM_DESCRIBE_SCHEMA_VERSION;
  trust: WebLlmPageEvidence["trust"];
  /** Where the element was described, exactly as a page's `location`. */
  location: string;
  /** Its line, its attributes, its box, and every other field. */
  element: string;
};

/** Fields printed on their own lines, so not again under `context`. */
const OWN_LINES: ReadonlySet<string> = new Set(["target", "tag", "attributes", "box"]);

/** Fields the model is never shown: how a list goes on is read only by the reset's list check (`../control-spot/collection.ts`, l1 D1). */
const NEVER_PRINTED: ReadonlySet<string> = new Set(["listWayOn"]);

/** Everything the page holds about the element `handle` names; a handle not on the page is refused as unobserved. */
export function webLlmDescribeElement(evidence: WebLlmPageEvidence, handle: string): WebLlmDescribeResult {
  const element = observedElement(evidence, handle);
  const group = webLlmGroupNames(evidence.elements, webLlmPageTree(evidence.elements)).groupOf(element);
  const lines = [headLine(element), attributesLine(element), boxLine(element, evidence), contextLine(element, group)];
  return present<WebLlmDescribeResult>({
    schemaVersion: WEB_LLM_DESCRIBE_SCHEMA_VERSION,
    trust: evidence.trust,
    location: evidence.location,
    element: lines.join("\n")
  });
}

function headLine(element: WebLlmEvidenceElement): string {
  const kind = webLlmElementKind(element);
  const words = webLlmElementWords(element) ?? firstWords(element);
  return [element.target, `<${element.tag}>`, ...(kind === undefined ? [] : [kind]), ...(words === undefined ? [] : [quotedWords(words)])].join(" ");
}

function firstWords(element: WebLlmEvidenceElement): string | undefined {
  const first = [element.name, element.ownText, element.text, element.label].find((value) => value !== undefined && value.trim() !== "");
  return first === undefined ? undefined : undoubledWords(first.replace(/\s+/gu, " ").trim()) || undefined;
}

function attributesLine(element: WebLlmEvidenceElement): string {
  const attributes = element.attributes ?? [];
  return attributes.length === 0 ? "attributes: none" : `attributes: ${attributes.map(([name, value]) => `${name}=${quotedWords(value)}`).join(" ")}`;
}

function boxLine(element: WebLlmEvidenceElement, evidence: WebLlmPageEvidence): string {
  const where = webLlmElementWhere(element, evidence.viewport);
  const box = element.box;
  return box === undefined ? `box: none, ${where}` : `box: x=${box.x} y=${box.y} ${box.width}x${box.height}, ${where}`;
}

/**
 * Every other field. `group` is the group the view and a search name
 * (`../page-view/group-names.ts`): a fieldset's legend as the packet carries
 * it, or the nearest named ARIA group, which only the packet's tree says.
 */
function contextLine(element: WebLlmEvidenceElement, group: string | undefined): string {
  const fields = Object.entries({ ...element, group }).filter(([key, value]) => !OWN_LINES.has(key) && !NEVER_PRINTED.has(key) && value !== undefined);
  return fields.length === 0 ? "context: none" : `context: ${fields.map(([key, value]) => `${key}=${printed(value)}`).join(" ")}`;
}

function printed(value: unknown): string {
  if (typeof value === "string") return quotedWords(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
