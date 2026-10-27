// A run's items and the items nested inside them that the page draws from the
// same template: a comment thread's replies under their comment.
//
// A run is the items one container holds side by side (`../infer-list.ts`), so
// a reply, drawn as a comment is drawn but inside its comment's own list, was
// in no run with the comments, and a read of "every comment and reply" read
// the comments alone however many replies were open. Photo-social's giveaway
// thread is the case (t755, `run-mvebbeom-a60886e1`): two of the five comments
// tagging @priya.nair are replies, and a read of the thread detected with its
// replies open still kept three.
//
// So each item is followed by the same-template items inside it, in document
// order, which is the order the page shows a thread in: a comment, its
// replies, the next comment. Same template is strict: the nested element
// carries the item's own signature (tag, role, test id, classes) and starts
// with a child of the same signature as the item's own first child. A plain
// `<li>` holding a bullet list of plain `<li>`s is not a thread: its bullets
// start with no element, or with a different one, where the item starts with
// its card.

/** `run`, each item followed by the items nested in it that `sameTemplate` accepts, in document order. */
export function withNestedItems(run: readonly Element[], sameTemplate: (element: Element) => boolean, signatureOf: (element: Element) => string): Element[] {
  const items: Element[] = [];
  for (const item of run) {
    items.push(item);
    const opening = item.firstElementChild;
    if (!opening) continue;
    const opens = signatureOf(opening);
    for (const nested of Array.from(item.querySelectorAll(item.tagName))) {
      const start = nested.firstElementChild;
      if (start && sameTemplate(nested) && signatureOf(start) === opens) items.push(nested);
    }
  }
  return items;
}
