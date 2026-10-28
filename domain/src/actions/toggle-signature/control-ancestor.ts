// Whether the ancestor `level` steps above a pressed element (1 is its parent)
// can still be part of the same control: a control's state is drawn on the
// element itself or on a wrapper a step or two up, never on the row, list,
// form or page that holds many controls.

const CONTAINERS = new Set(["li", "ul", "ol", "tr", "tbody", "thead", "table", "form", "main", "body", "html", "section", "article", "aside", "nav", "header", "footer", "dialog"]);
const CONTAINER_ROLES = new Set(["listitem", "list", "row", "grid", "table", "form", "main", "region", "article", "dialog", "group", "toolbar", "radiogroup", "menu", "tablist"]);

export function webToggleControlAncestor(level: number, tag: string | undefined, role: string | undefined): boolean {
  if (level < 1 || level > 2 || tag === undefined) return false;
  return !CONTAINERS.has(tag.toLowerCase()) && !CONTAINER_ROLES.has((role ?? "").toLowerCase());
}
