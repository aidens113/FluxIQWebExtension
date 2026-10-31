import type { WebLlmEvidenceElement } from "../elements";

/** Bounded same-frame ancestry; malformed/cyclic/truncated chains provide no context. */
export function controlAncestry(element: WebLlmEvidenceElement, byHandle: ReadonlyMap<string, WebLlmEvidenceElement>): readonly WebLlmEvidenceElement[] | undefined {
  const chain: WebLlmEvidenceElement[] = [];
  const seen = new Set<string>();
  let at: WebLlmEvidenceElement | undefined = element;
  for (let depth = 0; at && depth < 40; depth += 1) {
    if (seen.has(at.target) || at.frameId !== element.frameId) return undefined;
    seen.add(at.target);
    chain.push(at);
    if (at.parent === undefined) return chain;
    at = byHandle.get(at.parent);
    if (!at) return undefined;
  }
  return undefined;
}

