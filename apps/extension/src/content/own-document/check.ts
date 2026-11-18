// Whether the document this content script runs in is one of FluxIQ's own
// pages, decided by the document itself. The background's tab gate decides on a
// tab's address before it sends; this is the second decision, made where the
// command lands, and it is what covers a tab that moved to a FluxIQ page after
// that check and a FluxIQ page framed inside an ordinary tab.
//
// The document's origin is its own (`location.origin`, and `self.origin` for a
// document that inherits one, as `about:blank` and `srcdoc` frames do); nothing
// a command carries is trusted for it. Where FluxIQ's pages are is asked of the
// background, which answers from its settings (`shared/own-pages/`): the
// settings live in storage closed to content scripts. The question is asked
// again for every decision, so a settings change applies to the next command;
// questions asked at once share one answer.

import { isOwnPageAddress } from "../../shared/own-pages";

/** What the document is: FluxIQ's own page, an ordinary one, or not known because the background did not say. */
export type OwnDocumentVerdict = "own" | "ordinary" | "unconfirmed";

export type OwnDocumentCheckDeps = {
  /** The document's own origins: `location.origin` and `self.origin`. */
  readonly origins: () => ReadonlyArray<string | undefined>;
  /** Asks the background where FluxIQ's own pages are; resolves its reply. */
  readonly ask: () => Promise<unknown>;
};

export type OwnDocumentCheck = {
  /** Decides now, asking the background where FluxIQ's pages are. */
  verdict(): Promise<OwnDocumentVerdict>;
  /** The last decision made, if any. */
  last(): OwnDocumentVerdict | undefined;
};

export function createOwnDocumentCheck(deps: OwnDocumentCheckDeps): OwnDocumentCheck {
  let pending: Promise<OwnDocumentVerdict> | undefined;
  let last: OwnDocumentVerdict | undefined;
  const decide = async (): Promise<OwnDocumentVerdict> => {
    let addresses: readonly string[] | undefined;
    try {
      addresses = addressesFrom(await deps.ask());
    } catch {
      addresses = undefined;
    }
    if (addresses === undefined) return "unconfirmed";
    return deps.origins().some((origin) => origin !== undefined && isOwnPageAddress(origin, addresses)) ? "own" : "ordinary";
  };
  return {
    verdict: () => {
      pending ??= decide().then((verdict) => {
        last = verdict;
        pending = undefined;
        return verdict;
      });
      return pending;
    },
    last: () => last
  };
}

/** The address list in the background's reply, or undefined for any other shape. */
function addressesFrom(reply: unknown): readonly string[] | undefined {
  if (typeof reply !== "object" || reply === null) return undefined;
  const addresses = (reply as { addresses?: unknown }).addresses;
  return Array.isArray(addresses) && addresses.every((entry) => typeof entry === "string") ? addresses as string[] : undefined;
}
