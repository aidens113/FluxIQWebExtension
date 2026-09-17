import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProjectedFacilityError } from "../index.js";

const GENERIC = "Scenario attempt failed outside a finalized bundle";
const SENTINEL = "private-value-must-not-persist";
const DIAGNOSTIC = { boundary: "no-final-bundle", stage: "scenario.load", reason: "unclassified" } as const;

// The campaign of 2026-09-17 lost four tasks to this: the runner refused each
// run for a missing replay-secret variable, and the command line printed only
// the generic sentence, so the summary said "environment.missing" and nothing
// about which variable.
test("a runner-authored refusal keeps its reason after the generic sentence", () => {
  const cause = new RunnerFailure("environment.missing", "Scenario auth-gate declares the replay secret auth-gate-password, so FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD must be set");
  const error = new ProjectedFacilityError(cause, DIAGNOSTIC);
  assert.equal(error.message, `${GENERIC}: Scenario auth-gate declares the replay secret auth-gate-password, so FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD must be set`);
  assert.equal(error.category, "environment.missing");
  assert.equal(error.cause, cause);
  assert.deepEqual(error.facilityFailure, DIAGNOSTIC);
});

test("any other error keeps only the generic sentence, because its text is not the runner's own", () => {
  for (const cause of [new Error(SENTINEL), Object.assign(new TypeError(SENTINEL), { code: "ENOENT" }), SENTINEL, { message: SENTINEL }]) {
    const error = new ProjectedFacilityError(cause, DIAGNOSTIC);
    assert.equal(error.message, GENERIC);
    assert.equal(error.message.includes(SENTINEL), false);
  }
});

test("the carried reason is one bounded, redacted line", () => {
  const long = new ProjectedFacilityError(new RunnerFailure("fixture.invalid", `Refused: ${"x ".repeat(2_000)}`), DIAGNOSTIC);
  assert.ok(long.message.startsWith(`${GENERIC}: Refused: x x`));
  assert.ok(long.message.length <= GENERIC.length + 2 + 240, `bounded, got ${long.message.length}`);
  assert.ok(long.message.endsWith("…"), "a cut reason says it was cut");

  const token = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
  const redacted = new ProjectedFacilityError(new RunnerFailure("gateway.pairing", `Pairing failed\n  with Bearer ${SENTINEL} and password=${SENTINEL}\r\nfor token ${token}`), DIAGNOSTIC);
  assert.equal(redacted.message.includes(SENTINEL), false);
  assert.equal(redacted.message.includes(token), false);
  assert.equal(/[\r\n]/u.test(redacted.message), false);
  assert.match(redacted.message, /^Scenario attempt failed outside a finalized bundle: Pairing failed with \[REDACTED\] and \[REDACTED\] for token \[REDACTED\]$/u);

  const blank = new ProjectedFacilityError(new RunnerFailure("unknown", "  \n "), DIAGNOSTIC);
  assert.equal(blank.message, GENERIC, "an empty reason adds nothing");
});

test("a runner failure whose message cannot be read still projects", () => {
  const hostile = new RunnerFailure("environment.missing", "unused");
  Object.defineProperty(hostile, "message", { get: () => { throw new Error(SENTINEL); } });
  const error = new ProjectedFacilityError(hostile, DIAGNOSTIC);
  assert.equal(error.message, GENERIC);
  assert.equal(error.category, "environment.missing");
});
