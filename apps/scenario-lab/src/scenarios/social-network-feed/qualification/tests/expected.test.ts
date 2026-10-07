import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeedState, mutateFeedState } from "../../state.js";
import { SOCIAL_NETWORK_FEED_TASKS } from "../../live-tasks.js";
import { requestAuditAccountFacts, requestAuditExpected, requestAuditWorkflow } from "../index.js";
import { FRIEND_REQUESTS } from "../../content/index.js";

test('qualification: independent initial complete account facts', () => {
  assert.equal(requestAuditAccountFacts(createFeedState()), requestAuditExpected.pageFacts![0]!.value);
});
test('qualification: honest desired state and prohibited consequence reject same-looking output', () => {
  const state = createFeedState();
  const wrong = mutateFeedState(state, 'confirm-request', { id: FRIEND_REQUESTS[0]!.id });
  assert.equal(Object.keys(wrong.requests).length, 1);
  assert.notEqual(requestAuditAccountFacts(wrong), requestAuditExpected.finalState![0]!.value);
  assert.equal(requestAuditExpected.extracted![0]!.records!.length, 8);
  assert.equal(requestAuditExpected.extracted![0]!.records![4]!.mutualFriends, '');
  assert.notDeepEqual(requestAuditExpected.extracted![0]!.records!.slice(0,4), requestAuditExpected.extracted![0]!.records);
});
test('qualification: registered task names exact nonempty dataset and owns declared workflow', () => {
  const entry = requestAuditExpected.extracted![0]!;
  const task = SOCIAL_NETWORK_FEED_TASKS.find((task) => task.expectedDatasetId === entry.step)!;
  assert.ok(task);
  assert.equal(entry.count, entry.records!.length);
  assert.ok(requestAuditWorkflow.recordingScript.some((step) => step.id === entry.step));
  assert.equal(task.permissionPoint?.control, undefined);
});
