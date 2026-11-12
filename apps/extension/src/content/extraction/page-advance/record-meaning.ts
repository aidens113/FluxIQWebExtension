// What one item of a list says, as a move of the list compares it: its words,
// the addresses it links to and the images it shows.
//
// **A list redrawn with the same records has not moved (t885, R5).** A move
// was told by the elements: the first item detached, or a different element
// first. A widget that redraws its whole calendar on every press detaches every
// item and draws the same week again, so a Next that only raised a form error
// answered "moved" in 5 ms (`run-mwc6ut8u-52e3c1b3`, steps 109 and 150). So a
// move, and an item the move brought, are told by what the items say, never by
// which elements hold it.
//
// Record meaning only, not animation, style or pager mutations. Kept on the
// page; neither words, link addresses nor image addresses are added to wire
// evidence or logs.

/** The item's words, link addresses and image addresses, as one comparable string. */
export function recordMeaning(record: Element): string {
  const text = (record.textContent ?? "").replace(/\s+/gu, " ").trim();
  const links = Array.from(record.querySelectorAll?.("a[href]") ?? []).map((link) => link.getAttribute("href"));
  // An item that is a photo and nothing else says what it is by its image.
  const images = Array.from(record.querySelectorAll?.("img[src]") ?? []).map((image) => image.getAttribute("src"));
  return JSON.stringify(images.length === 0 ? [text, links] : [text, links, images]);
}
