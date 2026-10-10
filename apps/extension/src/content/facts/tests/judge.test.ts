// Coverage of judge.ts: for every fact kind, a claim the page shows to be
// true, one it shows to be false, and one it cannot answer -- over a scripted
// page, so each rule is proven without a browser. The live reads behind the
// page are proven on a realistic scenario by the content harness
// (`e2e/content/tests/facts/tests/deal-wheel-facts.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationFactQuery } from "@fluxiq-web-extension/domain/client";
import type { FactDialog, FactElement, FactPage, FactReading, FactResolution } from "../fact-page";
import { judgeFact } from "../judge";

const AT = 1_760_000_000_000;

type Scripted = {
  url?: string;
  resolution?: FactResolution;
  count?: number;
  visible?: boolean;
  enabled?: boolean;
  text?: FactReading;
  pageText?: FactReading;
  values?: ReturnType<FactPage["values"]>;
  checked?: ReturnType<FactPage["checked"]>;
  selected?: ReturnType<FactPage["selected"]>;
  dialogs?: FactDialog[];
};

const ELEMENT: FactElement = { element: "button#continue" };
const FOUND: FactResolution = { outcome: "found", element: ELEMENT };

function page(script: Scripted): FactPage {
  return {
    document: () => ({ url: script.url ?? "https://shop.test/s?k=earbuds", readyState: "complete" }),
    resolve: () => script.resolution ?? FOUND,
    count: () => script.count ?? 0,
    visible: () => script.visible ?? true,
    enabled: () => script.enabled ?? true,
    text: (element) => (element ? script.text : script.pageText) ?? { read: "" },
    values: () => script.values ?? { withheld: "no_state" },
    checked: () => script.checked,
    selected: () => script.selected,
    describe: () => ({ tagName: "button", accessibleName: "Continue" }),
    dialogs: () => script.dialogs ?? []
  };
}

function judged(query: WebAutomationFactQuery, script: Scripted, readyState: "loading" | "interactive" | "complete" = "complete") {
  return judgeFact(query, page(script), AT, readyState);
}

function results(query: WebAutomationFactQuery, scripts: Scripted[]): string[] {
  return scripts.map((script) => judged(query, script).result);
}

const TARGET = { selector: "#continue" };

test("exists: found is true, nothing found is false, absent is the same claim turned round", () => {
  assert.deepEqual(results({ kind: "exists", target: TARGET, expected: true }, [{}, { resolution: { outcome: "not_found" } }, { resolution: { outcome: "ambiguous" } }]), ["true", "false", "true"]);
  assert.deepEqual(results({ kind: "exists", target: TARGET, expected: false }, [{}, { resolution: { outcome: "not_found" } }]), ["false", "true"]);
  assert.deepEqual(judged({ kind: "exists", target: TARGET, expected: true }, {}).evidence?.element, { tagName: "button", accessibleName: "Continue" });
});

test("visible: shown, hidden, and gone -- and a thing gone is not visible", () => {
  const query: WebAutomationFactQuery = { kind: "visible", target: TARGET, expected: true };
  assert.deepEqual(results(query, [{ visible: true }, { visible: false }, { resolution: { outcome: "not_found" } }]), ["true", "false", "false"]);
  assert.equal(judged({ ...query, expected: false }, { resolution: { outcome: "not_found" } }).result, "true");
  const tie = judged(query, { resolution: { outcome: "ambiguous" } });
  assert.deepEqual([tie.result, tie.evidence?.reason], ["unknown", "ambiguous"]);
});

test("enabled: its state, and false for an element that is not there", () => {
  const query: WebAutomationFactQuery = { kind: "enabled", target: TARGET, expected: true };
  assert.deepEqual(results(query, [{ enabled: true }, { enabled: false }, { resolution: { outcome: "not_found" } }, { resolution: { outcome: "ambiguous" } }]), ["true", "false", "false", "unknown"]);
});

test("checked: its state; a control that shows none, or a sensitive one, is unknown", () => {
  const query: WebAutomationFactQuery = { kind: "checked", target: TARGET, expected: true };
  assert.deepEqual(results(query, [{ checked: true }, { checked: false }, { checked: undefined }, { checked: "sensitive" }]), ["true", "false", "unknown", "unknown"]);
  assert.equal(judged(query, { checked: "sensitive" }).evidence?.reason, "sensitive");
  assert.equal(judged(query, {}).evidence?.reason, "no_state");
});

test("selected: its state, or unknown when it shows none", () => {
  const query: WebAutomationFactQuery = { kind: "selected", target: TARGET, expected: false };
  assert.deepEqual(results(query, [{ selected: false }, { selected: true }, { selected: undefined }]), ["true", "false", "unknown"]);
});

test("text: an element's text or the page's, compared three ways, and a sensitive control unknown", () => {
  assert.deepEqual(results({ kind: "text", target: TARGET, comparison: "contains", expected: "In  stock" }, [
    { text: { read: "Only 3 left. In stock now." } },
    { text: { read: "Sold out" } },
    { text: { withheld: "sensitive" } }
  ]), ["true", "false", "unknown"]);
  assert.deepEqual(results({ kind: "text", comparison: "equals", expected: "Your basket is empty" }, [{ pageText: { read: " Your basket\n is empty " } }, { pageText: { read: "1 item" } }]), ["true", "false"]);
  assert.deepEqual(results({ kind: "text", comparison: "matches", expected: "\\d+ results" }, [{ pageText: { read: "Showing 24 results" } }, { pageText: { read: "No results" } }]), ["true", "false"]);
  const evidence = judged({ kind: "text", target: TARGET, comparison: "contains", expected: "In stock" }, { text: { read: "Only 3 left. In stock now." } }).evidence;
  assert.equal(evidence?.excerpt, "Only 3 left. In stock now.");
});

test("url: the address compared, and no excerpt quoted from it here", () => {
  const query: WebAutomationFactQuery = { kind: "url", comparison: "contains", expected: "/cart" };
  assert.deepEqual(results(query, [{ url: "https://shop.test/cart?step=2" }, { url: "https://shop.test/s?k=earbuds" }]), ["true", "false"]);
  assert.equal(judged(query, { url: "https://shop.test/cart" }).evidence, undefined);
});

test("value: a field's value or a choice's label; a sensitive field, or an element holding none, unknown", () => {
  const query: WebAutomationFactQuery = { kind: "value", target: TARGET, comparison: "equals", expected: "Large" };
  assert.deepEqual(results(query, [
    { values: { read: ["L", "Large"] } },
    { values: { read: ["M", "Medium"] } },
    { values: { withheld: "sensitive" } },
    { values: { withheld: "no_state" } },
    { resolution: { outcome: "not_found" } }
  ]), ["true", "false", "unknown", "unknown", "false"]);
  // A sensitive field quotes nothing.
  assert.equal(judged(query, { values: { withheld: "sensitive" } }).evidence?.excerpt, undefined);
});

test("count: compared with the expected number, and the count is the evidence", () => {
  const query: WebAutomationFactQuery = { kind: "count", target: TARGET, comparison: ">=", expected: 3 };
  assert.deepEqual(results(query, [{ count: 3 }, { count: 2 }]), ["true", "false"]);
  assert.equal(judged(query, { count: 7 }).evidence?.count, 7);
  assert.deepEqual(results({ kind: "count", target: TARGET, comparison: "=", expected: 0 }, [{ count: 0 }, { count: 1 }]), ["true", "false"]);
});

test("dialog: any open dialog, by name, by kind -- and an unclassified one leaves a kind claim unknown", () => {
  const wheel: FactDialog = { name: "Spin to win up to 20% off!" };
  const consent: FactDialog = { kind: "consent", name: "We use cookies" };
  assert.deepEqual(results({ kind: "dialog", expected: true }, [{ dialogs: [wheel] }, { dialogs: [] }]), ["true", "false"]);
  assert.deepEqual(results({ kind: "dialog", expected: true, nameContains: "spin to WIN" }, [{ dialogs: [consent, wheel] }, { dialogs: [consent] }, { dialogs: [{}] }]), ["true", "false", "unknown"]);
  assert.deepEqual(results({ kind: "dialog", expected: true, dialogKind: "promotion" }, [{ dialogs: [{ kind: "promotion" }] }, { dialogs: [consent] }, { dialogs: [wheel] }]), ["true", "false", "unknown"]);
  assert.deepEqual(results({ kind: "dialog", expected: false, dialogKind: "consent" }, [{ dialogs: [] }, { dialogs: [consent] }, { dialogs: [wheel] }]), ["true", "false", "unknown"]);
  const evidence = judged({ kind: "dialog", expected: true, dialogKind: "consent" }, { dialogs: [consent] }).evidence;
  assert.deepEqual(evidence, { count: 1, dialogKind: "consent", excerpt: "We use cookies" });
  assert.equal(judged({ kind: "dialog", expected: true, dialogKind: "promotion" }, { dialogs: [wheel] }).evidence?.reason, "unclassified_dialog");
});

test("a document still being parsed turns every false into unknown, but never a true, and never the address", () => {
  const absent: WebAutomationFactQuery = { kind: "exists", target: TARGET, expected: true };
  const loading = judged(absent, { resolution: { outcome: "not_found" } }, "loading");
  assert.deepEqual([loading.result, loading.evidence?.reason], ["unknown", "loading"]);
  assert.equal(judged(absent, {}, "loading").result, "true");
  assert.equal(judged({ kind: "dialog", expected: true }, { dialogs: [] }, "loading").result, "unknown");
  assert.equal(judged({ kind: "url", comparison: "contains", expected: "/cart" }, {}, "loading").result, "false");
  assert.equal(judged(absent, { resolution: { outcome: "not_found" } }, "interactive").result, "false");
});

test("every answer carries when it was read", () => {
  assert.equal(judged({ kind: "url", comparison: "contains", expected: "/" }, {}).capturedAt, AT);
});
