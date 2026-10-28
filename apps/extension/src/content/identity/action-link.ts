// A link that acts on the page rather than names a thing (t778).
//
// A row's or a part's title is its first heading, else its first link's words
// (`record.ts`), because on a result, a card or a basket line the first link is
// the item's own name. Some links are not names at all: a "Share" or "Save"
// written as `<a href="#">`, a link that says it is a button, one that runs a
// script, one that downloads a file. They do something to the page or the
// item, so their words say what they do -- the same on every row -- and never
// which item a control beside them is about.
//
// Read from the markup alone, never from the words, so it holds on any site in
// any language: an address that leads nowhere but this page (`#…`, empty) or
// to a script, a `download`, or a role other than a link's.

/** Whether `link` acts on the page rather than leads to a page that its words name. */
export function isActionLink(link: Element): boolean {
  const role = link.getAttribute("role")?.trim().toLowerCase();
  if (role !== undefined && role !== "" && role !== "link") return true;
  if (link.hasAttribute("download")) return true;
  const href = (link.getAttribute("href") ?? "").trim();
  return href === "" || href.startsWith("#") || /^javascript:/iu.test(href);
}
