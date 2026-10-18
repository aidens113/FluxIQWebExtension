// What kind of element a column reads, as page structure: its tag, its role,
// its classes, which of the attributes that state a value of their own it
// carries, and where its link points. Never its words.

/** One element's kind. Two elements are the same kind when `sameKind` says so. */
export type ElementKind = {
  tag: string;
  role: string | undefined;
  /** Its classes, as written. */
  classes: readonly string[];
  /** Which of `KIND_ATTRIBUTES` it carries with something in them, in that order. */
  stated: readonly string[];
  /** The folder its `href` points into, as written (`hrefFolder`); `undefined` without an `href`. */
  href: string | undefined;
};

/**
 * The attributes whose presence makes an element a different kind: a link
 * that states a date for assistive technology is a timestamp, one beside it
 * that does not is a name. `title` is left out because pages add it to the
 * same element only when its words are cut short.
 */
const KIND_ATTRIBUTES: readonly string[] = ["aria-label", "datetime"];

/** The element's kind, read off its own markup. */
export function elementKind(element: Element): ElementKind {
  return {
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute("role") ?? undefined,
    classes: [...element.classList],
    stated: KIND_ATTRIBUTES.filter((name) => (element.getAttribute(name) ?? "").trim() !== ""),
    href: hrefFolder(element.getAttribute("href"))
  };
}

/**
 * The folder a link points into, as written: its path without query or
 * fragment, cut after the last `/` before its final segment, so every post's
 * link (`/posts/12/`, `/posts/40/`) has one folder and a person's link
 * (`/people/ana/`) another. `""` for a link with no folder, `undefined` for
 * no link.
 */
function hrefFolder(href: string | null): string | undefined {
  if (href === null) return undefined;
  const path = href.replace(/[?#].*$/su, "").replace(/\/+$/u, "");
  const cut = path.lastIndexOf("/");
  return cut < 0 ? "" : path.slice(0, cut + 1);
}
