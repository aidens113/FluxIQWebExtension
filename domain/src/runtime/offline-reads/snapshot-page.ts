// The sandboxed page an offline read runs in (traces and offline trials, P5,
// tier 2). A page snapshot recorded with a traced command's result is loaded
// at its own address with page scripts and the network off, and the
// extension's own content code is run over it for one action, exactly as the
// extension's background hands that action to a tab. A host with a browser
// implements this port; the domain decides what may be evaluated and what an
// answer means. Nothing here imports a browser module.

import type { WebAutomationActionCommand, WebAutomationActionResult } from "../../actions/types";

/**
 * One recorded part of a page snapshot, as the client uploaded it for a traced
 * command: the page itself (`primary`) or something it refers to
 * (`resource`). `source` is where the client found it (the page's address for
 * the primary, the resource's address otherwise); `null` when it named none.
 */
export type WebPageSnapshotPart = Readonly<{
  sha256: string;
  mediaType: string;
  role: "primary" | "resource";
  source: string | null;
  bytes: Uint8Array;
}>;

/**
 * A page snapshot read back from a trace: the page's address, its serialized
 * document, the resources carried with it, and how many parts the client
 * could not carry (`unavailable`, as its trace metadata counted them).
 */
export type WebPageSnapshot = Readonly<{
  url: string;
  primary: WebPageSnapshotPart;
  resources: readonly WebPageSnapshotPart[];
  unavailable: number;
}>;

/**
 * What the sandbox saw while the content code ran. A page that was static for
 * the action ran no script, leaked no request and held no navigation;
 * `requestsRefused` counts addresses the snapshot does not hold (answered
 * with nothing), and `scrollsPastEnd` counts the times the content code asked
 * a scroll container or the page for more than the snapshot held (a feed or
 * lazy list would have loaded more there, live).
 */
export type WebSnapshotSandboxObservations = Readonly<{
  scriptsRan: number;
  requestsLeaked: number;
  navigationsHeld: number;
  requestsRefused: number;
  scrollsPastEnd: number;
}>;

/**
 * The outcome of one action run over a snapshot: the content code's own
 * result, as the background receives it from the tab, with what the sandbox
 * saw; or why it could not be run at all (the snapshot could not be loaded,
 * or the content code could not start in it).
 */
export type WebSnapshotPageEvaluation =
  | Readonly<{ status: "evaluated"; result: WebAutomationActionResult; observations: WebSnapshotSandboxObservations }>
  | Readonly<{ status: "unavailable"; reason: "snapshot_unavailable" | "dynamic_content"; detail: string }>;

/** A sandboxed browser page that runs the extension's content code for one action over one recorded snapshot. */
export type WebSnapshotPage = Readonly<{
  evaluate(snapshot: WebPageSnapshot, action: WebAutomationActionCommand): Promise<WebSnapshotPageEvaluation>;
}>;
