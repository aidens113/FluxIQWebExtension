// The same row-owned HTML definition association as the live field reader,
// over a capture's tree. A term is structure; its sibling position and its
// definition's contents never identify it.

import type { WebAutomationExtractionProposalFieldSpec } from "../../../../extraction";
import { isSensitiveElementDescriptor } from "../../../../sensitivity";
import { isWithheldText, screenedPageText } from "../../withheld";
import { webLlmSelectedWithin } from "./chain";
import type { WebLlmPageTree, WebLlmTreeNode } from "./tree";

type Pair = { terms: WebLlmTreeNode[]; values: WebLlmTreeNode[] };
const NON_RECORD_TAGS = new Set(["input", "textarea", "select", "option", "button", "script", "style", "template", "noscript"]);
const CONTROL_ROLES = new Set(["button", "textbox", "combobox", "checkbox", "radio", "switch", "listbox", "slider", "spinbutton"]);

/** The uniquely associated term or value, never a different pair or the item. */
export function webLlmDefinitionElements(tree: WebLlmPageTree, item: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): readonly WebLlmTreeNode[] | undefined {
  const definition = spec.kind === "text" ? spec.definition : undefined;
  if (definition === undefined || spec.lines === true) return [];
  const wanted = words(definition.term);
  if (wanted === undefined || wanted === "") return [];
  const scopes = spec.selector === undefined || spec.selector === ":scope" ? [item] : webLlmSelectedWithin(tree, item, spec.selector);
  if (scopes === undefined) return undefined;
  const readable = readableNodes(tree, item);
  const lists = new Set<WebLlmTreeNode>();
  for (const scope of scopes) if (readable.has(scope)) collectLists(tree, scope, lists);
  const matches = [...lists].flatMap((list) => pairsIn(tree, list).flatMap((pair) => pair.terms
    .filter((term) => readable.has(term) && cleanContents(tree, term) && words(term.element.text ?? term.element.name ?? term.element.ownText) === wanted)
    .map((term) => ({ term, pair }))));
  if (matches.length !== 1) return [];
  const { term, pair } = matches[0]!;
  const value = pair.values.length === 1 ? pair.values[0] : undefined;
  if (value === undefined || !readable.has(value) || !cleanContents(tree, value)) return [];
  return [definition.part === "term" ? term : value];
}

/** The rendered, non-sensitive part of the item's tree, including ancestors. */
function readableNodes(tree: WebLlmPageTree, item: WebLlmTreeNode): Set<WebLlmTreeNode> {
  const readable = new Set<WebLlmTreeNode>();
  const visit = (node: WebLlmTreeNode): void => {
    if (blocked(node)) return;
    readable.add(node);
    for (const child of tree.children(node)) visit(child);
  };
  visit(item);
  return readable;
}

/** Top-level lists in this explicit scope; a nested list belongs to itself. */
function collectLists(tree: WebLlmPageTree, scope: WebLlmTreeNode, lists: Set<WebLlmTreeNode>): void {
  if (blocked(scope)) return;
  if (scope.tag === "dl") {
    lists.add(scope);
    return;
  }
  for (const child of tree.children(scope)) collectLists(tree, child, lists);
}

/** Direct terms/definitions and HTML's direct div-grouped entries. */
function pairsIn(tree: WebLlmPageTree, list: WebLlmTreeNode): Pair[] {
  const pairs: Pair[] = [];
  let direct: WebLlmTreeNode[] = [];
  for (const child of tree.children(list)) {
    if (child.tag === "dt" || child.tag === "dd") direct.push(child);
    else {
      pairs.push(...grouped(direct));
      direct = [];
      if (child.tag === "div" && !blocked(child)) pairs.push(...grouped(tree.children(child)));
    }
  }
  return [...pairs, ...grouped(direct)];
}

/** Consecutive terms share the following definitions; other markup ends a group. */
function grouped(nodes: readonly WebLlmTreeNode[]): Pair[] {
  const pairs: Pair[] = [];
  let pair: Pair = { terms: [], values: [] };
  const finish = (): void => {
    if (pair.terms.length > 0) pairs.push(pair);
    pair = { terms: [], values: [] };
  };
  for (const node of nodes) {
    if (node.tag === "dt") {
      if (pair.values.length > 0) finish();
      pair.terms.push(node);
    } else if (node.tag === "dd") pair.values.push(node);
    else finish();
  }
  finish();
  return pairs;
}

/** A partial, hidden, sensitive or nested-list rendering is not exact evidence. */
function cleanContents(tree: WebLlmPageTree, node: WebLlmTreeNode): boolean {
  if (blocked(node) || isWithheldText(node.element.text) || isWithheldText(node.element.name) || isWithheldText(node.element.ownText)) return false;
  return tree.children(node).every((child) => child.tag !== "dl" && cleanContents(tree, child));
}

function blocked(node: WebLlmTreeNode): boolean {
  const editable = node.attributes.contenteditable?.toLowerCase();
  return NON_RECORD_TAGS.has(node.tag)
    || (node.element.role ?? node.attributes.role ?? "").toLowerCase().split(/\s+/u).some((role) => CONTROL_ROLES.has(role))
    || editable === "" || editable === "true" || editable === "plaintext-only"
    || node.element.hidden === true || Object.hasOwn(node.attributes, "hidden") || Object.hasOwn(node.attributes, "inert")
    || node.attributes["aria-hidden"]?.toLowerCase() === "true"
    || isSensitiveElementDescriptor({ tagName: node.tag, attributes: node.attributes, inputType: node.element.inputType, accessibleName: node.element.name, label: node.element.label });
}

function words(value: unknown): string | undefined {
  const text = screenedPageText(value);
  return text === undefined || isWithheldText(text) ? undefined : text.replace(/\s+/gu, " ").trim();
}
