// src/recording/web-state/element/tests/selection.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/recording/web-state/geometry.ts
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
}
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}

// src/recording/web-state/element/identity.ts
var MAX_STATE_ID_LENGTH = 120;
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function elementStateIdAssigner(reservedIds = []) {
  const taken = new Set(reservedIds);
  const occurrences = /* @__PURE__ */ new Map();
  return (element) => {
    const base = elementStateId(element);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = occurrence === 1 ? base : `${base}.${occurrence}`;
    while (taken.has(candidate)) {
      occurrence += 1;
      candidate = `${base}.${occurrence}`;
    }
    occurrences.set(base, occurrence);
    taken.add(candidate);
    return candidate;
  };
}
function stableElementPathId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, MAX_STATE_ID_LENGTH) || "element";
}

// src/recording/web-state/element/kind.ts
function isLikelyActionableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "select" || tagName === "textarea" || tagName === "summary" || tagName === "label" || tagName === "input" && inputType !== "hidden" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || element.hasClickHandler === true || element.attributes?.onclick !== void 0;
}
function isLikelyInteractableElement(element) {
  return isLikelyActionableElement(element) || element.attributes?.tabindex !== void 0 || element.attributes?.["aria-expanded"] !== void 0 || element.attributes?.["aria-controls"] !== void 0 || element.attributes?.["aria-pressed"] !== void 0 || element.attributes?.["aria-selected"] !== void 0;
}
function isPrimaryControlElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "summary" || role === "button" || role === "link" || role === "menuitem" || role === "tab";
}
function isSemanticTextElement(element) {
  const tagName = element.tagName.toLowerCase();
  return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "dt" || tagName === "dd" || tagName === "figcaption" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
}

// src/recording/web-state/element/selection.ts
var MAX_STATE_ELEMENTS = 1500;
var WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS = ["count", "captured", "truncated"];
function shouldCaptureElementState(element) {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element) || meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href)
  );
}
function filterStateElements(elements, limit = MAX_STATE_ELEMENTS) {
  const eligible = elements.map((element, documentIndex) => ({ element, documentIndex })).filter((entry) => shouldCaptureElementState(entry.element));
  const ranked = [...eligible].sort(
    (left, right) => stateElementBucket(left.element) - stateElementBucket(right.element) || stateElementScore(right.element) - stateElementScore(left.element)
  );
  const kept = ranked.slice(0, Math.max(0, limit)).map((entry, rank) => ({ ...entry, rank }));
  kept.sort((left, right) => left.documentIndex - right.documentIndex);
  const assignStateId = elementStateIdAssigner(WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS);
  const named = kept.map((entry) => ({ element: entry.element, stateId: assignStateId(entry.element), rank: entry.rank }));
  named.sort((left, right) => left.rank - right.rank);
  return {
    elements: named.map(({ element, stateId }) => ({ element, stateId })),
    total: elements.length,
    eligible: eligible.length,
    captured: named.length,
    truncated: eligible.length > named.length
  };
}
function stateElementBucket(element) {
  if (isPrimaryControlElement(element) && hasMeaningfulElementIdentity(element)) return 0;
  if (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) return 1;
  if (isSemanticTextElement(element) && hasTextualElementIdentity(element)) return 2;
  if (hasTextualElementIdentity(element)) return 3;
  if (meaningfulText(element.href)) return 4;
  return 5;
}
function stateElementScore(element) {
  let score = 0;
  if (isLikelyInteractableElement(element)) score += 200;
  if (isLikelyActionableElement(element)) score += 100;
  if (hasStableElementIdentity(element)) score += 60;
  if (meaningfulText(element.name)) score += 45;
  if (meaningfulText(element.value)) score += 35;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText)) score += 25;
  const bounds = element.documentBounds ?? element.bounds;
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}
function hasMeaningfulElementIdentity(element) {
  return hasStableElementIdentity(element) || hasTextualElementIdentity(element) || meaningfulText(element.href);
}
function hasTextualElementIdentity(element) {
  return meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value);
}
function hasStableElementIdentity(element) {
  return Boolean(
    stableAttribute(element, "data-testid") || stableAttribute(element, "data-test") || stableAttribute(element, "data-cy") || stableAttribute(element, "aria-label") || stableAttribute(element, "name") || stableAttribute(element, "id")
  );
}
function hasElementBounds(element) {
  return stateBounds(element.documentBounds ?? element.bounds) !== void 0;
}

// src/recording/web-state/element/tests/selection.test.ts
var page = [
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
];
test("an element with no bounds is not captured, whatever else it has", () => {
  assert.equal(shouldCaptureElementState({ tagName: "button", selector: "button.icon", text: "Save" }), false);
  assert.equal(shouldCaptureElementState({ tagName: "div", selector: "div.empty", bounds: { x: 0, y: 0, width: 10, height: 10 } }), false);
});
test("capture-worthy elements come back most relevant first", () => {
  const selection = filterStateElements(page);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["button.save", "a.home", "input[name=search]"]);
});
test("primary controls outrank content, and off-screen content still qualifies", () => {
  const selection = filterStateElements([
    { tagName: "section", selector: "section.hero", attributes: { id: "hero" }, bounds: { x: 0, y: 0, width: 800, height: 300 } },
    { tagName: "p", selector: "p.summary", text: "Account summary", bounds: { x: 20, y: 120, width: 220, height: 24 } },
    { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false },
    { tagName: "button", selector: "button.deposit", text: "Deposit", bounds: { x: 20, y: 40, width: 90, height: 36 } },
    { tagName: "div", selector: "div.empty", bounds: { x: 20, y: 180, width: 100, height: 20 } }
  ]);
  const selectors = selection.elements.map((entry) => entry.element.selector);
  assert.equal(selectors[0], "button.deposit");
  assert.equal(selectors.includes("p.summary"), true);
  assert.equal(selectors.includes("p.disclaimer"), true);
  assert.equal(selectors.includes("div.empty"), false);
});
test("a page of noise does not push the elements that carry meaning out", () => {
  const noise = Array.from({ length: 1600 }, (_, index) => ({
    tagName: "div",
    selector: `div.wrapper-${index}`,
    text: `Wrapper ${index}`,
    bounds: { x: 0, y: index * 20, width: 800, height: 18 }
  }));
  const selection = filterStateElements([
    ...noise,
    { tagName: "a", selector: "a.billing", href: "https://example.test/billing", text: "Billing", bounds: { x: 20, y: 20, width: 80, height: 24 } },
    { tagName: "p", selector: "p.balance", text: "Available balance", bounds: { x: 20, y: 60, width: 160, height: 24 } },
    { tagName: "h2", selector: "h2.accounts", text: "Accounts", bounds: { x: 20, y: 100, width: 140, height: 32 } }
  ]);
  const selectors = new Set(selection.elements.map((entry) => entry.element.selector));
  assert.equal(selectors.has("a.billing"), true);
  assert.equal(selectors.has("p.balance"), true);
  assert.equal(selectors.has("h2.accounts"), true);
});
test("the selection reports the page's total, not just what it kept", () => {
  const selection = filterStateElements(page);
  assert.equal(selection.total, 4, "every element the page offered");
  assert.equal(selection.eligible, 3);
  assert.equal(selection.captured, 3);
  assert.equal(selection.elements.length, selection.captured);
  assert.equal(selection.truncated, false, "the one dropped element carried no evidence; nothing was cut for size");
});
test("truncated is set only when the cap dropped elements worth capturing", () => {
  const selection = filterStateElements(page, 2);
  assert.equal(selection.total, 4);
  assert.equal(selection.eligible, 3);
  assert.equal(selection.captured, 2);
  assert.equal(selection.truncated, true);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["button.save", "a.home"]);
});
test("controls sharing a data-testid are all captured, each under its own key", () => {
  const selection = filterStateElements([
    { tagName: "button", selector: "tr:nth-child(1) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 10, width: 60, height: 24 } },
    { tagName: "button", selector: "tr:nth-child(2) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 40, width: 60, height: 24 } },
    { tagName: "button", selector: "tr:nth-child(3) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 70, width: 60, height: 24 } }
  ]);
  assert.equal(selection.captured, 3, "collapsing these by state key lost every row but the first");
  assert.deepEqual(selection.elements.map((entry) => entry.stateId).sort(), ["row.action", "row.action.2", "row.action.3"]);
  assert.equal(selection.truncated, false);
});
test("the positional suffix follows document order, not relevance order", () => {
  const selection = filterStateElements([
    { tagName: "a", selector: "a.first", href: "https://example.test/1", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 10, width: 60, height: 24 } },
    { tagName: "a", selector: "a.second", href: "https://example.test/2", text: "Open the account", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 40, width: 60, height: 24 } }
  ]);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["a.second", "a.first"], "the one with text ranks higher");
  const keyBySelector = new Map(selection.elements.map((entry) => [entry.element.selector, entry.stateId]));
  assert.equal(keyBySelector.get("a.first"), "row.action", "first in the document keeps the bare key");
  assert.equal(keyBySelector.get("a.second"), "row.action.2", "a key that moved with the score would rename it on every snapshot");
});
