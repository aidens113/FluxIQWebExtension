// The state a line states after its words (t223, "State tokens"), each only
// when it applies, in this order:
//
//   placeholder "…" · ="value" (or ="" for an empty field) · for a select
//   ="label" [a|b|c] · checked/unchecked · open/closed · selected · pressed ·
//   current · marked · disabled · @column (or @c<n>) · the link target ·
//   covered-by tA,tB · focused · on a layer: modal, its kind, covers <n>
//
// t229 added what a person sees of a control's state beyond checked and open:
// `selected` (`aria-selected`), `pressed` (`aria-pressed`), `current`
// (`aria-current`, the page a menu says you are on), `marked` (drawn apart
// from the like options beside it, as a shop draws the chosen size), and
// `disabled` for a control whose own cursor refuses a press. A field's
// placeholder is printed apart from its name, and not when it is the name.
//
// The link target is written by the caller (`../link-writer.ts`,
// `../link-repeats.ts`), because how it is written depends on the lines
// before it. A column header with a space in it is quoted, so where it ends is
// not a guess.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "./attribute-value";
import { quotedWords } from "./quoted";

/** The element's state tokens for a line of the given kind, with the link target already written. */
export function webLlmStateTokens(element: WebLlmEvidenceElement, kind: string | undefined, linkTarget: string | undefined, words?: string): string[] {
  const tokens: string[] = [];
  const field = kind?.startsWith("field") === true;
  const placeholder = field ? attributeValue(element, "placeholder")?.trim() : undefined;
  if (placeholder !== undefined && placeholder !== "" && placeholder !== words) tokens.push(`placeholder ${quotedWords(placeholder)}`);
  if (field) {
    if (element.value !== undefined) tokens.push(`=${quotedWords(element.value)}`);
    else if (element.hasValue === false) tokens.push("=\"\"");
  }
  if (kind === "select") tokens.push(...selectTokens(element));
  const checked = element.checked ?? ariaState(attributeValue(element, "aria-checked"));
  if (checked !== undefined) tokens.push(checked ? "checked" : "unchecked");
  if (element.expanded !== undefined) tokens.push(element.expanded ? "open" : "closed");
  if (ariaState(attributeValue(element, "aria-selected")) === true) tokens.push("selected");
  if (ariaState(attributeValue(element, "aria-pressed")) === true) tokens.push("pressed");
  const current = attributeValue(element, "aria-current")?.trim().toLowerCase();
  if (current !== undefined && current !== "" && current !== "false") tokens.push("current");
  if (element.marked === true && kind !== undefined) tokens.push("marked");
  const refused = element.cursor === "not-allowed";
  if (refused || attributeValue(element, "disabled") !== undefined || attributeValue(element, "aria-disabled")?.trim().toLowerCase() === "true") tokens.push("disabled");
  if (element.cell !== undefined) tokens.push(columnToken(element.cell));
  if (linkTarget !== undefined) tokens.push(linkTarget);
  if (element.coveredBy !== undefined && element.coveredBy.length > 0) tokens.push(`covered-by ${element.coveredBy.join(",")}`);
  if (element.focused === true) tokens.push("focused");
  if (element.isDialog?.modal === true) tokens.push("modal");
  const layerKind = element.isDialog?.kind ?? element.kind;
  if (layerKind !== undefined) tokens.push(layerKind);
  const covers = element.coversCount ?? element.covers?.length;
  if (covers !== undefined && covers > 0) tokens.push(`covers ${covers}`);
  return tokens;
}

function selectTokens(element: WebLlmEvidenceElement): string[] {
  const options = element.options ?? [];
  const selected = element.selectedValue === undefined ? undefined : options.find((option) => option.value === element.selectedValue);
  const tokens: string[] = [];
  if (selected !== undefined) tokens.push(`=${quotedWords(selected.label)}`);
  if (options.length > 0) tokens.push(`[${options.map((option) => option.label).join("|")}]`);
  return tokens;
}

function ariaState(value: string | undefined): boolean | undefined {
  const state = value?.trim().toLowerCase();
  return state === "true" ? true : state === "false" ? false : undefined;
}

function columnToken(cell: NonNullable<WebLlmEvidenceElement["cell"]>): string {
  if (cell.header === undefined) return `@c${cell.column}`;
  return /\s/u.test(cell.header) ? `@${quotedWords(cell.header)}` : `@${cell.header}`;
}
