// The identity half of the recording wire, from the event the extension sends
// to the element a generated Flow replays against.
//
// `tests/gateway-mapping.test.ts` proves the event's *shape*: its type, its
// envelope, its frame. What is proved here is what the event's element is
// *made of*, which is a different subject and the one that failed. The five
// identity signals Phase 1.3 added -- `testId`, `accessibleName`, `label`,
// `implicitRole` and `context` -- were captured by the recorder and never
// arrived: the extension's projection dropped them, and neither side's suite
// could tell, because each end tested its own half against its own fixture.
// `reports/L-replay.md` measured the consequence live, on a real Flow: nine
// signals where the harness measured twelve, and a drifted control scored 0.197
// against a 0.35 floor.
//
// So every row below joins two ends. The recorded element goes in as the
// extension puts it on the wire, and what comes out is read at the point the
// page will read it -- `webAutomationOutputPayload`, the recording-to-Flow
// mapper -- rather than at the boundary in between.
//
// Kept apart from `gateway-mapping.test.ts` rather than appended to it: that
// file is already past the 400-line advisory and covers a different subject.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { elementFingerprint, outputTargetFromPayload, webAutomationOutputPayload } from "../../output-nodes";
import { createWebAutomationRecordingEvent } from "../gateway-mapping";

/** The `identity-drift` fixture's baseline Save action, as the extension puts it on the wire. */
const recordedSave: JsonObject = {
  selector: "#save-settings",
  tagName: "button",
  xpath: "/html/body/main/form/section/div/button",
  id: "save-settings",
  classNames: ["btn", "btn-primary"],
  visibleText: "Save changes",
  text: "Save changes",
  isVisibleOnViewport: true,
  attributes: { id: "save-settings", class: "btn btn-primary", type: "submit", "data-testid": "save-changes" },
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Workspace name",
  implicitRole: "button",
  context: { formId: "settings-form", formName: "settings", fieldsetLegend: "General", heading: "Workspace settings" }
};

function recordedClick(element: JsonObject) {
  return createWebAutomationRecordingEvent({
    kind: "dom.click",
    sequence: 1,
    url: "https://example.test/settings",
    title: "Workspace settings",
    eventTimestampMs: 1_000,
    element
  });
}

/** The recorded element with some of what it carried taken away, as a thinner recording would arrive. */
function without(element: JsonObject, fields: readonly string[]): JsonObject {
  return Object.fromEntries(Object.entries(element).filter(([key]) => !fields.includes(key)));
}

function flowNodeElement(element: JsonObject): JsonObject {
  const event = recordedClick(element);
  const parameters = webAutomationOutputPayload("web.dom.click", event.payload as JsonObject);
  assert.ok(parameters.element, "the recorded click carries an element on its replayable parameters");
  return parameters.element as JsonObject;
}

test("the recorded element reaches the Flow node carrying the identity signals the recorder captured", () => {
  const element = flowNodeElement(recordedSave);
  assert.equal(element.testId, "save-changes");
  assert.equal(element.accessibleName, "Save changes");
  assert.equal(element.label, "Workspace name");
  assert.equal(element.implicitRole, "button");
});

// The three that have no fallback. `testId` and `accessibleName` can be
// re-derived from `data-testid` and `aria-label`, which is why their absence
// went unnoticed; these cannot, so a projection that drops one drops it for
// good. A page writing no `role` attribute -- which is most pages -- leaves the
// recorded side of every role comparison empty without `implicitRole`.
test("the signals with no attribute fallback are the ones a dropped projection loses for good", () => {
  const element = flowNodeElement(without(recordedSave, ["attributes", "testId", "accessibleName"]));
  assert.equal(element.implicitRole, "button");
  assert.equal(element.label, "Workspace name");
  assert.equal(element.testId, undefined);
});

// What the page finally reads. `outputTargetFromPayload` prefers the recorded
// element over the two-key fingerprint the mapper re-derives, so this is the
// description the resolver scores its candidates against.
test("the dispatched target the page scores is the recorded element, not the re-derived selector", () => {
  const parameters = webAutomationOutputPayload("web.dom.click", recordedClick(recordedSave).payload as JsonObject);
  const wireTarget = outputTargetFromPayload(parameters);
  const element = wireTarget?.element as JsonObject | undefined;
  assert.ok(element, "the dispatched target carries an element");
  assert.equal(element.accessibleName, "Save changes");
  assert.equal(element.implicitRole, "button");
});

// `elementFingerprint` is the normalizer both ends share, and it is the reason
// the wire's field names are not free to drift: a name it does not know is a
// signal the page never sees, whatever the recorder called it.
test("a signal the normalizer does not know does not reach the page", () => {
  const fingerprint = elementFingerprint({ ...without(recordedSave, ["accessibleName"]), ariaName: "Save changes" });
  assert.ok(fingerprint);
  assert.equal(fingerprint.accessibleName, undefined);
  assert.equal("ariaName" in fingerprint, false);
});
