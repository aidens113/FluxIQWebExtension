// What a `web.dom.capture_snapshot` asks of the capture (t223): only a
// literal `true` under `includeHidden` turns the hidden elements on, and no
// other action asks for anything.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand } from "../protocol";
import { snapshotCaptureOptionsFor } from "../snapshot-capture-options";

const look = (options?: BrowserActionCommand["options"]): BrowserActionCommand =>
  ({ commandId: "c-look", actionType: "web.dom.capture_snapshot", ...(options ? { options } : {}) });

test("a look asked includeHidden: true captures the hidden elements too", () => {
  assert.deepEqual(snapshotCaptureOptionsFor(look({ includeHidden: true })), { includeHidden: true });
});

test("a look asked nothing, false, or something that is not true is the default capture", () => {
  assert.deepEqual(snapshotCaptureOptionsFor(look()), {});
  assert.deepEqual(snapshotCaptureOptionsFor(look({ includeHidden: false })), {});
  assert.deepEqual(snapshotCaptureOptionsFor(look({ includeHidden: "true" })), {});
  assert.deepEqual(snapshotCaptureOptionsFor(look({ includeHidden: 1 })), {});
});

test("no other action asks the capture for anything, whatever its options say", () => {
  const click: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: "#a", options: { includeHidden: true } };
  assert.deepEqual(snapshotCaptureOptionsFor(click), {});
});
