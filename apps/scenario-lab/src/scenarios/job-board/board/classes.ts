import { buildClassNames } from "../../../build-classes.js";

/** Every style the board's build emits, by role. None of them is a role on the page: one hash can style many controls. */
const ROLES = [
  "shell", "header", "logo", "nav", "navLink", "myJobs", "badge", "headerRight", "main", "footer",
  "search", "field", "fieldLabel", "fieldInput", "searchButton",
  "filters", "pillWrap", "pill", "pillActive", "pillMenu", "pillOption", "pillChosen",
  "meta", "metaTitle", "count", "sort",
  "layout", "left", "list", "item", "card", "cardSelected", "cardHead", "cardTitle", "cardCompany", "cardSalary", "cardTags", "tag", "cardSnippet", "cardFoot",
  "heart", "heartOn", "heartBusy",
  "pane", "paneEmpty", "skeleton", "skeletonLine", "paneRoot", "paneHead", "paneTitle", "paneCompany", "paneMeta", "paneActions",
  "applyButton", "easyButton", "moreButton", "menu", "menuItem", "paneBody", "paneFoot", "closed", "similar", "slow",
  "wall", "wallCard", "wallButton", "wallLater",
  "pager", "pageLink", "pageCurrent", "perPage", "empty", "recommend",
  "toast", "toastAction", "backdrop", "modal", "modalClose", "modalInput", "modalButton", "modalLater",
  "tabs", "tab", "tabOn", "savedList", "savedRow", "savedSummary", "status", "panel", "notice", "retry",
] as const;

export type BoardClasses = Record<(typeof ROLES)[number], string>;

/**
 * Rolefinch's class names for a lab seed. The board ships from a CSS-in-JS
 * build whose hashes move with every build, and each lab seed is another
 * build: nothing about a class name survives a seed change.
 */
export function boardClasses(seed: number): BoardClasses {
  return buildClassNames(`rolefinch-${seed}`, ROLES);
}

/** An element id that rotates with the seed, the way a framework's generated ids do. */
export function rotatingId(seed: number, prefix: string, key: string): string {
  let value = 0x811c9dc5 ^ seed;
  for (const character of `${prefix}:${key}`) value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return `${prefix}-${value.toString(36)}`;
}
