import { isWithinSensitiveControl } from "../../sensitive-text";

type Association = { term: string; name: Element; value: Element };
type Candidate = { term: string; name: Element; values: Element[] };

const NON_RECORD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
const CONTROL_ROLES = new Set(["button", "textbox", "combobox", "checkbox", "radio", "switch", "listbox", "slider", "spinbutton"]);

/** Exact, unique semantic pairs in the item's own lists, or in explicitly scoped lists. No value text is read here. */
export function definitionAssociations(item: Element, selector?: string): Association[] {
  const scopes = selector === undefined || selector === ":scope" ? [item] : [...item.querySelectorAll(selector)];
  const lists = new Set<Element>();
  const collect = (root: Element): void => {
    if (root.tagName.toUpperCase() === "DL") lists.add(root);
    else for (const child of root.children) collect(child);
  };
  for (const scope of scopes) collect(scope);
  const candidates: Candidate[] = [];
  for (const list of lists) {
    let flat: Element[] = [];
    const flush = (): void => {
      candidates.push(...groupCandidates(flat));
      flat = [];
    };
    for (const child of list.children) {
      if (child.tagName.toUpperCase() === "DIV") {
        flush();
        candidates.push(...groupCandidates([...child.children]));
      } else flat.push(child);
    }
    flush();
  }
  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(candidate.term, (counts.get(candidate.term) ?? 0) + 1);
  return candidates.flatMap(({ term, name, values }) => {
    const value = values[0];
    return counts.get(term) === 1 && values.length === 1 && value !== undefined && readable(value)
      ? [{ term, name, value }]
      : [];
  });
}

/** Direct dt groups own the following direct dd group; a nested list can never donate a term or a value. */
function groupCandidates(children: readonly Element[]): Candidate[] {
  const candidates: Candidate[] = [];
  let names: Element[] = [];
  let values: Element[] = [];
  const flush = (): void => {
    for (const name of names) {
      if (!readable(name)) continue;
      const term = (name.textContent ?? "").replace(/\s+/gu, " ").trim();
      if (term !== "") candidates.push({ term, name, values });
    }
    names = [];
    values = [];
  };
  for (const child of children) {
    const tag = child.tagName.toUpperCase();
    if (tag === "DT") {
      if (values.length > 0) flush();
      names.push(child);
    } else if (tag === "DD") values.push(child);
    else flush();
  }
  flush();
  return candidates;
}

/** Check the whole association before reading even its structural label. Hidden or control content is never an identity. */
function readable(element: Element): boolean {
  if (isWithinSensitiveControl(element)) return false;
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (undrawn(current) || control(current)) return false;
  }
  for (const child of element.querySelectorAll("*")) {
    if (child.tagName.toUpperCase() === "DL" || isWithinSensitiveControl(child) || undrawn(child) || control(child)) return false;
  }
  return true;
}

function control(element: Element): boolean {
  const editable = element.getAttribute("contenteditable")?.toLowerCase();
  return NON_RECORD_TAGS.has(element.tagName.toUpperCase())
    || editable === "" || editable === "true" || editable === "plaintext-only"
    || (element.getAttribute("role") ?? "").toLowerCase().split(/\s+/u).some((role) => CONTROL_ROLES.has(role));
}

function undrawn(element: Element): boolean {
  if (element.hasAttribute("hidden") || element.hasAttribute("inert") || element.getAttribute("aria-hidden")?.toLowerCase() === "true") return true;
  const view = element.ownerDocument?.defaultView;
  const style = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(element) : undefined;
  return style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse" || style?.contentVisibility === "hidden";
}
