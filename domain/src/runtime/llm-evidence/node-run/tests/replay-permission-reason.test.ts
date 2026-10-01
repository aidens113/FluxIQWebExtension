// The reason a replayed or verified step gives when Core refused its permission.
//
// A dry run replays draft steps through the same gate as exploration. A step
// the person already declined used to come back `consequences_not_granted` --
// "the request now in front of the person" -- though nobody was being asked
// (t195-w18). It now says the person declined it, as a live press does.

import assert from "node:assert/strict";
import test from "node:test";
import { webNodeReplayPermissionReason } from "../replay-answer";

test("a replayed step the person already declined says so", () => {
  assert.equal(webNodeReplayPermissionReason({ kind: "refused", requestId: "permission-request:1", declined: true }), "consequences_declined");
});

test("a replayed step still waiting on the person, or never answered, is not granted", () => {
  assert.equal(webNodeReplayPermissionReason({ kind: "refused", requestId: "permission-request:1" }), "consequences_not_granted");
});

test("a replayed step with nobody to ask, or an unreadable declaration, keeps its own reason", () => {
  assert.equal(webNodeReplayPermissionReason({ kind: "refused", requestId: null, declined: true }), "nobody_to_ask");
  assert.equal(webNodeReplayPermissionReason({ kind: "invalid" }), "consequences_unreadable");
});
