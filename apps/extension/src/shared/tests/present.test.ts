// The producer half of the page-evidence contract: what `present` guarantees,
// and the proof that it changed no byte of what the wire carries.
//
// Two things are under test and they are of different kinds.
//
// The **runtime** rows are ordinary assertions: an optional field whose value is
// `undefined` must be absent from the object rather than present-and-undefined,
// `false` and `0` and `""` must survive, and the JSON must be identical to what
// the conditional spreads this replaced produced. That last row is the one that
// makes the change safe to land: it builds the same value both ways and compares
// them, so "no behaviour change" is measured rather than asserted.
//
// The **compile-time** rows are `@ts-expect-error` directives, and they are the
// point of the whole exercise. A worker proving once that a rename fails to
// compile proves it for that afternoon; `check` fails if any of these stops
// being an error, so the guarantee is re-proved on every build. If TypeScript's
// excess-property rules change, or `present`'s signature is loosened, or someone
// "simplifies" `EvidenceFields<T>` back to `Partial<T>`, the unused-directive
// error names this file and says what was lost. That is the difference between a
// closed hole and a hole with a note on it.
//
// They cover the two ways a field leaves the wire: renamed, and deleted. Both
// used to be silent for an optional field, and the second is the reason a call
// site must mention every key rather than only the ones it happens to have.
//
// The type used throughout is `DialogEvidenceItem`, deliberately: `dialogs.ts`'s
// `label` is the exact field `v-wire-contract` renamed to `title` to prove the
// hole was open, and this is where that mutation is now nailed down.

import assert from "node:assert/strict";
import test from "node:test";
import { present } from "../present";
import type { DialogEvidenceItem, FormControlEvidence, NavigationEvidence } from "../../content/evidence";
import type { WebAutomationEvidenceRect as EvidenceRect } from "@fluxiq-web-extension/domain";

const BOUNDS: EvidenceRect = { x: 10, y: 20, width: 300, height: 200 };

// ---------------------------------------------------------------------------
// Runtime: absent stays absent, and a value stays a value.
// ---------------------------------------------------------------------------

test("an optional field given undefined is absent, not present and undefined", () => {
  const dialog = present<DialogEvidenceItem>({
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    label: undefined,
    bounds: undefined
  });

  assert.equal("label" in dialog, false, "an absent dialog label must not become an empty one");
  assert.equal("bounds" in dialog, false);
  assert.deepEqual(Object.keys(dialog), ["selector", "role", "modal", "native"]);
});

test("an optional field given a value is kept, in the literal's own key order", () => {
  const dialog = present<DialogEvidenceItem>({
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    label: "Invite a collaborator",
    bounds: BOUNDS
  });

  assert.equal(dialog.label, "Invite a collaborator");
  assert.deepEqual(dialog.bounds, BOUNDS);
  assert.deepEqual(Object.keys(dialog), ["selector", "role", "modal", "native", "label", "bounds"]);
});

test("false, zero and the empty string are values, and only undefined is dropped", () => {
  // `hasValue: false` is the evidence that a control was looked at and is empty,
  // which is not the same fact as a producer that does not report it at all --
  // the distinction the truncation work established and this must not erase.
  const control = present<FormControlEvidence>({
    selector: "#card",
    controlType: "text",
    name: undefined,
    label: undefined,
    required: undefined,
    disabled: undefined,
    hasValue: false,
    autocomplete: undefined,
    sensitive: undefined
  });
  assert.equal("hasValue" in control, true);
  assert.equal(control.hasValue, false);
  assert.equal("sensitive" in control, false, "an unmarked control must not claim a sensitivity verdict");

  const navigation = present<NavigationEvidence>({
    url: "https://example.test/checkout",
    origin: "https://example.test",
    path: "/checkout",
    referrer: "",
    type: undefined,
    redirects: 0,
    historyLength: 1,
    visibility: "visible"
  });
  assert.equal(navigation.redirects, 0, "zero redirects is a measurement, not a missing field");
  assert.equal(navigation.referrer, "");
});

test("dropping an empty string is the producer's decision, not the helper's", () => {
  // Every call site that used to write `...(label ? { label } : {})` now writes
  // `label: label || undefined`, so an empty accessible name is dropped exactly
  // as it was before. `present` itself keeps `""`, which is why the producer has
  // to say so -- and why the row above can prove it does.
  const label = "";
  const dialog = present<DialogEvidenceItem>({
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    label: label || undefined,
    bounds: undefined
  });
  assert.equal("label" in dialog, false);
});

// ---------------------------------------------------------------------------
// Runtime: the wire is byte-identical to what the conditional spreads produced.
// ---------------------------------------------------------------------------

/** Exactly the shape `describeDialog` used to build, spread and all. */
function byConditionalSpread(label: string | undefined, bounds: EvidenceRect | undefined): DialogEvidenceItem {
  return {
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    ...(label ? { label } : {}),
    ...(bounds ? { bounds } : {})
  };
}

/** The same shape, built the way `describeDialog` builds it now. */
function byPresent(label: string | undefined, bounds: EvidenceRect | undefined): DialogEvidenceItem {
  return present<DialogEvidenceItem>({
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    label: label || undefined,
    bounds
  });
}

test("what reaches the wire is unchanged, with the optional fields present and absent", () => {
  for (const [label, bounds] of [
    ["Invite a collaborator", BOUNDS],
    ["Invite a collaborator", undefined],
    [undefined, BOUNDS],
    [undefined, undefined],
    ["", undefined]
  ] as const) {
    const before = byConditionalSpread(label, bounds);
    const after = byPresent(label, bounds);
    assert.deepStrictEqual(after, before, `differs for label=${String(label)} bounds=${bounds ? "set" : "unset"}`);
    assert.equal(JSON.stringify(after), JSON.stringify(before), "key order changed, so the JSON is not byte-identical");
  }
});

// ---------------------------------------------------------------------------
// Compile time: the guarantee itself, re-proved by every `check`.
//
// Never called. Each `@ts-expect-error` below fails the build the moment the
// line it guards starts compiling, which is the moment the producer-side hole
// reopens.
// ---------------------------------------------------------------------------

function theCompilerMustRejectEachOfThese(): void {
  // RENAMING AN OPTIONAL FIELD. The mutation `v-wire-contract` used to prove the
  // hole was open: before `present`, this passed `check` and all 229 tests while
  // the field silently left the wire.
  // @ts-expect-error - 'title' is not a field of the contract
  present<DialogEvidenceItem>({ selector: "#invite", role: "dialog", modal: true, native: false, title: "A label", bounds: undefined });

  // DELETING AN OPTIONAL FIELD. The other way a field goes missing, and the one
  // a contract type cannot catch on its own, since absence is what optional
  // means. Caught here because the key must be MENTIONED even when its value is
  // `undefined`.
  // @ts-expect-error - 'label' is missing
  present<DialogEvidenceItem>({ selector: "#invite", role: "dialog", modal: true, native: false, bounds: undefined });

  // Renaming a required field. Caught before this change too, by the plain
  // properties of the literal; kept so a regression is attributed correctly.
  // @ts-expect-error - 'target' is not a field of the contract
  present<DialogEvidenceItem>({ target: "#invite", role: "dialog", modal: true, native: false, label: undefined, bounds: undefined });

  // Dropping a required field.
  // @ts-expect-error - 'selector' is missing
  present<DialogEvidenceItem>({ role: "dialog", modal: true, native: false, label: undefined, bounds: undefined });

  // A required field given `undefined`. `present` strips undefined, so allowing
  // this would let the helper return an object that does not match its own type.
  // @ts-expect-error - 'undefined' is not assignable to 'string'
  present<DialogEvidenceItem>({ selector: undefined, role: "dialog", modal: true, native: false, label: undefined, bounds: undefined });

  // Calling without naming the contract type. `T` would otherwise be inferred
  // from the argument, which checks the literal against itself and nothing else.
  // @ts-expect-error - the type argument is not optional
  present({ selector: "#invite", role: "dialog", modal: true, native: false, title: "A label" });

  // A wrong value type on an optional field.
  // @ts-expect-error - 'number' is not assignable to 'string'
  present<DialogEvidenceItem>({ selector: "#invite", role: "dialog", modal: true, native: false, label: 7, bounds: undefined });
}

function theCompilerMustAcceptThis(): DialogEvidenceItem {
  // No directive, and none wanted. Naming a field and having nothing to put in
  // it must stay legal, because an unlabelled dialog is a real page state and an
  // absent label is not an empty one. If closing the two holes above ever makes
  // an optional field mandatory on the wire, this line stops compiling -- and if
  // it stops omitting the key from the result, the assertion below fails.
  return present<DialogEvidenceItem>({
    selector: "#invite",
    role: "dialog",
    modal: true,
    native: false,
    label: undefined,
    bounds: undefined
  });
}

test("the compile-time rows above are type-level, and are checked by `pnpm check`", () => {
  assert.equal(typeof theCompilerMustRejectEachOfThese, "function");
  assert.deepEqual(Object.keys(theCompilerMustAcceptThis()), ["selector", "role", "modal", "native"]);
});
