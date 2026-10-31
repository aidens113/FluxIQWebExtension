import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../llm-evidence";
import { webTargetObservation } from "..";

function snapshot() {
  return {
    url: "https://library.test/sheets", frame: { isTop: true },
    interactiveElements: [{ tagName: "button", selector: "#open", accessibleName: "Open sheet" }],
    evidence: {
      captureOptions: { includeHidden: true },
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: 100 }
    }
  };
}

function observed(raw: unknown) {
  return webTargetObservation({ snapshot: raw, page: sanitizeWebLlmSnapshotWithBindings(snapshot()),
    scope: { kind: "single-frame", browserFrameId: 0, location: "https://library.test/sheets", timeOrigin: 100 }, samePlace: "yes" });
}

test("only explicit applied hidden marker and settled complete raw evidence grant coverage", () => {
  assert.equal(observed(snapshot()).coverage, "complete");
  for (const marker of [undefined, false, "true"]) {
    const raw = snapshot();
    Object.assign(raw.evidence, { captureOptions: marker === undefined ? undefined : { includeHidden: marker } });
    const result = observed(raw);
    assert.equal(result.includesHidden, false);
    assert.equal(result.coverage, "unknown");
  }
  assert.equal(observed(undefined).coverage, "unknown");
});

test("busy/truncated captures are partial and missing positive readiness is unknown", () => {
  const busy = snapshot();
  busy.evidence.loading.busy = true;
  assert.equal(observed(busy).coverage, "partial");
  const truncated = snapshot();
  truncated.evidence.elements.truncated = true;
  assert.equal(observed(truncated).coverage, "partial");
  const old = snapshot();
  Object.assign(old.evidence, { loading: undefined });
  assert.equal(observed(old).coverage, "unknown");
  const wrong = snapshot();
  wrong.frame.isTop = false;
  assert.equal(observed(wrong).samePlace, "unknown");
  const moved = snapshot();
  moved.evidence.navigation.timeOrigin = 101;
  assert.equal(observed(moved).samePlace, "unknown");
});

test("merged, unanswered, malformed and contradictory capture claims never become complete", () => {
  const raw = snapshot();
  const page = sanitizeWebLlmSnapshotWithBindings(raw);
  const merged = webTargetObservation({ snapshot: raw, page, scope: { kind: "merged", browserFrameId: 0, location: raw.url, timeOrigin: 100 }, samePlace: "yes" });
  assert.equal(merged.coverage, "unknown");
  Object.assign(raw.evidence, { unansweredFrameIds: [7] });
  assert.equal(observed(raw).coverage, "partial");
  const badCounts = snapshot();
  badCounts.evidence.elements.returned = 2;
  assert.equal(observed(badCounts).coverage, "unknown");
  const malformed = snapshot();
  Object.assign(malformed.interactiveElements[0]!, { context: { shadowHosts: [7] } });
  assert.equal(observed(malformed).coverage, "unknown");
});
