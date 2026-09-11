// T1 coverage of runtime-status.ts: the recording event and registered input a
// succeeded runtime action confirms, for every action type; the value a `type`
// or `select` confirmation carries, which a sensitive field never does; and the
// panel's status tracker, labels and targets.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_ACTION_TYPES, WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionType, DomElementDescriptor } from "../../../shared/protocol";
import { RuntimeStatusTracker, runtimeActionLabel, runtimeConfirmationForActionResult, runtimeResultTarget } from "../runtime-status";

type Confirmation = ReturnType<typeof runtimeConfirmationForActionResult>;

function field(overrides: Partial<DomElementDescriptor> = {}): DomElementDescriptor {
  return { tagName: "input", selector: "#field", ...overrides };
}

function actionResult(actionType: BrowserActionType, overrides: Partial<BrowserActionResult> = {}): BrowserActionResult {
  return {
    commandId: "command-1",
    actionType,
    status: "succeeded",
    validation: { status: "none", reason: "not-yet-validated" },
    startedAt: 100,
    finishedAt: 150,
    ...overrides
  };
}

// Keyed by the action type union, so a new action type does not compile until
// it is classified here; the first test also checks the domain's runtime list.
const confirmations: Record<BrowserActionType, Confirmation> = {
  "web.browser.navigate": { kind: "browser.navigation", inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested },
  "web.dom.click": { kind: "dom.click", inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked },
  "web.dom.type": { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.textEntered },
  "web.dom.clear": { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared, inputValue: "" },
  "web.dom.select": { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected },
  "web.dom.scroll": { kind: "dom.scroll", inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled },
  "web.dom.keypress": { kind: "dom.keydown", inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed },
  "web.dom.wait_for_selector": undefined,
  "web.dom.wait_for_text": undefined,
  "web.dom.extract": undefined,
  "web.dom.capture_snapshot": undefined,
  // Added in Week 1 (decision D6). None confirms a recorded user action yet:
  // `w2-domain-vocabulary` gives `web.dom.check` its recording input, and this
  // row becomes a confirmation then.
  "web.dom.check": undefined,
  "web.dom.assert": undefined,
  "web.dom.extract_list": undefined,
  "web.dom.upload": undefined,
  "web.dom.dialog": undefined,
  "web.browser.tab": undefined,
  "web.browser.download": undefined
};

// The sensitivity rule the recorder defines (isSensitiveFormControl in
// content/element-traits.ts), as the worker judges it from the wire descriptor.
const sensitiveFields: Array<[label: string, element: DomElementDescriptor]> = [
  ["a password input", field({ inputType: "password" })],
  ["a password input typed in upper case", field({ inputType: "PASSWORD" })],
  ["autocomplete=current-password", field({ attributes: { autocomplete: "current-password" } })],
  ["autocomplete=new-password", field({ attributes: { autocomplete: "new-password" } })],
  ["autocomplete=New-Password", field({ attributes: { autocomplete: "New-Password" } })],
  ["autocomplete=one-time-code", field({ attributes: { autocomplete: "one-time-code" } })],
  ["autocomplete=cc-number", field({ attributes: { autocomplete: "cc-number" } })],
  ["autocomplete=cc-csc", field({ attributes: { autocomplete: "cc-csc" } })],
  ["a select with autocomplete=cc-exp-month", field({ tagName: "select", attributes: { autocomplete: "cc-exp-month" } })],
  ["data-sensitive=true", field({ attributes: { "data-sensitive": "true" } })]
];

const plainFields: Array<[label: string, element: DomElementDescriptor]> = [
  ["a text input", field({ inputType: "text" })],
  ["a select", field({ tagName: "select" })],
  ["data-sensitive=false", field({ attributes: { "data-sensitive": "false" } })],
  ["autocomplete=email", field({ attributes: { autocomplete: "email" } })],
  ["autocomplete=username", field({ attributes: { autocomplete: "username" } })]
];

test("the confirmation table covers exactly the domain's action types", () => {
  assert.deepEqual(Object.keys(confirmations).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
});

test("a succeeded action confirms the recording event and input its type maps to", () => {
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    assert.deepEqual(runtimeConfirmationForActionResult(actionResult(actionType, { element: field() })), confirmations[actionType], actionType);
  }
});

test("only type and select carry the value the field was left holding; clear carries an empty one", () => {
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    const confirmation = runtimeConfirmationForActionResult(actionResult(actionType, { element: field({ value: "entered" }) }));
    const carried = actionType === "web.dom.type" || actionType === "web.dom.select" ? "entered" : confirmations[actionType]?.inputValue;
    assert.equal(confirmation?.inputValue, carried, actionType);
  }
});

test("type and select carry a value only when the result has one", () => {
  for (const actionType of ["web.dom.type", "web.dom.select"] as const) {
    assert.equal(
      runtimeConfirmationForActionResult(actionResult(actionType, { element: field({ value: "" }) }))?.inputValue,
      "",
      `${actionType}: an emptied field still has a value`
    );
    const withoutValue: Array<[label: string, result: BrowserActionResult]> = [
      ["no element", actionResult(actionType)],
      // describeElement leaves `value` unset while input-value capture is off,
      // and `selectedValue` is deliberately not a fallback.
      ["an element without a value", actionResult(actionType, { element: field({ hasValue: true, selectedValue: "b" }) })]
    ];
    for (const [label, result] of withoutValue) {
      const confirmation = runtimeConfirmationForActionResult(result);
      assert.ok(confirmation, `${actionType}, ${label}: still confirmed`);
      assert.equal("inputValue" in confirmation, false, `${actionType}, ${label}: no inputValue member`);
    }
  }
});

test("a sensitive field's value never leaves in a type or select confirmation", () => {
  for (const actionType of ["web.dom.type", "web.dom.select"] as const) {
    for (const [label, element] of sensitiveFields) {
      const confirmation = runtimeConfirmationForActionResult(actionResult(actionType, { element: { ...element, value: "hunter2-secret" } }));
      // Strict deep equality also proves the inputValue member is absent, not undefined.
      assert.deepEqual(confirmation, confirmations[actionType], `${actionType}, ${label}`);
    }
  }
});

test("a field outside the sensitive rule keeps its value", () => {
  for (const actionType of ["web.dom.type", "web.dom.select"] as const) {
    for (const [label, element] of plainFields) {
      const confirmation = runtimeConfirmationForActionResult(actionResult(actionType, { element: { ...element, value: "visible" } }));
      assert.equal(confirmation?.inputValue, "visible", `${actionType}, ${label}`);
    }
  }
});

test("every action type has its own panel label, and an unknown type shows as itself", () => {
  const labels = WEB_AUTOMATION_ACTION_TYPES.map((actionType) => runtimeActionLabel(actionType));
  WEB_AUTOMATION_ACTION_TYPES.forEach((actionType, index) => assert.notEqual(labels[index], actionType, `${actionType} has a label`));
  assert.equal(new Set(labels).size, labels.length, "labels are distinct");
  assert.equal(runtimeActionLabel("web.browser.navigate"), "Navigate");
  assert.equal(runtimeActionLabel("web.dom.keypress"), "Key press");
  assert.equal(runtimeActionLabel("web.dom.unknown"), "web.dom.unknown");
});

test("the result target names the page for a navigation and the element otherwise", () => {
  assert.equal(runtimeResultTarget(actionResult("web.browser.navigate", { url: "https://example.test/", title: "Example" })), "https://example.test/");
  assert.equal(runtimeResultTarget(actionResult("web.browser.navigate", { title: "Example" })), "Example");
  assert.equal(runtimeResultTarget(actionResult("web.dom.click", { element: field({ name: "Submit order" }) })), "Submit order");
  assert.equal(runtimeResultTarget(actionResult("web.dom.click", { element: field() })), "#field");
  assert.equal(runtimeResultTarget(actionResult("web.dom.click", { url: "https://example.test/" })), undefined);
});

test("the status tracker runs an action and records how it finished", (t) => {
  t.mock.method(Date, "now", () => 5_000);
  const tracker = new RuntimeStatusTracker();
  assert.deepEqual(tracker.current(), { state: "idle" });

  const typing: BrowserActionCommand = { commandId: "c-1", actionType: "web.dom.type", selector: "#q", text: "shoes" };
  const running = tracker.startAction(typing);
  assert.deepEqual(running, { state: "running", commandId: "c-1", actionType: "web.dom.type", label: "Type", target: "#q", startedAt: 5_000 });
  assert.equal(tracker.current(), running);

  const finished = tracker.finish({
    ...actionResult("web.dom.type", { commandId: "c-1", element: field({ name: "Search" }), message: "Typed." }),
    tabId: 3,
    frameId: 0
  });
  assert.deepEqual(finished, {
    state: "succeeded",
    commandId: "c-1",
    actionType: "web.dom.type",
    label: "Type",
    target: "Search",
    tabId: 3,
    frameId: 0,
    startedAt: 100,
    finishedAt: 150,
    message: "Typed."
  });
});

test("a failed or timed-out action finishes as failed, with its message as the error", () => {
  const tracker = new RuntimeStatusTracker();
  tracker.startAction({ commandId: "c-2", actionType: "web.dom.click", selector: "#buy" });
  const failed = tracker.finish(actionResult("web.dom.click", { commandId: "c-2", status: "failed", message: "No element matched #buy." }));
  assert.equal(failed.state, "failed");
  assert.equal(failed.error, "No element matched #buy.");
  assert.equal(failed.target, "#buy", "without an element, the target the action started with is kept");

  const timedOut = tracker.finish(actionResult("web.dom.wait_for_text", { commandId: "c-3", status: "timed_out", message: "Timed out." }));
  assert.equal(timedOut.state, "failed");
  assert.equal(timedOut.error, "Timed out.");

  const quiet = tracker.finish(actionResult("web.dom.click", { commandId: "c-4" }));
  assert.equal(quiet.state, "succeeded");
  assert.equal("message" in quiet, false);
  assert.equal("error" in quiet, false);
});
