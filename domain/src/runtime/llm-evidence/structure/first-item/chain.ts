// A field selector as `item.querySelectorAll` would read it, over a capture's
// tree rather than a document.
//
// A detected field is read inside its item by one of three forms
// (`apps/extension/src/content/extraction/infer-fields.ts`): a path anchored at
// the item, `:scope > div.<body> > span.<price>`; one step anywhere in the item,
// `:scope span.<rating>`; or a test id, `[data-testid="name"]`. Those are what
// this reads: `:scope` then steps joined by `>` or a space, or a single
// compound. A chain of several compounds without `:scope` could match through
// ancestors outside the item, which a walk down from the item cannot see, so
// it is not read, nor is any compound `./compound.ts` does not read.

import { webLlmCompoundMatcher, type WebLlmCompoundSubject } from "./compound";
import type { WebLlmPageTree, WebLlmTreeNode } from "./tree";

type Step = { child: boolean; test: (subject: WebLlmCompoundSubject) => boolean };

/** Every element inside `root` the selector names, or `undefined` when the selector is not one this reads. */
export function webLlmSelectedWithin(tree: WebLlmPageTree, root: WebLlmTreeNode, selector: string): WebLlmTreeNode[] | undefined {
  const steps = chainSteps(selector);
  if (steps === undefined) return undefined;
  let current: WebLlmTreeNode[] = [root];
  for (const step of steps) {
    const next = new Map<string, WebLlmTreeNode>();
    for (const node of current) {
      for (const candidate of step.child ? tree.children(node) : descendants(tree, node)) {
        if (step.test(candidate)) next.set(candidate.element.target, candidate);
      }
    }
    current = [...next.values()];
  }
  return current;
}

/** The steps of a chain this reads, or `undefined`. */
function chainSteps(selector: string): Step[] | undefined {
  const tokens = chainTokens(selector);
  if (tokens === undefined || tokens.length === 0) return undefined;
  const scoped = tokens[0] === ":scope";
  const rest = scoped ? tokens.slice(1) : tokens;
  const steps: Step[] = [];
  let child = false;
  for (const token of rest) {
    if (token === ">") {
      if (child) return undefined;
      child = true;
      continue;
    }
    const test = webLlmCompoundMatcher(token);
    if (test === undefined) return undefined;
    steps.push({ child, test });
    child = false;
  }
  if (child || steps.length === 0) return undefined;
  // Unanchored, only a single compound reads the same from the item down.
  if (!scoped && (steps.length > 1 || steps[0]?.child === true)) return undefined;
  return steps;
}

/**
 * The selector split at its combinators: each compound, and `>` on its own.
 * Whitespace and `>` inside brackets, parentheses or quotes are the
 * compound's. `undefined` for a selector whose brackets or quotes do not close.
 */
function chainTokens(selector: string): string[] | undefined {
  const tokens: string[] = [];
  let token = "";
  let depth = 0;
  let quote: string | undefined;
  const flush = (): void => {
    if (token !== "") tokens.push(token);
    token = "";
  };
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index] as string;
    if (quote !== undefined) {
      token += char;
      if (char === "\\" && index + 1 < selector.length) {
        index += 1;
        token += selector[index] as string;
      } else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    if (depth < 0) return undefined;
    if (depth === 0 && /\s/u.test(char)) {
      flush();
      continue;
    }
    if (depth === 0 && char === ">") {
      flush();
      tokens.push(">");
      continue;
    }
    token += char;
  }
  if (quote !== undefined || depth !== 0) return undefined;
  flush();
  return tokens;
}

/** Every element below the node, in document order. */
function descendants(tree: WebLlmPageTree, node: WebLlmTreeNode): WebLlmTreeNode[] {
  const found: WebLlmTreeNode[] = [];
  const walk = (parent: WebLlmTreeNode): void => {
    for (const child of tree.children(parent)) {
      found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}
