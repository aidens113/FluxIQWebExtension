// The markers on the extension's own on-page UI -- the picker's overlay and the
// activity overlay -- and the one test for "this node is the extension's own
// UI, not the page's".
//
// It sits here, beside `recorder.ts`, rather than inside `picker/` or
// `activity-overlay/`, because those and the recorder all need it and only one
// direction of import is safe. `picker/` imports the recorder to emit the
// extraction it records; were the recorder to import `picker/` back -- and the
// structure audit requires that import to go through the directory's barrel,
// which pulls in the whole picker -- the two would form a cycle. A leaf module
// every side can reach costs one file and removes the question. The file keeps
// its original name because authored documentation links to it.
//
// The rule it encodes: a mutation the extension's own UI made is not a change
// the page made, so it is not recorded; and the extension's UI is not part of
// the page a snapshot describes or an action has to get past. Without it,
// putting the highlight up adds a node to `document.body` while recording is
// on, and the recording gains a `dom.mutation` that no page behaviour produced
// -- which a replay would then wait for.

/** The attribute that marks the picker's shadow-root host. Nothing else in the page carries it. */
export const PICKER_HOST_ATTRIBUTE = "data-fluxiq-picker";

/** The attribute that marks the activity overlay's shadow-root host. Nothing else in the page carries it. */
export const ACTIVITY_OVERLAY_HOST_ATTRIBUTE = "data-fluxiq-activity";

/**
 * Whether `node` is one of the extension's overlay hosts or sits inside one.
 *
 * Asked of a `MutationRecord`'s target and of each node it added or removed, so
 * the host arriving and leaving is skipped as well as anything the overlay does
 * inside itself; and of snapshot candidates and hit-test answers, so an overlay
 * is never described as page content or as a layer over the page. The walk is
 * by `parentNode` and asks each ancestor by duck type rather than
 * `instanceof Element`: the recorder is unit-tested against a stub page in
 * Node, where no `Element` global exists.
 */
export function isExtensionUiNode(node: Node | null | undefined): boolean {
  for (let current: Node | null | undefined = node; current; current = current.parentNode) {
    const element = current as Element;
    if (typeof element.hasAttribute !== "function") continue;
    if (element.hasAttribute(PICKER_HOST_ATTRIBUTE) || element.hasAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE)) return true;
  }
  return false;
}
