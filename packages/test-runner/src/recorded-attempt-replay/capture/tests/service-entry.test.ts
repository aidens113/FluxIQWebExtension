import assert from "node:assert/strict";
import test from "node:test";
import { recordedRequestDigest } from "../../request-digest.js";
import { recordedCaptureRequest } from "../request.js";
import { recordedCaptureServiceEntry } from "../service-entry.js";

const declared = recordedCaptureRequest({ projectId: "project.fixture", flowId: "flow.fixture", startLocation: "http://127.0.0.1/company", taskId: "company-website-apprentices" });
const liveSession = "session.live-credential-fixture";

// What Core's public route hands the service for that post
// (`framework/automation-service/service/flow-bootstrap-requests/generate.ts`):
// the posted fields, plus the caller it authenticated, the permissions it parsed
// and the wait it gives a person's answer.
function routed() {
  return { projectId: declared.projectId, flowId: declared.flowId, caller: { actorUserId: "user.fixture", actorSessionId: liveSession }, permittedConsequences: [], evidenceGuided: true as const, startLocation: declared.startLocation!, taskProcessing: structuredClone(declared.taskProcessing!), permissionAskTimeoutMs: 120_000 };
}

test("the posted request alone never binds what the service receives through the route", () => {
  assert.notEqual(recordedRequestDigest(JSON.stringify({ request: declared, chat: null })), recordedRequestDigest(JSON.stringify({ request: routed(), chat: null })));
});

test("the bound entry is the routed request whole, with only its session credential replaced", () => {
  const actual = routed();
  const entry = recordedCaptureServiceEntry(actual, declared);
  assert.equal(entry.chat, null);
  const { caller, ...rest } = entry.request;
  const { caller: routedCaller, ...routedRest } = routed();
  assert.deepEqual(rest, routedRest);
  assert.equal(caller.actorUserId, routedCaller.actorUserId);
  assert.notEqual(caller.actorSessionId, liveSession);
  assert.ok(!JSON.stringify(entry).includes(liveSession));
  assert.deepEqual(actual, routed());
  assert.notEqual(entry.request.taskProcessing, actual.taskProcessing);
  assert.equal(recordedRequestDigest(JSON.stringify(entry)), recordedRequestDigest(JSON.stringify(recordedCaptureServiceEntry(routed(), declared))));
});

test("a declared field that did not reach the service unchanged refuses the capture", () => {
  const changedProcessing = { ...routed(), taskProcessing: { process: { where: [{ field: "role", contains: "apprentice" }], columns: ["name"] } } };
  assert.throws(() => recordedCaptureServiceEntry(changedProcessing, declared), /recorded_capture_actual_entry_changed/u);
  assert.throws(() => recordedCaptureServiceEntry({ ...routed(), startLocation: "http://127.0.0.1/elsewhere" }, declared), /recorded_capture_actual_entry_changed/u);
  const { evidenceGuided: _dropped, ...withoutEvidence } = routed();
  assert.throws(() => recordedCaptureServiceEntry(withoutEvidence, declared), /recorded_capture_actual_entry_changed/u);
  assert.throws(() => recordedCaptureServiceEntry({ ...routed(), flowId: "flow.other" }, declared), /recorded_capture_actual_entry_changed/u);
});

/** A routed request as untrusted JSON, so a malformed caller reaches the reader the way a wire value would. */
function routedWithCaller(caller: unknown): ReturnType<typeof routed> {
  return JSON.parse(JSON.stringify({ ...routed(), caller }));
}

test("a caller that is not exactly a user and a session is refused", () => {
  assert.throws(() => recordedCaptureServiceEntry(routedWithCaller({ actorUserId: "user.fixture", actorSessionId: liveSession, extra: "x" }), declared), /recorded_capture_caller_unreadable/u);
  assert.throws(() => recordedCaptureServiceEntry(routedWithCaller(undefined), declared), /recorded_capture_caller_unreadable/u);
  assert.throws(() => recordedCaptureServiceEntry(routedWithCaller({ actorUserId: 7, actorSessionId: liveSession }), declared), /recorded_capture_caller_unreadable/u);
});
