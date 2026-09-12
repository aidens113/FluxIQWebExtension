// The recording domain's declared state paths, against the paths its producers
// actually write.
//
// A declared path nothing produces is not harmless: Core offers it to Flow
// authors and to the graph generator as a binding, and every read of it comes
// back empty. Ten `elements.*.<field>` paths were declared that way, because
// the element projection writes one JSON blob per element and nothing beneath
// it; `browser.permissions` was the mirror defect, produced and undeclared.
// Both directions are asserted here, so the declaration and the producers
// cannot drift apart again without a test failing.

import assert from "node:assert/strict";
import test from "node:test";
import type { RecordingDomainEventReducerContext, StateSnapshot } from "fluxiq/automation-studio";
import { webAutomationRecordingDomain } from "../domain";
import { webAutomationStateReducer } from "../reducers";
import { createWebAutomationInitialState } from "../state";
import { createWebAutomationStateFromSnapshot, createWebAutomationStateFromTabs } from "../web-state";

const declaredPaths = (webAutomationRecordingDomain.statePaths ?? []).map((entry) => entry.path);

/**
 * A declared path covers a produced one when it names it exactly, or when it
 * ends in the wildcard segment and the produced path sits under its prefix.
 * `elements.<id>` ids contain dots of their own (`elements.button.save`), so
 * the wildcard has to cover the whole remainder rather than one segment.
 */
function coveringPath(path: string): string | undefined {
  return declaredPaths.find((declared) => declared === path || (declared.endsWith(".*") && path.startsWith(declared.slice(0, -1))));
}

function producedPaths(snapshot: StateSnapshot): string[] {
  return Object.keys(snapshot.namespaces.web?.values ?? {});
}

const snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/checkout",
  title: "Checkout",
  viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 120 },
  selectedText: "Total due",
  focusedElement: { tagName: "input", selector: "input#coupon" },
  interactiveElements: [
    { tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 40, width: 90, height: 36 } },
    { tagName: "input", selector: "input#coupon", attributes: { name: "coupon" }, bounds: { x: 20, y: 100, width: 200, height: 32 } }
  ]
}, { timestamp: 10, sourceId: "tab:1" });

const tabState = createWebAutomationStateFromTabs(
  { tabId: 7, url: "https://example.test", title: "Example", active: true },
  [{ tabId: 7 }, { tabId: 8 }],
  { timestamp: 11, recording: true, permissions: ["tabs", "scripting"] }
);

// The reducer reads only `event` and `previousState` from its context, so the
// recording, definition and domain a live call would carry are left out rather
// than fabricated.
const reducedState = webAutomationStateReducer({
  event: {
    recordingId: "recording.test",
    domainId: webAutomationRecordingDomain.domainId,
    eventType: "web.client.error",
    timestamp: 12,
    sourceId: "tab:1",
    target: { selector: "input#coupon" },
    payload: {
      url: "https://example.test/checkout",
      title: "Checkout",
      inputValue: "SAVE10",
      element: { selector: "input#coupon", tagName: "input" },
      scroll: { x: 0, y: 40 },
      actionResult: { status: "succeeded" },
      visualTarget: { namespace: "web", statePath: "web.elements.input-coupon" }
    }
  },
  previousState: createWebAutomationInitialState(12)
} as unknown as RecordingDomainEventReducerContext) as StateSnapshot;

const allProduced = [...producedPaths(snapshotState), ...producedPaths(tabState), ...producedPaths(reducedState)];

test("every state path a producer writes is declared", () => {
  for (const path of allProduced) {
    assert.ok(coveringPath(path), `web.${path} is written but not declared in the recording domain`);
  }
});

test("every declared state path is written by a producer", () => {
  const covered = new Set(allProduced.map((path) => coveringPath(path)));
  for (const declared of declaredPaths) {
    assert.ok(covered.has(declared), `web.${declared} is declared but no producer writes it`);
  }
});

test("an element is one declared JSON value, not eleven", () => {
  assert.deepEqual(declaredPaths.filter((path) => path.startsWith("elements.*.")), [], "the element projection writes no per-field state value");
  assert.equal(coveringPath("elements.button.pay"), "elements.*", "a captured element is covered by the blob path");
  assert.equal(coveringPath("elements.count"), "elements.count", "the count is its own value, not part of the blob");
});

test("the removed paths were the unproduced ones, and nothing produced was removed with them", () => {
  for (const field of ["selector", "stableId", "tagName", "text", "label", "value", "href", "visible", "enabled", "bounds"]) {
    assert.equal(producedPaths(snapshotState).includes(`elements.button.pay.${field}`), false, `elements.*.${field} is not produced`);
  }
  assert.equal(producedPaths(snapshotState).includes("elements.button.pay"), true, "the element blob is produced");
});
