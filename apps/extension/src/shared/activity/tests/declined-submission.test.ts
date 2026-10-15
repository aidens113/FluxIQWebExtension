// A submission of steps Core refused, read from its row (`declined-submission.ts`), and the
// status line that says it. t649 (A8 frozen pair 3, `run-mv9zn5ob-d929084d`, 00012): a builder's
// refused submission read "Done" because its code carried no failing word.

import assert from "node:assert/strict";
import test from "node:test";

import { activityWording, declinedSubmission, type ClientGatewayActivity } from "../index";

function row(status: "started" | "succeeded" | "failed", text?: string, ref = "core.submit_subflow"): ClientGatewayActivity {
  return {
    activityId: "build:b", sequence: 1, subject: { kind: "build", id: "b", projectId: "p" }, at: "2026-10-15T20:33:06.000Z", phase: "exploring",
    label: status === "started" ? "Using “Submit subflow”" : "Using “Submit subflow” — done",
    detail: { kind: "tool", title: "Using “Submit subflow”", status, ref, ...(text === undefined ? {} : { text }) }
  };
}

test("a submission that came back under a refusal's code was not taken, in words", () => {
  assert.equal(declinedSubmission(row("succeeded", "Result: flow_bootstrap.evidence_completion_parameters_unresolved:c01a26f6")), "some steps weren't written in a way the Flow can run");
  assert.equal(declinedSubmission(row("succeeded", "Result: candidate.unchanged_submission")), "it was the same as the steps already sent, sent again unchanged");
  assert.equal(declinedSubmission(row("failed", "Result: subflow.scope_refused:ba64ff77", "core.submit_candidate")), "some steps weren't written in a way the Flow can run");
});

test("an accepted submission, one under way, one Core said in words, and any other tool are not read", () => {
  assert.equal(declinedSubmission(row("succeeded")), undefined);
  assert.equal(declinedSubmission(row("started", "Result: flow_bootstrap.evidence_completion_plan_invalid")), undefined);
  assert.equal(declinedSubmission(row("succeeded", "Result: candidate.loop_or_binding_refused · Declined: a repeat wasn't written in a way the Flow can run", "core.submit_candidate")), undefined);
  assert.equal(declinedSubmission(row("succeeded", "Result: web.click.succeeded", "core.run_node")), undefined);
});

test("the status line says a refused submission was not done, never done", () => {
  const said = activityWording(row("succeeded", "Result: flow_bootstrap.evidence_completion_parameters_unresolved:c01a26f6"));
  assert.equal(said.outcome, "not done: some steps weren't written in a way the Flow can run");
  assert.doesNotMatch(said.sentence, /— done|flow_bootstrap/u);
  assert.equal(activityWording(row("succeeded")).outcome, "done");
});
