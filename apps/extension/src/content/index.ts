// Content script entry point. It owns no behaviour of its own -- only the order
// things happen in, which is the order the original single-file script used and
// which the background worker depends on:
//
//   1. claim the window for this instance (on import of ./instance) so a
//      superseded copy of the script falls silent before it can send anything;
//   2. accept messages from the worker, which refuse every command in one of
//      FluxIQ's own pages and answer the liveness ping everywhere;
//   3. announce readiness, so the worker learns this frame exists even when
//      recording is off -- an own page announces nothing (`./recorder.ts`);
//   4. only once the document is known to be an ordinary page: start counting
//      what could change a look at this frame, so the worker can tell a look
//      that still stands (`./page-changes/`), open the cross-frame geometry
//      bridge, so a child frame can resolve its viewport offset before any
//      snapshot is asked for, and start listening for user interaction
//      (`./lifecycle/`). A revocation takes them all down
//      (`./revoked/`).
//
// Each step lives in a sibling module. Nothing here should grow beyond wiring:
// behaviour belongs in the module that owns the responsibility.

import { installFrameGeometryBridge } from "./frame-geometry";
import { installMessageHandler } from "./message-handler";
import { installRecordingEventListeners } from "./dom-events";
import { installWhenOrdinary } from "./lifecycle";
import { ownDocument } from "./own-document";
import { sendReady } from "./recorder";
import { pageChangeCounter } from "./page-changes";

installMessageHandler();
sendReady();
installWhenOrdinary(
  [() => pageChangeCounter.install(), installFrameGeometryBridge, installRecordingEventListeners],
  { verdict: () => ownDocument.verdict(), later: (again, ms) => void setTimeout(again, ms), askAgainAfterMs: 1000 }
);
