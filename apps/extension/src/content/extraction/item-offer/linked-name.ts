// The linked name an offer control sits beside (t810): the group, page or person
// the offer is to join, where the item makes that clear and otherwise nothing.
//
// From the control outward, the first ancestor (the item at the latest) that
// holds linked names decides. Its headings' links are the names where it has
// any (a feed post's title), else all its links with words of their own (a
// person card's name); an icon or an address with no words is no name. Exactly
// one distinct name is clear; two or more are not, and a guess would put a
// wrong group into a verdict, so nothing is said.

import { controlName } from "./control-name";

/** The name in words of the one entity the control offers to join, or `undefined` where that is not clear. */
export function linkedNameBeside(control: Element, item: Element): string | undefined {
  for (let level: Element | null = control.parentElement; level !== null; level = level === item ? null : level.parentElement) {
    if (!item.contains(level)) return undefined;
    const names = namesIn(level, control);
    if (names.size === 1) return [...names][0];
    if (names.size > 1) return undefined;
  }
  return undefined;
}

function namesIn(level: Element, control: Element): Set<string> {
  const links = [...level.querySelectorAll("a[href]")].filter((link) => !control.contains(link) && !link.contains(control));
  const headed = links.filter((link) => {
    const heading = link.closest("h1, h2, h3, h4, h5, h6");
    return heading !== null && level.contains(heading);
  });
  return new Set((headed.length > 0 ? headed : links).map(linkWords).filter((words) => words !== ""));
}

/** A link's words: its text, else nothing -- an avatar's label is not the name shown. */
function linkWords(link: Element): string {
  if (link.getAttribute("aria-hidden") === "true") return "";
  return (link.textContent ?? "").replace(/\s+/gu, " ").trim() || (link.querySelector("img[alt]") ? "" : controlName(link));
}
