import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { webNodeReadResult } from "../node-run/read-result";

const STATES = new Set(["aria-checked", "aria-selected", "aria-pressed", "aria-expanded", "aria-disabled", "disabled"]);

/** Facts from the already sanitized capture, without page text, targets, geometry, selectors or arbitrary attributes. */
export function webJudgeStateFacts(evidence: WebLlmPageEvidence): JsonObject {
  const parents = new Set(evidence.elements.flatMap((element) => element.parent === undefined ? [] : [element.parent]));
  const controls: JsonObject[] = [];
  const notices: JsonObject[] = [];
  const marks: JsonObject[] = [];
  for (const element of evidence.elements) {
    const attributes = element.attributes ?? [];
    const stated = attributes.filter(([key]) => STATES.has(key));
    const stateful = element.value !== undefined || element.checked !== undefined || element.selectedValue !== undefined || element.expanded !== undefined || stated.length > 0;
    if (stateful) controls.push(facts(element, stated));
    if (element.marked === true) marks.push(facts(element, stated));
    const notice = element.role === "alert" || element.role === "status" || element.role === "log" || element.tag === "output";
    const hiddenLeaf = element.hidden === true && (!parents.has(element.target) || element.ownText !== undefined);
    if (notice || hiddenLeaf) {
      const fact = facts(element, stated);
      const text = element.ownText ?? element.readable ?? element.text;
      if (text !== undefined) fact.text = text;
      notices.push(fact);
    }
  }
  // Reuse the domain's existing unlimited value/credential/denied-key screen.
  // The Core request builder screens this again using the current declaration.
  return webNodeReadResult({ version: 1, location: evidence.location, controls, notices, marks, ...(evidence.title === undefined ? {} : { title: evidence.title }), ...(evidence.captureTruncated === true || evidence.truncated ? { truncated: true } : {}) }) as JsonObject;
}

function facts(element: WebLlmEvidenceElement, stated: Array<[string, string]>): JsonObject {
  const out: JsonObject = { tag: element.tag };
  for (const key of ["role", "name", "label", "group", "heading", "within", "value", "selectedValue", "checked", "expanded", "marked", "hidden"] as const) if (element[key] !== undefined) out[key] = element[key];
  if (element.name === undefined && element.label === undefined) {
    const words = element.readable ?? element.ownText ?? element.text;
    if (words !== undefined) out.name = words;
  }
  if (stated.length) out.state = Object.fromEntries(stated);
  return out;
}
