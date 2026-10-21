/** `Node.TEXT_NODE`, written out so the walk does not depend on the `Node` global. */
const TEXT_NODE = 3;

/**
 * What decides which field sources an item offers, as one string: each
 * element's tag, attribute names, classes, role, `aria-hidden`, whether it
 * holds words of its own, whether it has a shadow root and how many children
 * it has, in document order. No value is kept, only whether an element has
 * words.
 */
export function itemShape(item: Element): string {
  const parts: string[] = [];
  for (const element of [item, ...item.querySelectorAll("*")]) {
    const names = Array.from(element.attributes, (attribute) => attribute.name).sort().join(",");
    const words = Array.from(element.childNodes).some((node) => node.nodeType === TEXT_NODE && (node.textContent ?? "").trim() !== "");
    const own = [element.getAttribute("class"), element.getAttribute("role"), element.getAttribute("aria-hidden")].map((value) => value ?? "").join("|");
    parts.push(`${element.tagName}|${names}|${own}|${words ? 1 : 0}|${element.shadowRoot === null ? 0 : 1}|${element.childElementCount}`);
  }
  return parts.join("\n");
}
