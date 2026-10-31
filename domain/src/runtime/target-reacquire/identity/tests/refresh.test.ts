import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../llm-evidence";
import { webRefreshTargetIdentity, webTargetObservation, type WebTargetObservation } from "..";

const STALE: JsonObject = { selector: "#old", text: "unchanged act value", browserFrameId: 0, element: {
  tagName: "button", accessibleName: "Open sheet", testId: "open-sheet", selector: "#old", xpath: "/old",
  context: { listPosition: { index: 8, total: 10 }, record: { key: "sheet-A", keyAttribute: "data-sheet-id", text: "Waiting" } }
} };

function observation(elements: JsonObject[], frame = 0): WebTargetObservation {
  const snapshot = {
    url: "https://library.test/sheets", frame: { isTop: frame === 0 }, interactiveElements: elements,
    evidence: { captureOptions: { includeHidden: true }, elements: { scanned: elements.length, candidates: elements.length, matched: elements.length, returned: elements.length, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false }, navigation: { timeOrigin: 100 } }
  };
  return webTargetObservation({ snapshot, page: sanitizeWebLlmSnapshotWithBindings(snapshot),
    scope: { kind: "single-frame", browserFrameId: frame, location: snapshot.url, timeOrigin: 100 }, samePlace: "yes" });
}

function control(key = "sheet-A", hidden = false): JsonObject {
  return { tagName: "button", selector: `#new-${key}`, accessibleName: "Open sheet", hidden,
    attributes: { "data-testid": "open-sheet" }, context: { listPosition: { index: 1, total: 2 }, record: { key, keyAttribute: "data-sheet-id", text: "Ready" } } };
}

test("same key survives record text drift and only fresh identity replaces stale address/place", () => {
  const saved = structuredClone(STALE);
  const result = webRefreshTargetIdentity({ parameters: STALE, observation: observation([control("sheet-B"), control()]) });
  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.equal(result.target.selector, "#new-sheet-A");
  assert.equal(result.target.element.context?.record?.key, "sheet-A");
  assert.equal(result.target.element.context?.record?.text, "Ready");
  assert.equal(result.target.element.xpath, undefined);
  assert.equal(result.target.element.context?.listPosition, undefined);
  assert.deepEqual(STALE, saved, "shared matching never writes caller parameters");
});

test("hidden matching targets and duplicates never dispatch another look-alike", () => {
  assert.equal(webRefreshTargetIdentity({ parameters: STALE, observation: observation([control("sheet-B"), control("sheet-A", true)]) }).outcome, "unmatched");
  assert.equal(webRefreshTargetIdentity({ parameters: STALE, observation: observation([control(), control("sheet-A", true)]) }).outcome, "unmatched");
  assert.equal(webRefreshTargetIdentity({ parameters: STALE, observation: observation([control("sheet-B")]) }).outcome, "unmatched");
});

test("an addressed child's local untagged control keeps the trusted child scope", () => {
  const child = observation([control()], 7);
  assert.equal(child.page.evidence.elements[0]?.frameId, undefined);
  const result = webRefreshTargetIdentity({ parameters: STALE, observation: child });
  assert.equal(result.outcome, "found");
  assert.equal(child.scope.browserFrameId, 7);
});

test("incomplete or uncorrelated observations cannot establish found uniqueness or gone", () => {
  for (const coverage of ["partial", "unknown"] as const) {
    assert.deepEqual(webRefreshTargetIdentity({ parameters: STALE, observation: { ...observation([control()]), coverage } }), { outcome: "unavailable", reason: "observation_incomplete" });
  }
  assert.deepEqual(webRefreshTargetIdentity({ parameters: STALE, observation: { ...observation([]), samePlace: "unknown" } }), { outcome: "unavailable", reason: "place_unproved" });
  assert.deepEqual(webRefreshTargetIdentity({ parameters: { selector: "#old" }, observation: observation([control()]) }), { outcome: "unavailable", reason: "unsupported_target" });
  const noRecord: JsonObject = { element: { tagName: "button", accessibleName: "Open sheet", testId: "open-sheet" } };
  assert.deepEqual(webRefreshTargetIdentity({ parameters: noRecord, observation: observation([]) }), { outcome: "gone", coverage: "complete" });
  const broken = observation([control()]);
  broken.page.selectors.clear();
  assert.deepEqual(webRefreshTargetIdentity({ parameters: STALE, observation: broken }), { outcome: "unavailable", reason: "observation_incomplete" });
  const mixed = observation([control()]);
  mixed.page.evidence.elements[0]!.frameId = 7;
  assert.deepEqual(webRefreshTargetIdentity({ parameters: STALE, observation: mixed }), { outcome: "unavailable", reason: "observation_incomplete" });
});

test("readsWords survives fresh replacement but never permits a stale selector or a pass-row fallback", () => {
  const parameters = structuredClone(STALE);
  (parameters.element as JsonObject).readsWords = true;
  const result = webRefreshTargetIdentity({ parameters, observation: observation([control()]) });
  assert.equal(result.outcome, "found");
  if (result.outcome === "found") {
    assert.equal(result.target.element.readsWords, true);
    assert.doesNotMatch(JSON.stringify(result.target), /#old|\/old|listPosition|tablePosition|handle/u);
  }
  (parameters.element as JsonObject).context = { record: { values: ["sheet-A"] } };
  assert.deepEqual(webRefreshTargetIdentity({ parameters, observation: observation([control()]) }), { outcome: "unavailable", reason: "unsupported_target" });
});

test("complete same-place refresh cannot replace navigation with footer or missing landmark context", () => {
  const base = { tagName: "a", accessibleName: "Open workspace", testId: "open-workspace" };
  const parameters: JsonObject = { selector: "#old-navigation", element: { ...base, context: { landmark: "navigation" } } };
  const saved = structuredClone(parameters);
  for (const context of [{ landmark: "contentinfo" }, {}]) {
    const current = observation([{ ...base, selector: "#fresh-navigation", attributes: { "data-testid": "open-workspace" }, context }]);
    assert.deepEqual(webRefreshTargetIdentity({ parameters, observation: current }), { outcome: "unmatched", reason: "ambiguous" });
    assert.deepEqual(parameters, saved);
  }
});

test("validated navigation refresh retains its place and stable identity without inheriting position or optional metadata", () => {
  const base = { tagName: "a", accessibleName: "Open workspace", testId: "open-workspace" };
  const parameters: JsonObject = { selector: "#old-navigation", element: { ...base, id: "old-id", classNames: ["old-class"], context: { landmark: "navigation", listPosition: { index: 1, total: 2 } } } };
  const current = { ...base, selector: "#fresh-navigation", attributes: { "data-testid": "open-workspace" }, context: { landmark: "navigation", listPosition: { index: 7, total: 8 } } };
  const refreshed = webRefreshTargetIdentity({ parameters, observation: observation([current]) });
  assert.equal(refreshed.outcome, "found");
  if (refreshed.outcome !== "found") return;
  assert.equal(refreshed.target.element.context?.landmark, "navigation");
  assert.equal(refreshed.target.element.context?.listPosition, undefined);
  assert.equal(refreshed.target.element.id, undefined);
  assert.equal(refreshed.target.element.classNames, undefined);
  const twin = { ...current, selector: "#another-navigation" };
  assert.deepEqual(webRefreshTargetIdentity({ parameters, observation: observation([current, twin]) }), { outcome: "unmatched", reason: "ambiguous" });
});
