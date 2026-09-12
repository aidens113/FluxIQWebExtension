// The reducer's own sensitivity guard on `forms.<selector>`.
//
// `forms.*` is the one durable, secret-bearing value the reducer writes: the
// text a user typed, folded into state that is persisted, replayed and shown.
// The extension redacts a sensitive control at the reader, so a password never
// reaches this reducer today -- which is exactly why these rows exist. They
// assert the reducer refuses the value on its own evidence, so a regression in
// the producer, on the far side of a wire and past a release boundary, cannot
// silently repopulate secrets into state nobody re-reads.
//
// Every row sends the value the producer is supposed to have withheld. Nothing
// asserted here depends on the producer behaving.

import assert from "node:assert/strict";
import test from "node:test";
import type { RecordingDomainEventReducerContext, StateSnapshot } from "fluxiq/automation-studio";
import { webAutomationStateReducer } from "../reducers";
import { createWebAutomationInitialState } from "../state";

const SELECTOR = "input[name=secret]";
const SENT_VALUE = "a-value-the-producer-should-have-withheld";

/** One recorded input event, as the gateway mapping builds it, for an element with these descriptor fields. */
function reduce(element: Record<string, unknown> | undefined): StateSnapshot {
  return webAutomationStateReducer({
    event: {
      recordingId: "recording.test",
      domainId: "web-automation",
      eventType: "web.element.input_changed",
      timestamp: 42,
      sourceId: "tab:1",
      target: { selector: SELECTOR },
      payload: {
        url: "https://example.test/checkout",
        title: "Checkout",
        inputValue: SENT_VALUE,
        ...(element === undefined ? {} : { element })
      }
    },
    previousState: createWebAutomationInitialState(42)
  } as unknown as RecordingDomainEventReducerContext) as StateSnapshot;
}

function formValue(state: StateSnapshot): unknown {
  return state.namespaces.web?.values[`forms.${SELECTOR}`]?.value;
}

const field = (extra: Record<string, unknown>): Record<string, unknown> => ({ tagName: "input", selector: SELECTOR, ...extra });

test("an ordinary field's typed value is still written to form state", () => {
  assert.equal(formValue(reduce(field({ inputType: "text", attributes: { name: "coupon" } }))), SENT_VALUE);
  assert.equal(formValue(reduce(field({ inputType: "email", attributes: { autocomplete: "email" } }))), SENT_VALUE);
  assert.equal(formValue(reduce(field({ attributes: { "data-sensitive": "false" } }))), SENT_VALUE);
});

test("a sensitive field's value is refused however the descriptor says it is sensitive", () => {
  const sensitive: Array<[label: string, element: Record<string, unknown>]> = [
    ["type=password", field({ inputType: "password" })],
    ["type=PASSWORD", field({ inputType: "PASSWORD" })],
    ["data-sensitive=true", field({ inputType: "text", attributes: { "data-sensitive": "true" } })],
    ["autocomplete=current-password", field({ attributes: { autocomplete: "current-password" } })],
    ["autocomplete=new-password", field({ attributes: { autocomplete: "new-password" } })],
    ["autocomplete=one-time-code", field({ attributes: { autocomplete: "one-time-code" } })],
    ["autocomplete=cc-number", field({ attributes: { autocomplete: "cc-number" } })],
    ["a token list carrying a card field", field({ attributes: { autocomplete: "billing cc-number" } })],
    ["an uppercase token list", field({ attributes: { autocomplete: "Section-Pay Billing CC-CSC" } })]
  ];
  for (const [label, element] of sensitive) {
    const state = reduce(element);
    assert.equal(formValue(state), undefined, `${label}: the value was written to form state`);
    assert.equal(JSON.stringify(state).includes(SENT_VALUE), false, `${label}: the value survived somewhere in the snapshot`);
  }
});

test("refusing the value does not discard the rest of the event", () => {
  const state = reduce(field({ inputType: "password" }));
  assert.equal(state.namespaces.web?.values["page.url"]?.value, "https://example.test/checkout");
  assert.equal(state.namespaces.web?.values["page.title"]?.value, "Checkout");
  // The element still lands: presence, identity and focus are not secrets.
  assert.deepEqual(state.namespaces.web?.values["focus.target"]?.value, field({ inputType: "password" }));
});

test("an event with no element descriptor is treated as ordinary, and the reducer says so", () => {
  // Documented rather than defended: the recorder always sends a descriptor
  // with an input event, and refusing every value on a missing field would
  // empty `forms.*` on the strength of a shape change. If the payload ever
  // stops carrying one, this row is where the decision gets revisited.
  assert.equal(formValue(reduce(undefined)), SENT_VALUE);
});

test("the shared rule adds two signals the reducer's own copy did not read", () => {
  // Both are stricter than the copy this file carried before Wave 3, and
  // neither can make anything less redacted. `type` is what a descriptor
  // carries when `inputType` was never derived; the two control types come
  // from the reusable-evidence copy of the rule.
  for (const [label, element] of [
    ["the raw type attribute alone", field({ attributes: { type: "password" } })],
    ["inputType=one-time-code", field({ inputType: "one-time-code" })],
    ["inputType=credit-card", field({ inputType: "credit-card" })]
  ] as Array<[string, Record<string, unknown>]>) {
    assert.equal(formValue(reduce(element)), undefined, `${label}: the value was written to form state`);
  }
});
