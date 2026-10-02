// The contract between the page world, which sees the press listeners a page
// adds, and the content script, which cannot (t229).
//
// A listener added with `addEventListener`, or a function assigned to
// `onclick`, lives in the page's JavaScript world. An isolated content script
// sees neither: `element.onclick` reads its own world's property, and there is
// no API that lists an element's listeners. So `hasClickHandler` was true only
// for an `onclick` attribute, and a page that binds its controls in script --
// professional-network's "Not now", drawn as a `<div>` with no role and no
// pointer -- had them read as plain text.
//
// The page world (`page-world/press-listeners.ts`) remembers each element a
// press listener is added to. The content script asks about one element by
// dispatching this event on it, cancelable and composed; the page world's
// window listener cancels it when the element is one it remembered, and the
// content script reads the answer from `dispatchEvent`'s return, on the same
// call stack. Nothing is written to the page. This module imports nothing:
// both bundles include it.

/** Dispatched on an element by the content script; cancelled by the page world when the page listens for presses on it. */
export const PRESS_PROBE_EVENT = "fluxiq:press-probe";
