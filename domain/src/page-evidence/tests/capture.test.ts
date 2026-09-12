// What the real captures actually contain, stated as a test rather than as a
// claim in a comment.
//
// A shared type stops the producer and its readers spelling a field
// differently. It cannot stop a field being declared, read, and never populated
// by anything -- which is the failure mode that survived every green suite in
// this plan: five packet fields read at paths no producer wrote, and each side's
// own tests written against its own idea of the shape.
//
// `../capture.ts` closes that with data instead of a type: three captures taken
// from the real content-script bundle in a real browser. This file says exactly
// which parts of the contract that data does and does not reach, and both
// halves are load-bearing.
//
//  - `EXERCISED` is what a real page really produces. Each row is a typed
//    accessor, not a path string, so renaming a field in the contract breaks
//    this file at compile time, and a capture regenerated from a producer that
//    stopped emitting the field breaks it at run time.
//  - `NOT_EXERCISED` is the honest limit of the data join. Each row says why no
//    capture can reach it and where the field is covered instead. Without this
//    list a reader would take "the captures are real" to mean "everything here
//    is proven against a browser", and it is not.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES, type WebAutomationPageEvidenceCaptureName } from "../capture";
import type { WebAutomationPageEvidence } from "../types";

type Reach = (evidence: WebAutomationPageEvidence) => unknown;
type Row = { field: string; reach: Reach };

const CAPTURES = Object.entries(WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES) as [WebAutomationPageEvidenceCaptureName, WebAutomationPageEvidence][];

/** Every contract field at least one real capture populates. */
const EXERCISED: Row[] = [
  { field: "elements.scanned", reach: (e) => e.elements.scanned },
  { field: "elements.candidates", reach: (e) => e.elements.candidates },
  { field: "elements.matched", reach: (e) => e.elements.matched },
  { field: "elements.returned", reach: (e) => e.elements.returned },
  { field: "elements.truncated", reach: (e) => e.elements.truncated },
  { field: "elements.changed", reach: (e) => e.elements.changed },
  { field: "elements.recentlyInteracted", reach: (e) => e.elements.recentlyInteracted },

  { field: "loading.documentState", reach: (e) => e.loading.documentState },
  { field: "loading.busy", reach: (e) => e.loading.busy },
  { field: "loading.busyRegions[]", reach: (e) => e.loading.busyRegions[0] },
  { field: "loading.indicators[].selector", reach: (e) => e.loading.indicators[0]?.selector },
  { field: "loading.indicators[].kind", reach: (e) => e.loading.indicators[0]?.kind },
  { field: "loading.indicators[].label", reach: (e) => e.loading.indicators[0]?.label },
  { field: "loading.pendingNavigation", reach: (e) => e.loading.pendingNavigation },

  { field: "navigation.url", reach: (e) => e.navigation.url },
  { field: "navigation.origin", reach: (e) => e.navigation.origin },
  { field: "navigation.path", reach: (e) => e.navigation.path },
  { field: "navigation.type", reach: (e) => e.navigation.type },
  { field: "navigation.historyLength", reach: (e) => e.navigation.historyLength },
  { field: "navigation.visibility", reach: (e) => e.navigation.visibility },

  { field: "dialogs.open[].selector", reach: (e) => e.dialogs?.open[0]?.selector },
  { field: "dialogs.open[].role", reach: (e) => e.dialogs?.open[0]?.role },
  { field: "dialogs.open[].modal", reach: (e) => e.dialogs?.open[0]?.modal },
  { field: "dialogs.open[].native", reach: (e) => e.dialogs?.open[0]?.native },
  { field: "dialogs.open[].label", reach: (e) => e.dialogs?.open[0]?.label },
  { field: "dialogs.open[].bounds", reach: (e) => e.dialogs?.open[0]?.bounds },
  { field: "dialogs.modal", reach: (e) => e.dialogs?.modal },
  { field: "dialogs.lastNative.kind", reach: (e) => e.dialogs?.lastNative?.kind },
  { field: "dialogs.lastNative.message", reach: (e) => e.dialogs?.lastNative?.message },
  { field: "dialogs.lastNative.response", reach: (e) => e.dialogs?.lastNative?.response },
  { field: "dialogs.lastNative.at", reach: (e) => e.dialogs?.lastNative?.at },

  { field: "overlays.tested", reach: (e) => e.overlays?.tested },
  { field: "overlays.blockedCount", reach: (e) => e.overlays?.blockedCount },
  { field: "overlays.blockers[].selector", reach: (e) => e.overlays?.blockers[0]?.selector },
  { field: "overlays.blockers[].bounds", reach: (e) => e.overlays?.blockers[0]?.bounds },
  { field: "overlays.blockers[].blocks", reach: (e) => e.overlays?.blockers[0]?.blocks },
  { field: "overlays.blockers[].blocked[]", reach: (e) => e.overlays?.blockers[0]?.blocked[0] },

  { field: "regions[].role", reach: (e) => e.regions?.[0]?.role },
  { field: "regions[].selector", reach: (e) => e.regions?.[0]?.selector },
  { field: "regions[].bounds", reach: (e) => e.regions?.[0]?.bounds },
  { field: "regions[].label", reach: (e) => e.regions?.find((region) => region.label)?.label },

  { field: "repeating[].containerSelector", reach: (e) => e.repeating?.[0]?.containerSelector },
  { field: "repeating[].signature", reach: (e) => e.repeating?.[0]?.signature },
  { field: "repeating[].itemCount", reach: (e) => e.repeating?.[0]?.itemCount },
  { field: "repeating[].representative.selector", reach: (e) => e.repeating?.[0]?.representative.selector },
  { field: "repeating[].representative.testId", reach: (e) => e.repeating?.[0]?.representative.testId },
  { field: "repeating[].representative.text", reach: (e) => e.repeating?.[0]?.representative.text },
  { field: "repeating[].fields[]", reach: (e) => e.repeating?.[0]?.fields?.[0] },

  { field: "forms[].selector", reach: (e) => e.forms?.[0]?.selector },
  { field: "forms[].controlCount", reach: (e) => e.forms?.[0]?.controlCount },
  { field: "forms[].submit", reach: (e) => e.forms?.[0]?.submit },
  { field: "forms[].controls[].selector", reach: (e) => e.forms?.[0]?.controls[0]?.selector },
  { field: "forms[].controls[].controlType", reach: (e) => e.forms?.[0]?.controls[0]?.controlType },
  { field: "forms[].controls[].name", reach: (e) => e.forms?.[0]?.controls[0]?.name },
  { field: "forms[].controls[].label", reach: (e) => e.forms?.[0]?.controls[0]?.label },
  { field: "forms[].controls[].required", reach: (e) => e.forms?.[0]?.controls.find((control) => control.required)?.required },
  { field: "forms[].controls[].hasValue", reach: (e) => e.forms?.[0]?.controls[0]?.hasValue },
  { field: "forms[].controls[].autocomplete", reach: (e) => e.forms?.[0]?.controls.find((control) => control.autocomplete)?.autocomplete },
  { field: "forms[].controls[].sensitive", reach: (e) => e.forms?.[0]?.controls.find((control) => control.sensitive)?.sensitive }
];

/**
 * Every contract field no capture reaches, and the reason. A row moves up to
 * `EXERCISED` the day a capture starts carrying it, and the day it does, the
 * reason below was wrong and should be deleted rather than reworded.
 */
const NOT_EXERCISED: (Row & { why: string })[] = [
  { field: "navigation.referrer", reach: (e) => e.navigation.referrer, why: "the harness opens each fixture directly, so there is no referring page. The packet's origin-and-path reduction of it is covered in llm-evidence/tests/page-evidence.test.ts." },
  { field: "navigation.redirects", reach: (e) => e.navigation.redirects, why: "no Lab fixture redirects. The producer omits the field at zero." },
  { field: "dialogs.armPending", reach: (e) => e.dialogs?.armPending, why: "true only between writing an arming and the page-world override taking it, which happens on the dispatching call stack. It is observable only where the override is absent." },
  { field: "overlays.blockers[].role", reach: (e) => e.overlays?.blockers[0]?.role, why: "modal-flows' backdrop is a plain div with neither a role nor a name; the field is optional for exactly that case." },
  { field: "overlays.blockers[].label", reach: (e) => e.overlays?.blockers[0]?.label, why: "same blocker, same reason." },
  { field: "forms[].name", reach: (e) => e.forms?.[0]?.name, why: "neither fixture form carries a name attribute." },
  { field: "forms[].label", reach: (e) => e.forms?.[0]?.label, why: "neither fixture form carries an accessible name. intermediate-state's does, and e2e/content/tests/evidence.spec.ts asserts it there." },
  { field: "forms[].action", reach: (e) => e.forms?.[0]?.action, why: "neither fixture form posts anywhere." },
  { field: "forms[].method", reach: (e) => e.forms?.[0]?.method, why: "same." },
  { field: "forms[].controls[].disabled", reach: (e) => e.forms?.[0]?.controls.find((control) => control.disabled)?.disabled, why: "no fixture form disables a control." }
];

/**
 * Every item the contract declares, and whether a real page is expected to
 * carry one. Add an item to `WebAutomationPageEvidence` and this stops
 * compiling until it is listed, which is the ratchet: the rows above are a
 * hand-kept list and a new item could otherwise join the contract with no
 * capture, no reader and nobody the wiser.
 *
 * It ratchets items, not fields. A new *field* inside an existing item still
 * needs a row in `EXERCISED` or `NOT_EXERCISED` by hand; nothing in TypeScript
 * can enumerate a nested optional key at run time.
 */
const ITEMS: Record<keyof WebAutomationPageEvidence, "always" | "when the page has one"> = {
  elements: "always",
  loading: "always",
  navigation: "always",
  dialogs: "when the page has one",
  overlays: "when the page has one",
  regions: "when the page has one",
  repeating: "when the page has one",
  forms: "when the page has one"
};

function reachesInAnyCapture(reach: Reach): boolean {
  return CAPTURES.some(([, evidence]) => reach(evidence) !== undefined);
}

test("every item the contract declares is carried by a real capture, and the three unconditional ones by all of them", () => {
  for (const [item, when] of Object.entries(ITEMS) as [keyof WebAutomationPageEvidence, string][]) {
    const carrying = CAPTURES.filter(([, evidence]) => evidence[item] !== undefined).map(([name]) => name);
    assert.notDeepEqual(carrying, [], `no capture carries \`${item}\`, so nothing proves the producer writes it`);
    if (when === "always") {
      assert.equal(carrying.length, CAPTURES.length, `\`${item}\` is not optional, so every capture should carry it`);
    }
  }
});

test("every capture is a real one: three of them, each from a named Scenario Lab fixture", () => {
  assert.deepEqual(CAPTURES.map(([name]) => name), ["modal-flows", "infinite-feed", "sensitive-input"]);
  for (const [name, evidence] of CAPTURES) {
    // The three fields the producer always writes, so a capture that lost its
    // spine is caught before any row below reads past it.
    assert.equal(typeof evidence.elements.scanned, "number", name);
    assert.ok(evidence.loading.documentState, name);
    assert.ok(evidence.navigation.url.startsWith("http://127.0.0.1:4173/scenarios/"), `${name}: the Lab's per-run port should have been rewritten to 4173`);
  }
});

test("the captures between them populate every contract field the data join claims to cover", () => {
  const missing = EXERCISED.filter((row) => !reachesInAnyCapture(row.reach)).map((row) => row.field);
  assert.deepEqual(missing, [], "these fields are declared and read but no real capture carries one, so nothing proves a producer writes them");
});

test("the fields no capture reaches are the ones written down, and no others", () => {
  const nowReached = NOT_EXERCISED.filter((row) => reachesInAnyCapture(row.reach)).map((row) => row.field);
  assert.deepEqual(nowReached, [], "a capture now carries these, so move the row into EXERCISED and delete its excuse");
});

// The producer withholds a sensitive control's value and reports only that the
// control exists. If a regenerated capture ever carried one, this file would be
// the thing that committed it to the repository.
test("no capture carries a form control's value, only whether it holds one", () => {
  for (const [name, evidence] of CAPTURES) {
    for (const form of evidence.forms ?? []) {
      for (const control of form.controls) {
        assert.equal("value" in control, false, `${name}: ${control.selector} carries a value`);
      }
    }
  }
  const sensitive = CAPTURES.flatMap(([, evidence]) => evidence.forms ?? [])
    .flatMap((form) => form.controls)
    .filter((control) => control.sensitive);
  assert.ok(sensitive.length >= 2, "sensitive-input's password and card fields should both be marked");
});
