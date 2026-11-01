import type { FieldSource } from "../infer-fields";
import { definitionAssociations } from "./association";

/** The semantic sources of one row, and the list content they replace. */
export function definitionFieldSources(item: Element): { sources: ReadonlyMap<Element, FieldSource>; owns(element: Element): boolean } {
  const sources = new Map<Element, FieldSource>();
  for (const pair of definitionAssociations(item)) {
    sources.set(pair.name, { kind: "text", label: `${pair.term} label`, definition: { term: pair.term, part: "term" }, sensitive: false });
    sources.set(pair.value, { kind: "text", label: pair.term, definition: { term: pair.term, part: "value" }, sensitive: false });
  }
  return {
    sources,
    owns(element): boolean {
      // Even an unreadable pair belongs to its list; emitting its leaves by
      // position would bypass the association's ambiguity and privacy checks.
      for (let current: Element | null = element; current; current = current.parentElement) {
        if (current.tagName.toUpperCase() === "DL") return true;
        if (current === item) break;
      }
      return false;
    }
  };
}
