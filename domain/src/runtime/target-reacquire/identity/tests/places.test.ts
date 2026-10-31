import assert from "node:assert/strict";
import test from "node:test";
import { createWebTargetPlaces } from "../places";
import type { WebTargetCaptureProvenance } from "../provenance";

const TOP: WebTargetCaptureProvenance = { scope: { kind: "merged", sessionId: "paired.one", browserTabId: 17, browserFrameId: 0, resetResource: "top-resource", location: "https://controls.test/", timeOrigin: 10 }, coverage: "unknown", includesHidden: false };
const CHILD: WebTargetCaptureProvenance = { scope: { kind: "single-frame", sessionId: "paired.one", browserTabId: 17, browserFrameId: 4, browserFrameUrlPath: "/editor", resetResource: "child-resource", location: "https://controls.test/editor", timeOrigin: 20 }, coverage: "complete", includesHidden: true };
const STATE = { stateRef: "web.state.1@attempt.original:after_action", stateSnapshotId: "web.state.1", capturedAt: 0 };
const TOP_SCOPE = { kind: "single-frame" as const, browserFrameId: 0 };
const CHILD_SCOPE = { kind: "single-frame" as const, browserFrameId: 4, browserFrameUrlPath: "/editor" };

test("a ref proves only the bound actual attempt and snapshot id, including honest reuse", () => {
  const places = createWebTargetPlaces();
  places.keep(STATE, { ...TOP, page: { private: "must-not-be-kept" } } as WebTargetCaptureProvenance);
  places.bind("attempt.first", STATE);
  assert.deepEqual(places.of({ attemptId: "attempt.first", beforeAction: STATE }, TOP_SCOPE), TOP);
  assert.equal(places.of({ attemptId: "attempt.other", beforeAction: STATE }, TOP_SCOPE), undefined);
  assert.equal(places.of({ attemptId: "attempt.first", beforeAction: { ...STATE, stateSnapshotId: "wrong" } }, TOP_SCOPE), undefined);
  places.bind("attempt.reused", STATE);
  assert.deepEqual(places.of({ attemptId: "attempt.reused", beforeAction: STATE }, TOP_SCOPE), TOP);
  assert.deepEqual(Object.keys(places.captured(STATE)!).sort(), ["coverage", "includesHidden", "scope"]);
  places.bind("attempt.forged", { stateRef: "web.state.forged", stateSnapshotId: "web.state.forged" });
  assert.equal(places.of({ attemptId: "attempt.forged", beforeAction: STATE }, TOP_SCOPE), undefined);
});

test("top provenance cannot stand in for a child, and a reused top ref does not reuse another attempt's child", () => {
  const places = createWebTargetPlaces();
  places.keep(STATE, TOP);
  places.bind("attempt.first", STATE);
  assert.equal(places.of({ attemptId: "attempt.first", beforeAction: STATE }, CHILD_SCOPE), undefined);
  places.keepScoped("attempt.first", STATE, CHILD_SCOPE, CHILD);
  assert.deepEqual(places.of({ attemptId: "attempt.first", beforeAction: STATE }, CHILD_SCOPE), CHILD);
  places.bind("attempt.reused", STATE);
  assert.equal(places.of({ attemptId: "attempt.reused", beforeAction: STATE }, CHILD_SCOPE), undefined);
  assert.deepEqual(places.of({ attemptId: "attempt.reused", beforeAction: STATE }, TOP_SCOPE), TOP);
  places.keepScoped("attempt.reused", STATE, CHILD_SCOPE, { ...CHILD, scope: { ...CHILD.scope, timeOrigin: 21 } });
  assert.equal(places.of({ attemptId: "attempt.reused", beforeAction: STATE }, CHILD_SCOPE)?.scope.timeOrigin, 21);
  assert.equal(places.of({ attemptId: "attempt.first", beforeAction: STATE }, CHILD_SCOPE)?.scope.timeOrigin, 20);
});

test("all actual captures share the 64-entry bound and evicted state cannot be rebound", () => {
  const places = createWebTargetPlaces();
  places.keep(STATE, TOP);
  places.bind("attempt.first", STATE);
  for (let index = 2; index <= 65; index += 1) places.keep({ stateRef: `web.state.${index}`, stateSnapshotId: `web.state.${index}` }, TOP);
  assert.equal(places.of({ attemptId: "attempt.first", beforeAction: STATE }, TOP_SCOPE), undefined);
  places.bind("attempt.reused", STATE);
  assert.equal(places.of({ attemptId: "attempt.reused", beforeAction: STATE }, TOP_SCOPE), undefined);
});
