// The leak test: a realistic page, captured the way the extension captures it,
// and nothing in the packet that comes out is a way of addressing the page.
//
// This is deliberately written against the serialized packet rather than
// against fields, because the failure it is here to catch is a *new* field. A
// per-field assertion only covers the fields someone thought of; a scan of the
// bytes covers the one added next year by someone who never read this file. The
// snapshot below therefore puts a selector in every place the wire contract
// allows one -- elements, the focused element, a child frame, dialogs, loading
// indicators, overlay blockers, busy regions -- so any of them reaching the
// packet fails here.
//
// It is the producer half of the proof. The transport half lives in Core, in
// `runtime/llm/tests/opaque-target-override.test.ts`, which asserts the same
// absence of the request body the provider actually receives.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "..";
import { webFailureRepairParameters } from "../repairable-parameters";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";

/** Every selector this page contains. None of them may survive into the packet. */
const SELECTORS = [
  "#place-order",
  "input#coupon",
  "form.checkout > .row:nth-child(2) input",
  '[data-testid="quantity"]',
  "frame[3] >> #card-name",
  "#confirm-dialog",
  "#session-warning",
  "#cookie-wall",
  "#cookie-wall h2",
  "#spinner",
  "#cart",
  "//button[@id='legacy']",
];

/**
 * Every key a packet element may carry, written out rather than derived, so
 * adding one to the contract has to be a decision taken here as well.
 */
const ALLOWED_ELEMENT_KEYS = new Set([
  "target", "tag", "frameId", "role", "name", "text", "inputType", "controlType",
  "hasValue", "selectedValue", "href", "options", "revealKind", "expanded",
  "focused", "recent", "changed", "form", "landmark", "heading", "item", "cell",
]);

/** Every key the whole packet may carry, at any depth. */
const ALLOWED_PACKET_KEYS = new Set([
  ...ALLOWED_ELEMENT_KEYS,
  // The packet itself.
  "schemaVersion", "trust", "location", "title", "elements", "elementTotal",
  "truncated", "captureTruncated", "elementsTruncated", "budgetTruncated",
  // A failure packet's statements about the failed action: which control it
  // addressed, and which parameters a repair fills (`element`, the one every
  // repairable action has).
  "failedTarget", "failedTargetMissing", "failedTargetUnknown", "repairParameters", "element",
  // Page context.
  "frame", "isTop", "childFrameIds", "loading", "readyState", "busy", "spinner",
  "pendingNavigation", "navigation", "type", "redirects", "referrer", "dialogs",
  "modal", "blockedBy", "blocks", "selectedText",
  // Nested values on an element.
  "value", "label", "index", "total", "row", "column", "header",
]);

function realisticSnapshot(): Record<string, unknown> {
  return {
    url: "https://shop.example.test/checkout?session=private#fragment",
    title: "Checkout",
    frame: { isTop: true },
    focusedElement: { tagName: "input", selector: "input#coupon", name: "Coupon code" },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order", attributes: { type: "submit" } },
      { tagName: "input", selector: "input#coupon", name: "Coupon code", context: { formName: "discount", heading: "Have a code?" } },
      { tagName: "input", selector: "form.checkout > .row:nth-child(2) input", name: "Postcode" },
      { tagName: "input", selector: '[data-testid="quantity"]', name: "Quantity", inputType: "number", context: { listPosition: { index: 2, total: 6 } } },
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } },
      { tagName: "a", selector: "//button[@id='legacy']", visibleText: "Legacy checkout", href: "/legacy" },
      { tagName: "input", selector: "#card-number", name: "Card number", inputType: "text", attributes: { autocomplete: "billing cc-number" } },
    ],
    // The page items sit under `evidence`, in the producer's own shape: that is
    // where `apps/extension/src/content/evidence/` writes them.
    evidence: {
      dialogs: {
        open: [
          { selector: "#confirm-dialog", role: "dialog", modal: true, native: false, label: "Confirm your order" },
          { selector: "#session-warning", role: "alertdialog", modal: false, native: false, label: "Session expiring" },
        ],
        modal: true,
      },
      overlays: {
        tested: 24,
        blockedCount: 2,
        blockers: [
          { selector: "#cookie-wall", role: "dialog", label: "We use cookies", blocks: 2, blocked: ["#place-order", "input#coupon"] },
          { selector: "#cookie-wall h2", role: "heading", label: "Cookies", blocks: 1, blocked: ["#place-order"] },
        ],
      },
      loading: {
        documentState: "interactive",
        busy: true,
        busyRegions: ["#cart"],
        indicators: [{ selector: "#spinner", kind: "spinner", label: "Updating total" }],
      },
    },
  };
}

test("no selector from a realistic page survives into the packet", () => {
  const evidence = sanitizeWebLlmSnapshot(realisticSnapshot(), { maxEvidenceBytes: 12_000 });
  const serialized = JSON.stringify(evidence);

  // The packet is worth reading: it did not pass by describing nothing.
  assert.ok(evidence.elements.length >= 5, `the packet described only ${evidence.elements.length} elements`);
  assert.ok(evidence.dialogs?.length, "the packet dropped the dialogs as well as their selectors");
  assert.ok(evidence.blockedBy, "the packet dropped the overlay as well as its selector");

  for (const selector of SELECTORS) {
    assert.doesNotMatch(serialized, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), selector);
  }
  // And no key by any of the names a locator has ever travelled under.
  assert.doesNotMatch(serialized, /"(?:selector|selectors|xpath|queryPath|css|locator|cssSelector|path)"/u);

  // The guarantee that outlives this file: every key the packet carries,
  // anywhere in it, is one somebody wrote down here. A field added later --
  // whatever it is called, however deeply it is nested -- fails this line
  // rather than quietly shipping whatever it holds to a language model.
  assert.deepEqual([...packetKeys(evidence)].filter((key) => !ALLOWED_PACKET_KEYS.has(key)), []);
});

test("a failure packet, marked and naming its repair parameters, still carries no selector", () => {
  const evidence = sanitizeWebLlmSnapshot(realisticSnapshot(), {
    maxEvidenceBytes: 12_000,
    failedAction: { selector: "#place-order", repairParameters: webFailureRepairParameters({ definitionId: "builtin.policy.action" }) },
  });
  const serialized = JSON.stringify(evidence);
  assert.equal(evidence.failedTarget, "target.1");
  assert.deepEqual(Object.keys(evidence.repairParameters ?? {}), ["element"]);
  for (const selector of SELECTORS) {
    assert.doesNotMatch(serialized, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), selector);
  }
  assert.doesNotMatch(serialized, /"(?:selector|selectors|xpath|queryPath|css|locator|cssSelector|path)"/u);
  assert.deepEqual([...packetKeys(evidence)].filter((key) => !ALLOWED_PACKET_KEYS.has(key)), []);
});

/** Every key name appearing anywhere in the packet, at any depth. */
function packetKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) packetKeys(item, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, item] of Object.entries(value)) {
    found.add(key);
    packetKeys(item, found);
  }
  return found;
}

test("every element is named by an opaque handle, and by nothing else that could address it", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings(realisticSnapshot(), { maxEvidenceBytes: 12_000 });

  for (const element of evidence.elements) {
    assert.match(element.target, /^target\.[1-9][0-9]?$/u, element.target);
    // The exhaustive check: a future field is caught here whatever it is called.
    const unexpected = Object.keys(element).filter((key) => !ALLOWED_ELEMENT_KEYS.has(key));
    assert.deepEqual(unexpected, [], `the packet element gained ${unexpected.join(", ")}`);
  }

  // The selectors still exist -- the domain kept every one of them -- they are
  // simply on the other side of the boundary, keyed by the handle.
  assert.deepEqual([...selectors.keys()], evidence.elements.map((element) => element.target));
  assert.equal(selectors.get("target.1"), "#place-order");
  // A child frame's selector is the one that works inside that frame, and the
  // frame rides on the packet because the selector alone is ambiguous without it.
  assert.equal([...selectors.values()].includes("#card-name"), true);
  assert.equal(evidence.elements.some((element) => element.frameId === 3), true);
  // The sensitive control is not in either half.
  assert.equal([...selectors.values()].includes("#card-number"), false);
});
