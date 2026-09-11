// Content script entry point. It owns no behaviour of its own -- only the order
// things happen in, which is the order the original single-file script used and
// which the background worker depends on:
//
//   1. claim the window for this instance (on import of ./instance) so a
//      superseded copy of the script falls silent before it can send anything;
//   2. announce readiness, so the worker learns this frame exists even when
//      recording is off;
//   3. open the cross-frame geometry bridge, so a child frame can resolve its
//      viewport offset before any snapshot is asked for;
//   4. accept messages from the worker;
//   5. start listening for user interaction.
//
// Each step lives in a sibling module. Nothing here should grow beyond wiring:
// behaviour belongs in the module that owns the responsibility.

import { installFrameGeometryBridge } from "./frame-geometry";
import { installMessageHandler } from "./message-handler";
import { installRecordingEventListeners } from "./dom-events";
import { sendReady } from "./recorder";

sendReady();
installFrameGeometryBridge();
installMessageHandler();
installRecordingEventListeners();
