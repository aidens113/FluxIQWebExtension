// T1 coverage of `action-target.ts`: the recording envelope's `target`.
//
// This projection is the third hand-written copy of the element descriptor in
// this repository, and the third to drop the same five identity signals. The
// first two were the extension's wire projection (measured live) and the Flow
// node's `elementFingerprint`. The rows below pin the two halves that let the
// defect ship three times: the *key set*, checked against the contract type
// rather than against a copy of the producer's literal, and the fact that Core
// actually reads those keys.

import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionTargetFromElement, type WebAutomationActionTargetMetadata } from "../action-target";
import type { WebAutomationElementIdentitySignal, WebAutomationElementStateInput } from "../types";

/** A type only satisfiable when its argument is `never`. */
type Nothing<T extends never> = T;

/**
 * Every field the metadata contract declares, written out here so the two are
 * checked against each other rather than both being read off the producer.
 * `satisfies` rejects a key the contract does not have; `EveryMetadataFieldListed`
 * rejects a contract key this list forgets. A field added to
 * `WebAutomationElementStateInput` therefore fails here as well as at the
 * producer, unless it is deliberately promoted out of the metadata.
 */
const TARGET_METADATA_FIELDS = [
  "tagName", "xpath", "id", "classNames", "visibleText", "role", "href", "inputType",
  "documentBounds", "isVisibleOnViewport", "hasClickHandler", "attributes",
  "testId", "accessibleName", "label", "implicitRole", "context"
] as const satisfies readonly (keyof WebAutomationActionTargetMetadata)[];

export type EveryMetadataFieldListed = Nothing<Exclude<keyof WebAutomationActionTargetMetadata, typeof TARGET_METADATA_FIELDS[number]>>;

/** The five Phase 1.3 signals, named again here so a rename fails this file too. */
const IDENTITY_SIGNALS = ["testId", "accessibleName", "label", "implicitRole", "context"] as const satisfies readonly WebAutomationElementIdentitySignal[];

export type EveryIdentitySignalListed = Nothing<Exclude<WebAutomationElementIdentitySignal, typeof IDENTITY_SIGNALS[number]>>;

/** An element with every field the recorder can hand this projection, so an omission shows. */
const fullyDescribed: WebAutomationElementStateInput = {
  tagName: "button",
  selector: "#save-settings",
  xpath: "/html/body/main/form/div/button",
  id: "save-settings",
  classNames: ["btn", "btn-primary"],
  visibleText: "Save changes",
  text: "Save changes",
  value: "save",
  role: "button",
  name: "Save changes",
  href: "https://example.test/save",
  inputType: "submit",
  bounds: { x: 1, y: 2, width: 3, height: 4 },
  documentBounds: { x: 1, y: 6, width: 3, height: 4 },
  isVisibleOnViewport: true,
  hasClickHandler: true,
  attributes: { id: "save-settings", class: "btn btn-primary", "data-testid": "save-changes" },
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Workspace name",
  implicitRole: "button",
  context: { formId: "settings-form", formName: "settings", fieldsetLegend: "General", heading: "Workspace settings" }
};

function metadataOf(element: WebAutomationElementStateInput): Record<string, unknown> {
  const metadata = webAutomationActionTargetFromElement(element).metadata;
  assert.ok(metadata && typeof metadata === "object" && !Array.isArray(metadata), "the target carries metadata");
  return metadata as Record<string, unknown>;
}

test("the envelope target's metadata carries every field the contract declares, and only those", () => {
  assert.deepEqual(Object.keys(metadataOf(fullyDescribed)).sort(), [...TARGET_METADATA_FIELDS].sort());
});

test("every identity signal reaches the envelope target with the value the recorder captured", () => {
  const metadata = metadataOf(fullyDescribed);
  for (const signal of IDENTITY_SIGNALS) {
    assert.deepEqual(metadata[signal], fullyDescribed[signal], `${signal} reaches the envelope target`);
  }
});

// The join the two earlier copies of this projection failed to make: it is not
// enough that the field is on the object, it has to be on the object under the
// name Core reads it by.
test("Core's element-target normalizer reads the identity signals off the metadata", () => {
  const target = webAutomationActionTargetFromElement(fullyDescribed);
  const normalized = normalizeAutomationStudioElementTarget(target, { source: "recording" });
  assert.ok(normalized, "the envelope target normalizes to an element target");
  assert.equal(normalized.fingerprint.testId, "save-changes");
  assert.equal(normalized.fingerprint.accessibleName, "Save changes");
  assert.equal(normalized.fingerprint.role, "button");
  assert.equal(normalized.fingerprint.visibleText, "Save changes");
  assert.equal(normalized.fingerprint.xpath, "/html/body/main/form/div/button");
  assert.deepEqual(normalized.fingerprint.classNames, ["btn", "btn-primary"]);
  // Two signals Core has no field of its own for still travel, under the
  // fingerprint's metadata, which is where `elementFingerprint` on the Flow-node
  // side reads neither -- it has declared fields for both.
  assert.equal(normalized.fingerprint.metadata?.implicitRole, "button");
  assert.deepEqual(normalized.fingerprint.metadata?.context, fullyDescribed.context);
  // And one that does not, pinned because it is surprising. `ActionTarget.label`
  // is a display name, Core reads it as the fingerprint's `label` signal ahead
  // of `metadata.label`, and then strips `metadata.label` as a promoted key. So
  // the element's own `<label>` text cannot reach `fingerprint.label` by this
  // path however it is carried; only the Flow node's `elementFingerprint` gets
  // it right. Carrying it is still correct -- the metadata reaches every other
  // consumer of the envelope -- but it is not what Core scores.
  assert.equal(normalized.fingerprint.label, "Save changes");
  assert.equal(normalized.fingerprint.metadata?.label, undefined);
});

test("the promoted fields stay where ActionTarget declares them, and the target is unchanged otherwise", () => {
  const target = webAutomationActionTargetFromElement(fullyDescribed);
  assert.equal(target.type, "button");
  assert.equal(target.id, "save-changes");
  assert.equal(target.label, "Save changes");
  assert.equal(target.selector, "#save-settings");
  assert.deepEqual(target.bounds, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal("relativePosition" in target, false, "an absent optional field is absent, not null");
  assert.equal("visualTarget" in target, false);
  assert.equal("elementTarget" in target, false);
});

test("an element the page said little about gains no empty fields", () => {
  const target = webAutomationActionTargetFromElement({ tagName: "div", selector: "#plain" });
  assert.deepEqual(target, { type: "div", selector: "#plain", metadata: { tagName: "div", isVisibleOnViewport: false } });
});

// The far side of a wire from the recorder's own guard. `elementStatePayload`
// next door takes the same second look for the same reason: what crosses here
// is persisted and replayed.
test("a sensitive control sends no contents, and keeps the identity the author wrote", () => {
  const secret = "hunter2-should-never-cross";
  const password: WebAutomationElementStateInput = {
    tagName: "input",
    selector: "#password",
    id: "password",
    inputType: "password",
    value: secret,
    visibleText: secret,
    text: secret,
    accessibleName: secret,
    label: "Password",
    implicitRole: "textbox",
    testId: "password-field",
    context: { formName: "sign-in" },
    attributes: { id: "password", type: "password", autocomplete: "current-password" }
  };
  const target = webAutomationActionTargetFromElement(password);
  assert.equal(JSON.stringify(target).includes(secret), false, "no field carries the control's contents");
  // Without the guard the label chain ends at `element.value`, so a nameless
  // password field put what was typed into it on the envelope.
  assert.equal("label" in target, false);
  const metadata = target.metadata as Record<string, unknown>;
  for (const field of ["visibleText", "accessibleName"]) {
    assert.equal(field in metadata, false, `${field} is withheld on a sensitive control`);
  }
  assert.equal(metadata.label, "Password");
  assert.deepEqual(metadata.context, { formName: "sign-in" });
  assert.equal(metadata.testId, "password-field");
  assert.equal(metadata.implicitRole, "textbox");
});
