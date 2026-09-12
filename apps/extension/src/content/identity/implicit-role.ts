// The ARIA role an element has by virtue of its markup, with no `role`
// attribute written on it. The descriptor already carries the explicit `role`
// attribute; this is the other half, so a page that never writes ARIA still
// gives Core's fingerprint a role signal, and so a `<input role="combobox">`
// can be told from the `combobox` it is dressed as.
//
// This is the common subset of the HTML-AAM mapping, not the whole of it: the
// elements a browser-automation corpus actually meets. An element outside the
// table has no implicit role reported rather than a guessed one.

const INPUT_TYPE_ROLES: Record<string, string> = {
  "": "textbox",
  text: "textbox",
  search: "searchbox",
  email: "textbox",
  tel: "textbox",
  url: "textbox",
  number: "spinbutton",
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  button: "button",
  submit: "button",
  reset: "button",
  image: "button"
};

const TAG_ROLES: Record<string, string> = {
  button: "button",
  textarea: "textbox",
  table: "table",
  thead: "rowgroup",
  tbody: "rowgroup",
  tfoot: "rowgroup",
  tr: "row",
  td: "cell",
  caption: "caption",
  ul: "list",
  ol: "list",
  menu: "list",
  li: "listitem",
  datalist: "listbox",
  optgroup: "group",
  option: "option",
  fieldset: "group",
  details: "group",
  summary: "button",
  dialog: "dialog",
  output: "status",
  progress: "progressbar",
  meter: "meter",
  hr: "separator",
  p: "paragraph",
  article: "article",
  figure: "figure",
  blockquote: "blockquote",
  main: "main",
  nav: "navigation",
  header: "banner",
  footer: "contentinfo",
  aside: "complementary",
  search: "search"
};

/** The element's implicit ARIA role, or `undefined` when its markup implies none. */
export function implicitRole(element: Element): string | undefined {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") return inputRole(element);
  if (tag === "select") return selectRole(element);
  if (tag === "a" || tag === "area") return element.hasAttribute("href") ? "link" : undefined;
  if (tag === "img") return element.getAttribute("alt") === "" ? "presentation" : "img";
  if (tag === "th") return headerCellRole(element);
  if (/^h[1-6]$/u.test(tag)) return "heading";
  // A <section> or <form> is a landmark only once the page names it.
  if (tag === "section") return hasAuthoredName(element) ? "region" : undefined;
  if (tag === "form") return hasAuthoredName(element) ? "form" : undefined;
  return TAG_ROLES[tag];
}

function inputRole(element: Element): string | undefined {
  const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
  const role = INPUT_TYPE_ROLES[type];
  // `list` turns a text or search field into a combobox; password, file, colour
  // and the date family have no implicit role at all.
  if ((role === "textbox" || role === "searchbox") && element.hasAttribute("list")) return "combobox";
  return role;
}

function selectRole(element: Element): string {
  if (!(element instanceof HTMLSelectElement)) return "combobox";
  return element.multiple || element.size > 1 ? "listbox" : "combobox";
}

function headerCellRole(element: Element): string {
  return element.getAttribute("scope")?.trim().toLowerCase() === "row" ? "rowheader" : "columnheader";
}

function hasAuthoredName(element: Element): boolean {
  return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
}
