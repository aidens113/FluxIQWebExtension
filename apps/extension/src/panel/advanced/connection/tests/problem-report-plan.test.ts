// "Report a problem" without a DOM: what the Connection tab does with the background's answer.

import assert from "node:assert/strict";
import test from "node:test";
import { problemReportOutcome } from "..";

const report = { schema: "fluxiq.problem-report/1", createdAt: "2026-09-29T12:34:56.000Z", withheld: ["pairing token and pairing code"] };

test("a report becomes text to copy and a dated file name", () => {
  const outcome = problemReportOutcome({ ok: true, value: { report } });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok && outcome.fileName, "fluxiq-problem-report-20260929T123456.json");
  assert.deepEqual(outcome.ok && JSON.parse(outcome.text), report);
});

test("a failure keeps its sentence; an older background or a wrong answer says so", () => {
  assert.deepEqual(problemReportOutcome({ ok: false, sentence: "Only the FluxIQ panel can do that.", detail: "forbidden" }), { ok: false, sentence: "Only the FluxIQ panel can do that.", detail: "forbidden" });
  assert.equal(problemReportOutcome({ ok: false, sentence: "x", unsupported: true }).ok, false);
  assert.match(JSON.stringify(problemReportOutcome({ ok: false, sentence: "x", unsupported: true })), /can't make a problem report yet/);
  assert.match(JSON.stringify(problemReportOutcome({ ok: true, value: { report: { schema: "other" } } })), /without a problem report/);
});
