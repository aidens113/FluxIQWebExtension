// The projection's own sensitivity decision on a form control.
//
// The projection is the far side of a wire from the producer's guard, and web
// state is persisted and replayed, so it asks the shared rule again rather than
// inheriting the producer's verdict. Until it could read `autocomplete` it
// could only re-derive half the rule, and the half it could not see is the one
// that matters: a payment field is a plain `text` input marked
// `billing cc-number`, so `controlType` alone can never recognise one. That
// token list has slipped past a copy of this rule twice in this plan.
//
// Every row here plants a wire payload whose `sensitive` flag is absent or
// wrong, because a row that sent the flag would prove nothing: it would pass
// with the second check removed. The end-to-end proof, that the producer
// actually puts the attribute on the wire, is
// `apps/extension/src/content/evidence/tests/forms.test.ts`.
//
// No captured value appears here. The only strings are page markup and a
// synthetic placeholder named for what it stands for.

import assert from "node:assert/strict";
import test from "node:test";
import type { StateSnapshot, StateValue } from "fluxiq/automation-studio";
import { createWebAutomationStateFromSnapshot } from "../../snapshot";

/** A value a producer was supposed to have withheld. Rows that plant one assert its absence. */
const LEAKED = "synthetic-value-the-producer-should-have-withheld";

type ProjectedControl = Record<string, unknown>;

/** One form holding one control, projected, with the control read back out. */
function projectedControl(control: Record<string, unknown>): ProjectedControl {
  const state = stateWithControls([control]);
  const forms = (state.namespaces.web?.values ?? {})["evidence.forms"] as StateValue | undefined;
  const collection = forms?.value as unknown as { items: ProjectedControl[] };
  const projected = (collection.items[0]?.controls as ProjectedControl[] | undefined)?.[0];
  assert.ok(projected, "the projection wrote no control");
  return projected;
}

function stateWithControls(controls: Record<string, unknown>[]): StateSnapshot {
  return createWebAutomationStateFromSnapshot({
    url: "https://shop.test/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [],
    evidence: { forms: [{ selector: "form#pay", label: "Payment", controlCount: controls.length, controls }] }
  } as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0], { timestamp: 40, sourceId: "tab:9" });
}

/** A control the producer described but did not mark, which is the case under test. */
function unmarked(autocomplete: string | undefined): Record<string, unknown> {
  return {
    selector: "#field",
    controlType: "text",
    name: "field",
    label: "Card number",
    hasValue: true,
    ...(autocomplete === undefined ? {} : { autocomplete })
  };
}

test("a card field the producer failed to mark is protected by the projection's own reading of its tokens", () => {
  const projected = projectedControl(unmarked("billing cc-number"));
  assert.equal(projected.sensitive, true);
  assert.equal(projected.hasValue, undefined, "a sensitive control must not report whether it holds a value");
});

test("the tokens are read as tokens, in every shape a page writes them", () => {
  for (const autocomplete of [
    "cc-number",
    "billing cc-number",
    "shipping cc-exp",
    "section-pay billing cc-csc",
    "Section-Pay Billing CC-Number",
    "current-password",
    "new-password",
    "one-time-code",
    "  billing   cc-number  "
  ]) {
    assert.equal(projectedControl(unmarked(autocomplete)).sensitive, true, autocomplete);
  }
});

test("an ordinary field keeps its value-presence flag: the rule protects secrets, not every control", () => {
  for (const autocomplete of [undefined, "email", "username", "billing street-address", "off", "cc"]) {
    const projected = projectedControl(unmarked(autocomplete));
    assert.equal(projected.sensitive, undefined, String(autocomplete));
    assert.equal(projected.hasValue, true, String(autocomplete));
  }
});

// `read.ts`'s `text()` collapses and slices to 200 characters. Reading the
// attribute through it would drop the token that decides the question, which is
// exactly how a truncating copy of this rule let a card field through before.
test("the deciding token is found however far into the attribute the page put it", () => {
  const padding = Array.from({ length: 4 }, (_, index) => `section-${String(index).repeat(50)}`).join(" ");
  const autocomplete = `${padding} billing cc-number`;
  assert.ok(autocomplete.length > 250, "the row is pointless unless the token sits past every text bound");
  assert.equal(projectedControl(unmarked(autocomplete)).sensitive, true);
});

test("the attribute decides and is then discarded: nothing widens the persisted shape", () => {
  const projected = projectedControl(unmarked("billing cc-number"));
  assert.equal(projected.autocomplete, undefined);
  assert.deepEqual(Object.keys(projected).sort(), ["controlType", "label", "name", "selector", "sensitive"]);
});

test("a control type the rule knows is still caught on its own, with no attribute at all", () => {
  const projected = projectedControl({ selector: "#pw", controlType: "password", hasValue: true });
  assert.equal(projected.sensitive, true);
  assert.equal(projected.hasValue, undefined);
});

// The producer's verdict and the projection's are two checks, not one dressed
// twice: either alone protects the control, so both must fail before a value
// escapes.
test("the producer's flag still protects a control the projection's own reading would clear", () => {
  const projected = projectedControl({ selector: "#pin", controlType: "text", autocomplete: "off", hasValue: true, sensitive: true });
  assert.equal(projected.sensitive, true);
  assert.equal(projected.hasValue, undefined);
});

// The evidence comes off a wire from a page, so the field may be anything at
// all. An unreadable attribute must leave the control unprotected by *this*
// check rather than throw and take the recording down with it.
test("an attribute that is not a string is ignored rather than thrown on", () => {
  for (const autocomplete of [42, null, ["billing", "cc-number"], { token: "cc-number" }, true]) {
    const projected = projectedControl({ selector: "#field", controlType: "text", hasValue: true, autocomplete });
    assert.equal(projected.sensitive, undefined, JSON.stringify(autocomplete));
  }
});

test("a value the producer should have withheld reaches the state under no key", () => {
  const state = stateWithControls([{ ...unmarked("billing cc-number"), value: LEAKED, autocompleteValue: LEAKED }]);
  assert.equal(JSON.stringify(state).includes(LEAKED), false);
});
