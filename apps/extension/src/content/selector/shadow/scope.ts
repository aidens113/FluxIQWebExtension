// Where a recorded target may be looked for: the document, or the shadow roots
// its recorded host chain (`host-chain.ts`) reaches.
//
// The chain is walked one host at a time, each host selector resolved in the
// roots the step before reached -- the document first. A host with no id or
// test id is named positionally (`body > div:nth-of-type(7)` for a chat
// vendor's anonymous container), so a page that gained or lost a sibling since
// the recording can move it. When a step's selector reaches no open shadow
// root, that step widens to every open shadow root in the roots it was asked
// in, and the element's own selector, the identity veto and the ambiguity rule
// decide among them. Widening never picks one: several roots stay several, and
// a target that then matches in more than one is reported ambiguous by the
// resolver rather than resolved by document order.
//
// A chain that reaches no root leaves the scope empty. Every strategy then
// misses and the resolver reports the target not found. A host selector the
// browser cannot parse is not read as "no such host": the recorder writes each
// one with `selectorFor`, so an unparsable one means the node was damaged, and
// the error propagates rather than turning into an empty scope. A target recorded in a
// shadow root is never looked for in the light document around it: a selector
// written inside a shadow tree says nothing about that document, and looking
// there is what matched seven unrelated elements on company-website.

/** A tree a lookup can run in. */
export type LookupRoot = Document | ShadowRoot;

/** Where to look for a recorded target. */
export type ShadowScope = {
  /** Whether the target was recorded inside a shadow root, so that only `roots` may hold it. */
  readonly scoped: boolean;
  /** The document when the target was recorded in it; otherwise every shadow root its chain reached, possibly none. */
  readonly roots: readonly LookupRoot[];
  /** How the scope reads in a failure message, or `undefined` for the document. */
  readonly description: string | undefined;
};

/** Elements a widened step looks at for open shadow hosts. The same bound the resolver's candidate scan uses. */
const MAX_HOST_SCAN = 5_000;

/** The roots a target recorded with `hosts` is looked for in; the document alone when it was recorded with none. */
export function resolveShadowScope(hosts: readonly string[] | undefined, root: Document = document): ShadowScope {
  if (!hosts?.length) return { scoped: false, roots: [root], description: undefined };
  let roots: LookupRoot[] = [root];
  for (const selector of hosts) {
    const named = roots.flatMap((current) => openShadowRoots([...current.querySelectorAll(selector)]));
    roots = named.length ? named : roots.flatMap((current) => openShadowRoots([...current.querySelectorAll("*")].slice(0, MAX_HOST_SCAN)));
    if (!roots.length) break;
  }
  return { scoped: true, roots: unique(roots), description: `the shadow root of ${hosts.join(" > shadow > ")}` };
}

function openShadowRoots(elements: readonly Element[]): ShadowRoot[] {
  return elements.flatMap((element) => element.shadowRoot ? [element.shadowRoot] : []);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
