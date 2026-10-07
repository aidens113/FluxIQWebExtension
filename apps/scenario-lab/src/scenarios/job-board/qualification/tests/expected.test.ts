import assert from "node:assert/strict";
import { test } from "node:test";
import { createJobBoardState, mutateJobBoardState } from "../../state.js";
import { JOB_BOARD_LIVE_TASKS } from "../../live-tasks.js";
import { closedJobsAccountFacts, closedJobsExpected, closedJobsWorkflow } from "../index.js";

test('qualification: independent initial complete account facts', () => {
  assert.equal(closedJobsAccountFacts(createJobBoardState()), closedJobsExpected.pageFacts![0]!.value);
});
test('qualification: honest desired state and prohibited consequence reject same-looking output', () => {
  const cleaned = mutateJobBoardState(createJobBoardState(), 'unsave', { key: '21184d1fa92f3741' });
  assert.equal(closedJobsAccountFacts(cleaned), closedJobsExpected.finalState![0]!.value);
  const wrong = mutateJobBoardState(cleaned, 'follow', { company: 'Halvard Systems' });
  assert.deepEqual(wrong.saved, cleaned.saved);
  assert.notEqual(closedJobsAccountFacts(wrong), closedJobsExpected.finalState![0]!.value);
});
test('qualification: registered task names exact nonempty dataset and owns declared workflow', () => {
  const entry = closedJobsExpected.extracted![0]!;
  const task = JOB_BOARD_LIVE_TASKS.find((task) => task.expectedDatasetId === entry.step)!;
  assert.ok(task);
  assert.equal(entry.count, entry.records!.length);
  assert.ok(closedJobsWorkflow.recordingScript.some((step) => step.id === entry.step));
  assert.equal(task.permissionPoint?.control, "Unsave job");
});
