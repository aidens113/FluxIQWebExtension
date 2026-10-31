import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../llm-evidence";
import { webCapturedTargetObservation } from "../capture";

const LOCATION = "https://controls.test/preferences";

function snapshot() {
  return {
    url: LOCATION, frame: { isTop: true },
    interactiveElements: [{ tagName: "button", selector: "#apply", accessibleName: "Apply", visibleText: "Apply" }],
    evidence: {
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: 42 }, captureOptions: { includeHidden: true }
    }
  };
}

function observed(raw = snapshot(), extra: Partial<Parameters<typeof webCapturedTargetObservation>[0]> = {}) {
  return webCapturedTargetObservation({ snapshot: raw, page: sanitizeWebLlmSnapshotWithBindings(raw), sessionId: "paired.one", sourceId: "tab:17:frame:0", requested: { kind: "single-frame", sessionId: "paired.one", browserTabId: 17, browserFrameId: 0 }, ...extra });
}

test("capture provenance comes from the selected gateway session and browser source, with actual producer proof", () => {
  const captured = observed();
  assert.equal(captured.kind, "observed");
  if (captured.kind !== "observed") return;
  assert.equal(captured.observation.coverage, "complete");
  assert.equal(captured.observation.includesHidden, true);
  assert.equal(captured.observation.samePlace, "unknown");
  assert.deepEqual({ ...captured.observation.scope, resetResource: undefined }, { kind: "single-frame", sessionId: "paired.one", browserTabId: 17, browserFrameId: 0, location: LOCATION, timeOrigin: 42, resetResource: undefined });
  const fresh = observed(snapshot(), { previous: captured.observation });
  assert.equal(fresh.kind === "observed" && fresh.observation.samePlace, "yes");
});

test("foreign sessions, sources and addressed paths are rejected before matching", () => {
  for (const extra of [{ sessionId: "paired.two" }, { sourceId: "tab:18:frame:0" }, { sourceId: "tab:17:frame:2" }, { sourceId: "not-a-browser-source" }, { sourceId: "tab:9007199254740992:frame:0" }, { requested: { kind: "single-frame" as const, browserFrameUrlPath: "/another" } }]) {
    assert.equal(observed(snapshot(), extra).kind, "rejected");
  }
});

test("requested hidden capture cannot replace missing producer proof or partial observation", () => {
  const raw = snapshot();
  delete (raw.evidence as { captureOptions?: unknown }).captureOptions;
  const missing = observed(raw);
  assert.equal(missing.kind === "observed" && missing.observation.includesHidden, false);
  assert.equal(missing.kind === "observed" && missing.observation.coverage, "unknown");
  const partial = snapshot();
  partial.evidence.elements.truncated = true;
  const incomplete = observed(partial);
  assert.equal(incomplete.kind === "observed" && incomplete.observation.coverage, "partial");
});

test("missing or withheld location and a changed document never prove the prior place", () => {
  const first = observed();
  assert.equal(first.kind, "observed");
  if (first.kind !== "observed") return;
  for (const [raw, expected] of [
    [{ ...snapshot(), url: "https://controls.test/preferences?token=private-value" }, "unknown"],
    [{ ...snapshot(), evidence: { ...snapshot().evidence, navigation: {} } }, "unknown"],
    [{ ...snapshot(), evidence: { ...snapshot().evidence, navigation: { timeOrigin: 43 } } }, "no"],
    [{ ...snapshot(), url: "https://controls.test/another" }, "no"]
  ] as const) {
    const result = webCapturedTargetObservation({ snapshot: raw, page: sanitizeWebLlmSnapshotWithBindings(raw), sessionId: "paired.one", sourceId: "tab:17:frame:0", requested: { kind: "single-frame", browserFrameId: 0 }, previous: first.observation });
    assert.equal(result.kind === "observed" && result.observation.samePlace, expected);
  }
});
