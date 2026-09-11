// Brings an action's target to the centre of the viewport before it is used.

export function scrollElementIntoView(element: Element): void {
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
}
