// Where the background's tab gate takes FluxIQ's own pages from: the
// connection's settings, read per decision so a settings change applies to the
// next call. The rule itself -- which addresses those settings make FluxIQ's,
// loopback names and the hosted sign-in routes included -- is shared with the
// content script (`shared/own-pages/`), so the two sides cannot drift.

import { isOwnPageAddress, ownPageAddresses } from "../../shared/own-pages";

/** The configured addresses of FluxIQ's own pages; read on every decision. */
export type OwnPageAddresses = () => readonly string[];

/** Any tab-like value the gate decides on: its committed address and the one it is loading, when either is known. */
export type OwnPageCandidate = { readonly url?: string | undefined; readonly pendingUrl?: string | undefined };

let addresses: OwnPageAddresses = () => ownPageAddresses(undefined);

/** Sets where FluxIQ's own pages are. The background connection calls it once, with its settings. */
export function configureOwnPages(source: OwnPageAddresses): void {
  addresses = source;
}

/** The addresses as they stand now: what a content script is told when it asks (`shared/own-pages/`). */
export function currentOwnPageAddresses(): string[] {
  return [...addresses()];
}

/** Whether `url` is one of FluxIQ's own pages. An address that does not parse, or has no origin, is not. */
export function isOwnPage(url: string | undefined): boolean {
  return isOwnPageAddress(url, addresses());
}

/** Whether a tab shows, or is loading, one of FluxIQ's own pages. */
export function isOwnPageTab(tab: OwnPageCandidate): boolean {
  return isOwnPage(tab.url) || isOwnPage(tab.pendingUrl);
}

/** `tabs` without FluxIQ's own pages: what may be reported about the browser. */
export function withoutOwnPages<T extends OwnPageCandidate>(tabs: readonly T[]): T[] {
  return tabs.filter((tab) => !isOwnPageTab(tab));
}
