// Brings an action's target to the centre of the viewport before it is used.
//
// Centring, rather than scrolling the shortest distance that brings the element
// into view, is what makes the hit test that follows trustworthy: sticky
// headers and footers overlap the edges of the viewport, so an element scrolled
// just barely into view is exactly the one found covered. The centre is the
// position least likely to sit under a page's own furniture.
//
// `behavior: "instant"` matters as much. A smooth scroll returns before the
// scrolling has finished, so a hit test taken straight afterwards would be
// measured against geometry the page had on the way there, not where it landed.

export function scrollElementIntoView(element: Element): void {
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
}
