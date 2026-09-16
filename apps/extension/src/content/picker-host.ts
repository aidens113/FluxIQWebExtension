// The marker on the picker's overlay host, and the one test for "this node is
// the extension's own UI, not the page's".
//
// It sits here, beside `recorder.ts`, rather than inside `picker/`, because
// both sides need it and only one direction of import is safe. `picker/`
// imports the recorder to emit the extraction it records; were the recorder to
// import `picker/` back -- and the structure audit requires that import to go
// through the directory's barrel, which pulls in the whole picker -- the two
// would form a cycle. A leaf module both can reach costs one file and removes
// the question.
//
// The rule it encodes: a mutation the picker's own overlay made is not a change
// the page made, so it is not recorded. Without it, putting the highlight up
// adds a node to `document.body` while recording is on, and the recording gains
// a `dom.mutation` that no page behaviour produced -- which a replay would then
// wait for.

/** The attribute that marks the picker's shadow-root host. Nothing else in the page carries it. */
export const PICKER_HOST_ATTRIBUTE = "data-fluxiq-picker";

/**
 * Whether `node` is the picker's overlay host or sits inside it.
 *
 * Asked of a `MutationRecord`'s target and of each node it added or removed, so
 * the host arriving and leaving is skipped as well as anything the overlay does
 * inside itself. The walk is by `parentNode` and asks each ancestor by duck
 * type rather than `instanceof Element`: the recorder is unit-tested against a
 * stub page in Node, where no `Element` global exists.
 */
export function isPickerHostNode(node: Node | null | undefined): boolean {
  for (let current: Node | null | undefined = node; current; current = current.parentNode) {
    const element = current as Element;
    if (typeof element.hasAttribute === "function" && element.hasAttribute(PICKER_HOST_ATTRIBUTE)) return true;
  }
  return false;
}
