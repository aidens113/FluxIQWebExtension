import assert from "node:assert/strict";
import test from "node:test";
import { recordingStartMessage } from "../index.js";

test("recording start carries explicit description independently of title or task", () => {
  assert.deepEqual(recordingStartMessage("  Demonstrates opening a menu and inspecting its entries.  "), { type: "fluxiq.startRecording", description: "Demonstrates opening a menu and inspecting its entries." });
});

test("missing, generated metadata and oversized descriptions never become recording context", () => {
  for (const value of [undefined, null, "", " \n ", { title: "Generated recording", instruction: "Do the task" }, "x".repeat(4001)]) {
    assert.throws(() => recordingStartMessage(value), /explicit fixture-authored description/);
  }
});
