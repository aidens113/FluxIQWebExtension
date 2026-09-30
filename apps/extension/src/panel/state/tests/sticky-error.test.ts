// Errors end with their cause: the two defects the UI audit found were errors
// that outlived their problem, and errors wiped the instant they appeared.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus } from "../../../shared/protocol";
import { createStickyError } from "../sticky-error";
import { statusWith } from "../../tests/status-fixture";

test("a status that does not remove the cause leaves the error showing", () => {
  const error = createStickyError<ExtensionStatus>();
  error.show("Can't reach FluxIQ.", (status) => status.connectionState === "connected", "WebSocket connection failed.");
  assert.equal(error.observe(statusWith({ connectionState: "connecting" })), false);
  assert.equal(error.observe(statusWith({ connectionState: "error" })), false);
  assert.deepEqual(error.current(), { sentence: "Can't reach FluxIQ.", detail: "WebSocket connection failed." });
});

test("the error clears once its cause is gone, and stays gone", () => {
  const error = createStickyError<ExtensionStatus>();
  error.show("Can't reach FluxIQ.", (status) => status.connectionState === "connected");
  assert.equal(error.observe(statusWith({ connectionState: "connected" })), true);
  assert.equal(error.current(), undefined);
  assert.equal(error.observe(statusWith({ connectionState: "error" })), false, "a later failure is a new error, not the old one back");
  assert.equal(error.current(), undefined);
});

test("trying again clears the last attempt's error", () => {
  const error = createStickyError<ExtensionStatus>();
  error.show("Something went wrong.", () => false);
  error.clear();
  assert.equal(error.current(), undefined);
});
