// Starts what listens to or watches a page only once the document is known to
// be an ordinary page, so FluxIQ's own page gets no page-change counter, no
// frame-geometry bridge and no recording listener at all (`../own-document/`
// decides, as it does for every command). A verdict of "unconfirmed" -- the
// background did not say where FluxIQ's pages are -- is asked again until it
// is decided, because a document that stayed inert for want of an answer would
// never count a change a later look depends on. Each install returns what
// takes it down, kept so a revocation can (`../revoked/`).

import type { OwnDocumentVerdict } from "../own-document";
import { contentInstalls, revokedEpoch } from "../revoked";

/** One thing to start in an ordinary document; it returns what stops it. */
export type ContentInstall = () => () => void;

export type InstallWhenOrdinaryDeps = {
  /** This document's decision. */
  readonly verdict: () => Promise<OwnDocumentVerdict>;
  /** Runs `again` after `ms`. */
  readonly later: (again: () => void, ms: number) => void;
  /** How long an unconfirmed document waits before asking again. */
  readonly askAgainAfterMs: number;
};

/** Starts every install when the document turns out ordinary, and none when it is FluxIQ's own or revoked. */
export function installWhenOrdinary(installs: readonly ContentInstall[], deps: InstallWhenOrdinaryDeps): void {
  const decide = (): void => {
    void deps.verdict().then((verdict) => {
      if (revokedEpoch.current() > 0) return;
      if (verdict === "ordinary") {
        for (const install of installs) contentInstalls.own(install());
      } else if (verdict === "unconfirmed") {
        deps.later(decide, deps.askAgainAfterMs);
      }
    });
  };
  decide();
}
