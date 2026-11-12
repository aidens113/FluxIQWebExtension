// What a model reads about the hover node, `web.dom.hover` (t903, F5).
//
// Some menus open only while a pointer rests on their control: the account
// menu of a shop's header, drawn by a stylesheet's `:hover` rule. A press is the
// wrong act for them (a click on the account control may follow its link), and
// until t903 there was no other: on `run-mwbkuxqt-c57f42cb` six presses of the
// account control left its menu closed. A person points at it and reads the
// menu, and so does this node. The words are generic: what a hover is for, and
// how the element is named.

/** Words of a request to point at something. A tag of two words is ranked as both. */
export const WEB_AUTOMATION_HOVER_TAGS: readonly string[] = ["hover", "point", "mouse over", "menu", "reveal"];

/** The node's description: what a hover does, and how its element is named. */
export const WEB_AUTOMATION_HOVER_DESCRIPTION = [
  "Point at an element without pressing it, as a resting mouse does.",
  "It opens what shows on hover: a menu, a panel or a tip, which then reads like the page.",
  "Name the element by its handle in target."
].join(" ");
