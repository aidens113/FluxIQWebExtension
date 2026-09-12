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

/**
 * A page's evidence, in the producer's shape, with **every collection
 * non-empty and every scalar present**.
 *
 * That exhaustiveness is the whole value of it. The projection omits an empty
 * collection and an absent scalar, so a thin capture writes few paths, and
 * both ratchet directions then pass over the evidence namespace without
 * examining any of it: nothing is produced, so nothing can be produced and
 * undeclared, and nothing is covered, so a declaration nothing produces is the
 * only thing left to catch -- which is the half that then fails for every
 * evidence path at once and gets deleted rather than fixed. Until this fixture
 * existed the snapshot carried no `evidence` at all and roughly thirty paths
 * were checked in neither direction.
 *
 * So: adding a path to `web-state/evidence/project.ts` means adding its input
 * here, or the ratchet goes quiet about it again. The shape is
 * `PageEvidence` in `apps/extension/src/content/evidence/types.ts`.
 */
const pageEvidence = {
  elements: { scanned: 620, candidates: 180, matched: 44, returned: 2, truncated: true, changed: 1, recentlyInteracted: 1 },
  loading: {
    documentState: "interactive",
    busy: true,
    busyRegions: ["#basket"],
    indicators: [{ selector: "#spinner", kind: "spinner", label: "Updating total" }],
    pendingNavigation: false
  },
  navigation: {
    url: "https://example.test/checkout",
    origin: "https://example.test",
    path: "/checkout",
    referrer: "https://example.test/cart",
    type: "navigate",
    redirects: 0,
    historyLength: 3,
    visibility: "visible"
  },
  dialogs: {
    open: [{ selector: "#terms", role: "dialog", modal: true, native: false, label: "Terms" }],
    modal: true,
    armPending: false,
    lastNative: { kind: "confirm", message: "Leave this page?", response: "dismiss", at: 9 }
  },
  overlays: {
    tested: 12,
    blockedCount: 1,
    blockers: [{ selector: "#consent", role: "region", label: "Cookies", blocks: 1, blocked: ["button.pay"] }]
  },
  regions: [{ role: "main", label: "Checkout", selector: "main" }],
  repeating: [{ containerSelector: "ul.items", signature: "li[data-testid=item-#]", itemCount: 4, representative: { selector: "ul.items > li:nth-child(1)", testId: "item-1" } }],
  forms: [{ selector: "form#pay", name: "pay", label: "Payment", action: "/pay", method: "post", controlCount: 1, controls: [{ selector: "#coupon", controlType: "text", name: "coupon" }], submit: "button.pay" }]
};

const snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/checkout",
  title: "Checkout",
  viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 120 },
  selectedText: "Total due",
  focusedElement: { tagName: "input", selector: "input#coupon" },
  interactiveElements: [
    { tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 40, width: 90, height: 36 } },
    { tagName: "input", selector: "input#coupon", attributes: { name: "coupon" }, bounds: { x: 20, y: 100, width: 200, height: 32 } }
  ],
  // Reached through a cast for the same reason the projection reaches it
  // through a narrow read: `WebAutomationDomSnapshotInput` declares only the
  // fields that predate `web-state/evidence/`, and widening it is that
  // directory's decision, not this test's.
  evidence: pageEvidence
} as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0], { timestamp: 10, sourceId: "tab:1" });

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
