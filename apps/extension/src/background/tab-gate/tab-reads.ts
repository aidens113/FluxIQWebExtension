// The read half of the browser's tab API: look a tab up, list tabs, hear that
// one changed. Reads reach no page, so they are not refused; what a reader may
// pass on is (`withoutOwnPages`). Everything that reaches a page -- a message,
// a script, a capture, an act -- has its own gated call in this directory, and
// the structure audit keeps `chrome.tabs` and `chrome.scripting` out of every
// other file of the extension, so this narrow view is the only one outside it.

/** The parts of `chrome.tabs` that read, and nothing that sends, injects, captures or acts. */
export type TabReads = Pick<typeof chrome.tabs, "get" | "query" | "onActivated" | "onUpdated" | "onRemoved" | "onReplaced" | "onCreated">;

/** The browser's tab reads, read when called, as `chrome.tabs` itself is. */
export function tabReads(): TabReads {
  return chrome.tabs;
}
