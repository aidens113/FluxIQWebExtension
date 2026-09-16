// Whether a message came from the extension's own UI.
//
// This is a security boundary, not a convenience. Every privileged background
// message is gated on it: arming and awaiting a scripted navigation, and the
// whole extraction picker including `fluxiq.test.defineExtraction`, which runs
// a read of the page and answers with the records. A page under test that
// passed this check could drive FluxIQ's own reader and read the page back out
// of it.
//
// It lives in one file because it was briefly written twice, once in
// `scripted-navigation-control.ts` and once in `extraction/control.ts`. Two
// copies of a check like this is how a hole appears later: someone tightens one
// of them and nothing fails.
//
// Three things are asked, and all three matter:
//
// - `sender.id` is this extension. Another extension may send to this one, and
//   its messages arrive here the same way the panel's do.
// - `sender.url` is a string. A sender with no URL at all is not the panel, and
//   `undefined === undefined` would otherwise pass an absent URL as a match.
// - the URL is **exactly** one of the two control pages, compared against
//   `chrome.runtime.getURL`. Not a prefix and not an origin: every page this
//   extension serves shares the origin, so an origin test would accept any of
//   them, and a prefix test would accept `popup/index.html.evil`.

/** The two pages that may drive the background worker: the Chrome side panel and the Firefox popup. */
const CONTROL_PAGES = ["sidepanel/index.html", "popup/index.html"];

export function isControlPage(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  return CONTROL_PAGES.some((page) => sender.url === chrome.runtime.getURL(page));
}
