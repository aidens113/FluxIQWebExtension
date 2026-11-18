// This content script's own decision about its document, wired to the browser:
// the document's origins and the background's answer. Built on first use, never
// while the module loads, so a test can load what imports it without `chrome`.

import { OWN_PAGE_ADDRESSES_MESSAGE } from "../../shared/own-pages";
import { createOwnDocumentCheck, type OwnDocumentCheck, type OwnDocumentVerdict } from "./check";

let check: OwnDocumentCheck | undefined;

function documentCheck(): OwnDocumentCheck {
  check ??= createOwnDocumentCheck({
    // `self.origin` is the document's effective origin: an `about:blank` or `srcdoc` frame inherits its creator's.
    origins: () => [location.origin, (globalThis as { origin?: string }).origin],
    ask: () => chrome.runtime.sendMessage({ type: OWN_PAGE_ADDRESSES_MESSAGE })
  });
  return check;
}

/** The document this content script runs in, as one of FluxIQ's own pages or not. */
export const ownDocument = {
  verdict: (): Promise<OwnDocumentVerdict> => documentCheck().verdict(),
  last: (): OwnDocumentVerdict | undefined => check?.last()
};
