// Whether an element in the pass's row is the build's control copied there:
// the rule the page applies before it presses a row's copy
// (`apps/extension/src/content/action-runtime/pass-row/row-data.ts`
// `differsOnlyByRowData`), read from the capture's elements.
//
// Every template signal agrees exactly -- the tag, the written role, an
// input's type, the test ids, the class set -- and a signal that differs is
// row data: a name that is, holds, or is held by one of the pass row's values,
// an id of the same stem with its own per-row code. Links are not weighed: the
// capture's link is written as the page wrote it, and the record the copy sits
// in is already the one holding the row's values, which is what the spot says.

import type { WebLlmEvidenceElement } from "../../../llm-evidence";

/** Attributes whose value is a template's, the same on every row's copy. */
const TEMPLATE_ATTRIBUTES: readonly string[] = ["role", "type", "data-testid", "data-test-id", "data-qa", "name"];

/** Whether `candidate` is `built`'s copy in the pass row holding `values` (header). */
export function webRowCopyMatches(built: WebLlmEvidenceElement, candidate: WebLlmEvidenceElement, values: readonly string[]): boolean {
  if (built.tag !== candidate.tag) return false;
  if (TEMPLATE_ATTRIBUTES.some((name) => attribute(built, name) !== attribute(candidate, name))) return false;
  if (classes(built) !== classes(candidate)) return false;
  return nameIsRowData(collapsed(built.name), collapsed(candidate.name), values) && sameIdPattern(attribute(built, "id"), attribute(candidate, "id"));
}

function attribute(element: WebLlmEvidenceElement, name: string): string | undefined {
  return element.attributes?.find(([written]) => written.toLowerCase() === name)?.[1];
}

function classes(element: WebLlmEvidenceElement): string {
  return [...new Set((attribute(element, "class") ?? "").split(/\s+/u).filter(Boolean))].sort().join(" ");
}

/** Equal names, or a candidate name that is, holds, or is held by one of the row's values. */
function nameIsRowData(built: string | undefined, candidate: string | undefined, values: readonly string[]): boolean {
  if (built === candidate) return true;
  if (!built || !candidate) return false;
  return values.some((raw) => {
    const value = collapsed(raw);
    return value !== undefined && (candidate === value || candidate.includes(value) || value.includes(candidate));
  });
}

/** Equal ids, or two ids of one stem -- the same text up to their last separator -- each with its own code after it. */
function sameIdPattern(built: string | undefined, candidate: string | undefined): boolean {
  if (built === candidate) return true;
  if (!built || !candidate) return false;
  const stem = (id: string): string | undefined => {
    const cut = Math.max(id.lastIndexOf("-"), id.lastIndexOf("_"), id.lastIndexOf(":"), id.lastIndexOf("."));
    return cut > 0 && cut < id.length - 1 ? id.slice(0, cut + 1) : undefined;
  };
  const shared = stem(built);
  return shared !== undefined && shared === stem(candidate);
}

function collapsed(value: string | undefined): string | undefined {
  const text = (value ?? "").replace(/\s+/gu, " ").trim();
  return text || undefined;
}
