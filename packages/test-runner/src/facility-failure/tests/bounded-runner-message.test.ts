import assert from "node:assert/strict";
import test from "node:test";
import { boundedRunnerMessage } from "../index.js";

test("a variable name is kept: only opaque tokens, which mix letters and digits, are redacted", () => {
  assert.equal(boundedRunnerMessage("so FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD must be set"), "so FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD must be set");
  assert.equal(boundedRunnerMessage("run run-mu4y52hs-943d1c8d failed"), "run run-mu4y52hs-943d1c8d failed", "a run id is short enough to keep");
  assert.equal(boundedRunnerMessage("key sk-4f3c2a1b0e9d8c7b6a5f4e3d2c1b0a9f8e7d"), "key [REDACTED]");
  assert.equal(boundedRunnerMessage("project 260432a7-2f3d-4219-93b7-b8ce1ed9a8cd"), "project [REDACTED]");
});

test("whitespace collapses to one line and the result is at most the given length", () => {
  assert.equal(boundedRunnerMessage("  one\n\ttwo\r\n three  "), "one two three");
  assert.equal(boundedRunnerMessage("abcdef", 4), "abc…");
  assert.equal(boundedRunnerMessage("abcd", 4), "abcd");
  assert.equal(boundedRunnerMessage("\n"), "");
});

test("credential-shaped text is redacted by the evidence rule", () => {
  assert.equal(boundedRunnerMessage("header Bearer abc.def and passwd: hunter2;"), "header [REDACTED] and [REDACTED];");
});
