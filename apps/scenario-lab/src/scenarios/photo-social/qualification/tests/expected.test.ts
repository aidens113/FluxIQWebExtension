import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhotoState, mutatePhotoState } from "../../state.js";
import { PHOTO_SOCIAL_LIVE_TASKS } from "../../live-tasks.js";
import { studioUnionAccountFacts, studioUnionExpected, studioUnionWorkflow } from "../index.js";

test('qualification: independent initial complete account facts', () => {
  assert.equal(studioUnionAccountFacts(createPhotoState()), studioUnionExpected.pageFacts![0]!.value);
});
test('qualification: honest desired state and prohibited consequence reject same-looking output', () => {
  let state = createPhotoState();
  for (const code of ['DNcepNICLlQ','D5ESx9wGf76']) state = mutatePhotoState(state, 'save', { code, saved: true });
  state = mutatePhotoState(state, 'collection-add', { slug: 'studio-inspo', codes: ['DNcepNICLlQ','D5ESx9wGf76'] });
  assert.equal(studioUnionAccountFacts(state), studioUnionExpected.finalState![0]!.value);
  assert.equal(studioUnionAccountFacts(mutatePhotoState(state, 'collection-add', { slug: 'studio-inspo', codes: ['DNcepNICLlQ','DdAML7AgNTw','D5ESx9wGf76'] })), studioUnionExpected.finalState![0]!.value);
  const wrong = mutatePhotoState(state, 'like', { code: 'DNcepNICLlQ', liked: true });
  assert.deepEqual(wrong.collections, state.collections);
  assert.notEqual(studioUnionAccountFacts(wrong), studioUnionExpected.finalState![0]!.value);
});
test('qualification: registered task names exact nonempty dataset and owns declared workflow', () => {
  const entry = studioUnionExpected.extracted![0]!;
  const task = PHOTO_SOCIAL_LIVE_TASKS.find((task) => task.expectedDatasetId === entry.step)!;
  assert.ok(task);
  assert.equal(entry.count, entry.records!.length);
  assert.ok(studioUnionWorkflow.recordingScript.some((step) => step.id === entry.step));
  assert.equal(task.permissionPoint?.control, undefined);
});
