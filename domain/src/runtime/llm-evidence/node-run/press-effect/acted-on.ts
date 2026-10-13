// Which item of a repeating list a press, a type or a choice acted on, in one
// sentence on its answer (t504).
//
// Lane D round 17 (`run-mv6lgt3s-c3aa6fac`): the model meant "the rows that
// qualify", pressed the first row's control -- a row that did not qualify --
// and the answer listed only the lines that changed. Nothing refuses such a
// press; a person may act on any row. The answer now says, ahead of what
// changed, which item the act was on: its place as the page view marks it
// (`- 1/3`) and that item's words, read from the look before acting
// (`../../structure/item-row.ts`), so the model can hold it against the rows it
// meant at once.

import { quotedWords, webLlmElementWords } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webLlmItemRow } from "../../structure/item-row";
import type { WebRunnableNode } from "../catalog";

/**
 * The sentence for an act on an element inside an item of a list of several
 * (or a table row), or `undefined`: a node that only looks, no page before it,
 * no handle, or an element in no such item.
 */
export function webNodeActedOn(node: WebRunnableNode, before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string | undefined {
  if (node.effect !== "mutate" || before === undefined || handle === undefined) return undefined;
  const item = webLlmItemRow(before.evidence, handle);
  if (item === undefined) return undefined;
  const element = before.evidence.elements.find((candidate) => candidate.target === handle);
  const words = element === undefined ? undefined : webLlmElementWords(element);
  const through = words === undefined ? "" : `, through its ${quotedWords(words)}`;
  return `This acted on ${item} only${through}; no other item was acted on.`;
}
