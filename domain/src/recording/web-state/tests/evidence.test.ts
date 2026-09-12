// The page evidence, projected into web state.
//
// Three properties are pinned here because each of them failing is silent.
// The paths, because a consumer addresses state by path and a rename is
// invisible to the compiler. The bounds, because state is built on every
// recorded event and an unbounded collection only hurts in production. And the
// withholding, because the projection is the far side of a wire from the
// extension's guard and web state is persisted and replayed -- this plan has
// already had four redaction leaks, and an evidence path is exactly how a
// fifth would arrive.
//
// Every value below is a synthetic string named for its field. Nothing here
// resembles a real secret.

import assert from "node:assert/strict";
import test from "node:test";
import { validateStateSnapshot } from "fluxiq/automation-studio";
import type { StateSnapshot, StateValue } from "fluxiq/automation-studio";
import { createWebAutomationStateFromSnapshot } from "../snapshot";

/** A value a producer was supposed to have withheld. Every leak row plants one. */
const LEAKED = "synthetic-value-the-producer-should-have-withheld";

const evidence = {
  elements: { scanned: 420, candidates: 120, matched: 40, returned: 12, truncated: true, changed: 3, recentlyInteracted: 1 },
  loading: {
    documentState: "interactive",
    busy: true,
    busyRegions: ["#cart"],
    indicators: [{ selector: "#spinner", kind: "spinner", label: "Loading more" }],
    pendingNavigation: true
  },
  navigation: {
    url: "https://example.test/checkout",
    origin: "https://example.test",
    path: "/checkout",
    referrer: "https://example.test/cart",
    type: "navigate",
    redirects: 1,
    historyLength: 4,
    visibility: "visible"
  },
  dialogs: {
    open: [{ selector: "#terms", role: "dialog", modal: true, native: false, label: "Terms", bounds: { x: 10, y: 20, width: 300, height: 200 } }],
    modal: true,
    armPending: true,
    lastNative: { kind: "confirm", message: "Leave this page?", response: "dismiss", at: 1_700, promptText: LEAKED }
  },
  overlays: {
    tested: 24,
    blockedCount: 2,
    blockers: [{ selector: "#consent", role: "region", label: "Cookies", bounds: { x: 0, y: 0, width: 1280, height: 90 }, blocks: 2, blocked: ["button.pay", "a.help"] }]
  },
  regions: [{ role: "main", label: "Checkout", selector: "main", bounds: { x: 0, y: 90, width: 1280, height: 600 } }],
  repeating: [{
    containerSelector: "ul.items",
    signature: "li[data-testid=item-#]",
    itemCount: 12,
    representative: { selector: "ul.items > li:nth-child(1)", testId: "item-1", text: "Widget" },
    fields: ["price", "qty"]
  }],
  forms: [{
    selector: "form#pay",
    name: "pay",
    label: "Payment",
    action: "/pay",
    method: "post",
    controlCount: 3,
    controls: [
      { selector: "#email", controlType: "email", name: "email", label: "Email", required: true, hasValue: true },
      { selector: "#card", controlType: "password", name: "card", label: "Card number", required: true, hasValue: true, sensitive: true, value: LEAKED },
      { selector: "#cvc", controlType: "text", name: "cvc", label: "Security code", hasValue: true, sensitive: true }
    ],
    submit: "button.pay"
  }]
};

type Collection = { count: number; truncated: boolean; items: Record<string, unknown>[] };

function stateFor(pageEvidence: unknown, elements: unknown[] = [{ tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 400, width: 120, height: 40 } }]): StateSnapshot {
  return createWebAutomationStateFromSnapshot({
    url: "https://example.test/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: elements,
    ...(pageEvidence === undefined ? {} : { evidence: pageEvidence })
  } as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0], { timestamp: 40, sourceId: "tab:9" });
}

function valuesOf(state: StateSnapshot): Record<string, StateValue> {
  return state.namespaces.web?.values ?? {};
}

function collectionAt(state: StateSnapshot, path: string): Collection {
  return valuesOf(state)[path]?.value as unknown as Collection;
}

test("every evidence path mirrors the evidence's own field path, under one prefix", () => {
  const values = valuesOf(stateFor(evidence));
  assert.equal(values["evidence.elements.scanned"]?.value, 420);
  assert.equal(values["evidence.elements.candidates"]?.value, 120);
  assert.equal(values["evidence.elements.matched"]?.value, 40);
  assert.equal(values["evidence.elements.returned"]?.value, 12);
  assert.equal(values["evidence.elements.changed"]?.value, 3);
  assert.equal(values["evidence.elements.recentlyInteracted"]?.value, 1);
  assert.equal(values["evidence.loading.documentState"]?.value, "interactive");
  assert.equal(values["evidence.loading.busy"]?.value, true);
  assert.equal(values["evidence.loading.pendingNavigation"]?.value, true);
  assert.equal(values["evidence.navigation.origin"]?.value, "https://example.test");
  assert.equal(values["evidence.navigation.path"]?.value, "/checkout");
  assert.equal(values["evidence.navigation.referrer"]?.value, "https://example.test/cart");
  assert.equal(values["evidence.navigation.type"]?.value, "navigate");
  assert.equal(values["evidence.navigation.redirects"]?.value, 1);
  assert.equal(values["evidence.navigation.historyLength"]?.value, 4);
  assert.equal(values["evidence.navigation.visibility"]?.value, "visible");
  assert.equal(values["evidence.dialogs.openCount"]?.value, 1);
  assert.equal(values["evidence.dialogs.modal"]?.value, true);
  assert.equal(values["evidence.dialogs.armPending"]?.value, true);
  assert.equal(values["evidence.overlays.tested"]?.value, 24);
  assert.equal(values["evidence.overlays.blockedCount"]?.value, 2);
  // `navigation.url` is deliberately not projected: `page.url` already is it.
  assert.equal(values["evidence.navigation.url"], undefined);
  assert.equal(values["page.url"]?.value, "https://example.test/checkout");
  assert.equal(validateStateSnapshot(stateFor(evidence)).ok, true);
});

test("nothing the evidence writes lands in the element namespace, whose keys a page can claim", () => {
  const paths = Object.keys(valuesOf(stateFor(evidence)));
  const summary = new Set(["elements.count", "elements.captured", "elements.truncated"]);
  const strays = paths.filter((path) => path.startsWith("elements.") && !summary.has(path) && !path.startsWith("elements.button"));
  assert.deepEqual(strays, [], "an element identified as 'scanned' would otherwise overwrite a count");
});

test("a collection is one value carrying the pre-cap total, whether the cap bit, and what survived", () => {
  const state = stateFor(evidence);
  const forms = collectionAt(state, "evidence.forms");
  assert.equal(forms.count, 1);
  assert.equal(forms.truncated, false);
  assert.equal(forms.items[0]?.selector, "form#pay");
  assert.equal(forms.items[0]?.controlCount, 3, "the producer's own pre-cap control total is kept beside the controls");
  assert.equal(collectionAt(state, "evidence.regions").items[0]?.role, "main");
  assert.equal(collectionAt(state, "evidence.repeating").items[0]?.itemCount, 12);
  assert.equal(collectionAt(state, "evidence.dialogs.open").items[0]?.label, "Terms");
  assert.equal(collectionAt(state, "evidence.overlays.blockers").items[0]?.blocks, 2);
  assert.equal(collectionAt(state, "evidence.loading.indicators").items[0]?.kind, "spinner");
  assert.deepEqual(collectionAt(state, "evidence.loading.busyRegions").items, [{ selector: "#cart" }]);
  assert.equal(valuesOf(state)["evidence.forms"]?.comparable, false, "two captures of one page differ in every rect");
});

test("an empty collection is not written at all", () => {
  const values = valuesOf(stateFor({ ...evidence, regions: [], repeating: [], forms: [] }));
  assert.equal(values["evidence.regions"], undefined);
  assert.equal(values["evidence.repeating"], undefined);
  assert.equal(values["evidence.forms"], undefined);
  assert.equal(values["evidence.loading.busy"]?.value, true, "the scalars are still written");
});

test("a collection past the cap is trimmed deterministically and says so", () => {
  const many = Array.from({ length: 30 }, (_, index) => ({ role: "region", label: `Region ${index}`, selector: `#r${index}` }));
  const first = collectionAt(stateFor({ ...evidence, regions: many }), "evidence.regions");
  const second = collectionAt(stateFor({ ...evidence, regions: many }), "evidence.regions");
  assert.equal(first.count, 30, "the pre-cap total survives, so a reader can see the list is a selection");
  assert.equal(first.truncated, true);
  assert.equal(first.items.length, 20);
  assert.equal(first.items[0]?.selector, "#r0");
  assert.equal(first.items[19]?.selector, "#r19");
  assert.deepEqual(second, first, "the same snapshot trims the same way twice");
});

test("a sensitive control keeps its identity and loses even the presence of its value", () => {
  const controls = collectionAt(stateFor(evidence), "evidence.forms").items[0]?.controls as Record<string, unknown>[];
  const card = controls.find((control) => control.selector === "#card");
  assert.equal(card?.label, "Card number", "a reader still has to know the field is there and what it asks for");
  assert.equal(card?.required, true);
  assert.equal(card?.sensitive, true);
  assert.equal(card?.hasValue, undefined, "presence is the only field here derived from a secret, so it is withheld");
  const email = controls.find((control) => control.selector === "#email");
  assert.equal(email?.hasValue, true, "an ordinary control still reports whether it is filled in");
  assert.equal(email?.sensitive, undefined);
});

test("the sensitivity rule is asked again here, so a password control is protected without the producer's flag", () => {
  const unflagged = {
    ...evidence,
    forms: [{
      selector: "form#pay",
      controlCount: 1,
      controls: [{ selector: "#card", controlType: "password", label: "Card number", hasValue: true }]
    }]
  };
  const card = (collectionAt(stateFor(unflagged), "evidence.forms").items[0]?.controls as Record<string, unknown>[])[0];
  assert.equal(card?.sensitive, true, "the shared rule reads the control type, not the producer's word for it");
  assert.equal(card?.hasValue, undefined);
});

test("no field the evidence shape does not declare reaches state, however it arrives", () => {
  const serialized = JSON.stringify(stateFor(evidence));
  assert.equal(serialized.includes(LEAKED), false, "a control's value and a prompt's text are both planted in the fixture");
  const native = valuesOf(stateFor(evidence))["evidence.dialogs.lastNative"]?.value as Record<string, unknown>;
  assert.equal(native.message, "Leave this page?", "the dialog's own message is page-authored text and is kept");
  assert.equal(native.promptText, undefined, "what a person typed into a prompt is not");
});

test("the element list is short of the page when the browser's cap cut, not only the projection's", () => {
  const values = valuesOf(stateFor(evidence));
  assert.equal(values["elements.captured"]?.value, 1, "the projection's own filter kept everything it was given");
  assert.equal(values["elements.truncated"]?.value, true, "but the browser had already dropped elements before sending");
  assert.equal(values["evidence.elements.truncated"]?.value, true, "and which stage cut is still readable");
  const whole = valuesOf(stateFor({ ...evidence, elements: { ...evidence.elements, truncated: false } }));
  assert.equal(whole["elements.truncated"]?.value, false);
});

test("a snapshot with no evidence is projected exactly as it was before evidence existed", () => {
  const values = valuesOf(stateFor(undefined));
  assert.deepEqual(Object.keys(values).filter((path) => path.startsWith("evidence.")), []);
  assert.equal(values["page.url"]?.value, "https://example.test/checkout");
  assert.equal(values["elements.truncated"]?.value, false);
});

test("evidence that arrives malformed is skipped rather than thrown or written", () => {
  for (const malformed of [null, 42, "evidence", [], { elements: "many", loading: null, regions: "none", forms: 7 }]) {
    const state = stateFor(malformed);
    assert.equal(validateStateSnapshot(state).ok, true);
    const paths = Object.keys(valuesOf(state)).filter((path) => path.startsWith("evidence."));
    assert.deepEqual(paths, [], `malformed evidence wrote ${paths.join(", ")}`);
  }
  const partial = stateFor({ loading: { documentState: "complete", busy: false }, regions: [{ role: "main", selector: "main" }, 7] });
  const values = valuesOf(partial);
  assert.equal(values["evidence.loading.documentState"]?.value, "complete");
  assert.equal(values["evidence.loading.pendingNavigation"], undefined, "a field the page did not offer is absent, not guessed");
  assert.deepEqual(collectionAt(partial, "evidence.regions").items, [{ role: "main", selector: "main" }, {}]);
});
