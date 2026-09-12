// Which pages the extension refuses to automate.
//
// A privileged page cannot host the content script, so an action sent to one
// waits for a reply that never comes; the guard turns that into an immediate,
// honest failure instead. `background/connection/browser-state.ts` answers the
// same question for *recording*, and its pattern requires "://" -- so
// `about:blank`, `view-source:` and `data:` URLs slip past it, and the current
// Chrome and Edge store hosts are not matched at all (found by
// w1-extension-unit-tests). This is the automation-side rule: it matches a
// scheme with or without an authority, so those cases are covered here.

/**
 * Schemes the browser itself owns. Matched without requiring "//" so
 * `about:blank`, `view-source:https://example.test`, and `data:text/html,...`
 * are caught, which is the whole point of a separate rule.
 */
const PRIVILEGED_SCHEME =
  /^(?:chrome|edge|brave|opera|vivaldi|about|devtools|view-source|data|javascript|moz-extension|chrome-extension|edge-extension):/iu;

/** Extension gallery hosts, which refuse injected scripts however they are reached. */
const EXTENSION_STORE =
  /^https:\/\/(?:chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons|addons\.mozilla\.org)/iu;

export const UNSUPPORTED_BROWSER_PAGE_REASON = "Browser and extension pages cannot be automated.";
export const UNSUPPORTED_STORE_PAGE_REASON = "Browser web store pages cannot be automated.";

/**
 * Why this URL cannot be automated, or undefined when it can be. An unknown URL
 * returns undefined: the guard refuses what it can prove, and a tab whose URL
 * the worker cannot read is judged by the action's own outcome instead.
 */
export function unsupportedAutomationPageReason(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (PRIVILEGED_SCHEME.test(trimmed)) return UNSUPPORTED_BROWSER_PAGE_REASON;
  if (EXTENSION_STORE.test(trimmed)) return UNSUPPORTED_STORE_PAGE_REASON;
  return undefined;
}
