// The recorder's capture defaults, pinned. `capture-settings.ts` documents
// them in prose and the background worker overwrites them per recording, so
// this is the check that the documented default and the shipped default are the
// same thing -- `inputValues` above all, because a recording made with it off
// replays `web.dom.type` as an empty string.
//
// It is a T1 test because `capture-settings.ts` is the one module on this path
// that needs no DOM. What the settings actually gate, and the redaction that
// no setting can switch off, are proven against a live page by
// `e2e/content/tests/redaction.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { captureSettings } from "../capture-settings";

test("every capture setting starts on, so a recording is replayable before the first recording message", () => {
  assert.deepEqual({ ...captureSettings }, { mutations: true, inputValues: true, snapshots: true });
});

test("the settings are mutable in place, because the background worker replaces them per recording", () => {
  const original = { ...captureSettings };
  try {
    captureSettings.inputValues = false;
    assert.equal(captureSettings.inputValues, false);
  } finally {
    Object.assign(captureSettings, original);
  }
  assert.deepEqual({ ...captureSettings }, original);
});
