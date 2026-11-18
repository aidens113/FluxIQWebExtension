// A revoked document's content script, taken out of service: everything it
// holds about the page is discarded and nothing is sent. Unlike stopping a
// recording, nothing pending is flushed -- what was typed or changed in a page
// FluxIQ may no longer read must not leave it.

import { hoverState } from "../action-runtime/hover-state";
import { forgetObservedEventElements } from "../event-elements";
import { suspendActivityOverlay } from "../activity-overlay";
import { suspendPick } from "../picker";
import { suspendRecording } from "../recorder";
import { forgetShadowRootEvents } from "../shadow-root-events";
import { contentInstalls, revokedEpoch } from "../revoked";

/** Revokes this document's content script; safe to call again. */
export function suspendContent(): void {
  revokedEpoch.advance();
  contentInstalls.disposeAll();
  suspendRecording();
  forgetObservedEventElements();
  forgetShadowRootEvents();
  suspendPick();
  suspendActivityOverlay();
  hoverState.release();
}
