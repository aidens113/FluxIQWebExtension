// Core plus the real web reading names a control to a model as Core alone used to.
// These are the cases that lived in Core's `llm/model-facing/tests/control-words.test.ts`
// when Core read these fields itself, moved with the code, asserting the same bytes.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioClassifyLegacyStepAct, automationStudioModelFacingControlWords, automationStudioTrialStepControl, runWithAutomationStudioDomainReadings } from "fluxiq/automation";
import { webControlWordsReader } from "../control-words";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

type Parameters_ = Parameters<typeof automationStudioModelFacingControlWords>[0];
const inWeb = <T>(fn: () => T): T => runWithAutomationStudioDomainReadings({ controlWordsReader: webControlWordsReader }, fn);
const words = (parameters: Parameters_) => inWeb(() => automationStudioModelFacingControlWords(parameters));

test("the bundle gives Core this reading", () => {
  assert.equal(createWebAutomationOutputNodeImplementationBundle().controlWordsReader, webControlWordsReader);
});

test("reads the resolved element's words first, in preference order, whitespace collapsed", () => {
  assert.equal(words({ element: { visibleText: "Post", accessibleName: "  Create\n post " } }), "Create post");
  assert.equal(words({ element: { label: "Email" }, target: { name: "Other" } }), "Email");
});

test("falls back to the authored target, flat or as a fingerprint, by name or placeholder", () => {
  assert.equal(words({ target: { name: "Write something...", role: "button" } }), "Write something...");
  assert.equal(words({ target: { kind: "element", fingerprint: { placeholder: "Search" } } }), "Search");
  // A resolved identity's `name` is the form field's name attribute, a finding signal, never the control's words.
  assert.equal(words({ element: { name: "qty_input_3", tag: "input" } }), undefined);
  assert.equal(words({ target: { kind: "element", fingerprint: { name: "email" } } }), undefined);
});

test("names nothing when the control carries no words, or only words that say how it is found", () => {
  assert.equal(words(undefined), undefined);
  assert.equal(words({ target: { role: "button" }, selector: "#go" }), undefined);
  assert.equal(words({ element: { accessibleName: "#composer", visibleText: "matched by fingerprint 0.82" } }), undefined);
});

test("skips a locator-shaped field for the next field that is words", () => {
  assert.equal(words({ element: { accessibleName: "[data-testid=composer]", visibleText: "Write something..." } }), "Write something...");
});

test("names a control by its own words when they hold an ordinary page word the failure screen drops", () => {
  assert.equal(words({ element: { accessibleName: "Send renewals to this address" } }), "Send renewals to this address");
  assert.equal(words({ element: { visibleText: "Show my reading score" } }), "Show my reading score");
  assert.equal(words({ element: { accessibleName: "matched by fingerprint", visibleText: "Selector: #renew" } }), undefined);
  assert.equal(words({ element: { accessibleName: "Renew 0.82" } }), undefined);
});

test("a read step's element says its words are the value it reads, so a trial names it by what it read", () => {
  const node: Parameters<typeof automationStudioTrialStepControl>[0] = { id: "n", definitionId: "web.output.dom-extract", parameterValues: { element: { readsWords: true, visibleText: "12 Old Road" } } };
  assert.equal(inWeb(() => automationStudioTrialStepControl(node, undefined)), undefined);
  const named: Parameters<typeof automationStudioTrialStepControl>[0] = { id: "n", definitionId: "web.output.dom-click", parameterValues: { element: { visibleText: "Save" } } };
  assert.equal(inWeb(() => automationStudioTrialStepControl(named, undefined)), "Save");
});

test("a legacy step is lasting by its control's words, and is read as lasting when no reading is in scope", () => {
  const save = { label: "Step", parameterValues: { element: { accessibleName: "Add to cart" } } };
  const look = { label: "Step", parameterValues: { element: { accessibleName: "Show details" } } };
  assert.equal(inWeb(() => automationStudioClassifyLegacyStepAct(save)), true);
  assert.equal(inWeb(() => automationStudioClassifyLegacyStepAct(look)), false);
  assert.equal(automationStudioClassifyLegacyStepAct(look), true);
});
