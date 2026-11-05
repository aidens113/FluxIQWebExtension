// A control's slot in its row: the path from the row's root down to it, each step
// a tag and its index among same-tag siblings. The row's copies are found by
// following the same path in the rows beside it (`row-slot.ts`, `aim.ts`).

/** One step down from a row's root: a child of this tag, at this index among its same-tag siblings. */
export type SlotStep = { tag: string; index: number };

/** The path from `row` down to `element`, or `undefined` when `element` is not inside it. */
export function slotPath(row: Element, element: Element): SlotStep[] | undefined {
  const steps: SlotStep[] = [];
  for (let current = element; current !== row; ) {
    const parent = current.parentElement;
    if (!parent) return undefined;
    const tag = tagOf(current);
    steps.unshift({ tag, index: [...parent.children].filter((child) => tagOf(child) === tag).indexOf(current) });
    current = parent;
  }
  return steps;
}

/** The element at `slot` below `row`, or `undefined` where the row draws nothing there. */
export function followSlot(row: Element, slot: readonly SlotStep[]): Element | undefined {
  let current: Element | undefined = row;
  for (const step of slot) {
    current = current ? [...current.children].filter((child) => tagOf(child) === step.tag)[step.index] : undefined;
  }
  return current;
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}
