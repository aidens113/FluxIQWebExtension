// src/output-nodes/tests/targets.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/output-nodes/targets.ts
function outputTargetFromPayload(payload) {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const element = firstElementFingerprint(elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate));
  const selector = stringValue(selectedCandidate?.selector) ?? stringValue(adaptedFingerprint?.selector) ?? stringValue(adaptedTarget?.selector) ?? stringValue(payload.selector) ?? stringValue(element?.selector) ?? stringValue(explicitVisualTarget?.selector);
  if (!selector && !explicitVisualTarget) return void 0;
  return compact({
    selector,
    ...element ? { element } : {},
    ...explicitVisualTarget ? { visualTarget: explicitVisualTarget } : {}
  });
}
function elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate) {
  const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint];
  return adaptedTarget?.selectedCandidate !== void 0 ? [...adapted, payload.element] : [payload.element, ...adapted];
}
function firstElementFingerprint(sources) {
  for (const source of sources) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint;
  }
  return void 0;
}
function selectedTargetCandidate(target) {
  const selectedCandidateId = stringValue(objectValue(target?.selectedCandidate)?.candidateId);
  if (!selectedCandidateId || !Array.isArray(target?.candidates)) return void 0;
  return target.candidates.map(objectValue).find((candidate) => stringValue(candidate?.candidateId) === selectedCandidateId);
}
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = elementAttributes(element.attributes);
  return compact({
    selector: stringValue(element.selector),
    xpath: stringValue(element.xpath),
    id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item) => typeof item === "string") : void 0,
    visibleText: stringValue(element.visibleText),
    tagName: stringValue(element.tagName),
    text: stringValue(element.text),
    value: stringValue(element.value),
    role: stringValue(element.role),
    implicitRole: stringValue(element.implicitRole),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes,
    context: elementContext(element.context),
    // Core's remaining fingerprint signals, named so their absence is a
    // decision and so a signal Core adds stops this producer compiling. A
    // browser recording has no source for any of them: the first four are a
    // host application's own identifiers and a Core state path, `url` names
    // the page rather than the control, `bounds` are the capture's viewport
    // and not this instant's (which is why `content/identity/score.ts` refuses
    // to compare them), and `metadata` is Core's own passthrough slot, which
    // this normalizer must not start writing into behind the declared fields.
    automationId: void 0,
    entityId: void 0,
    entityKind: void 0,
    statePath: void 0,
    queryPath: void 0,
    url: void 0,
    bounds: void 0,
    metadata: void 0
  });
}
function elementContext(value) {
  const context = objectValue(value);
  if (!context) return void 0;
  const fields = compact({
    formId: stringValue(context.formId),
    formName: stringValue(context.formName),
    formAction: stringValue(context.formAction),
    fieldsetLegend: stringValue(context.fieldsetLegend),
    landmark: stringValue(context.landmark),
    heading: stringValue(context.heading),
    listPosition: listPosition(context.listPosition),
    tablePosition: tablePosition(context.tablePosition)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function listPosition(value) {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePosition(value) {
  const position = objectValue(value);
  const row = numberValue(position?.row);
  const column = numberValue(position?.column);
  if (row === void 0 || column === void 0) return void 0;
  const columnHeader = stringValue(position?.columnHeader);
  return columnHeader === void 0 ? { row, column } : { row, column, columnHeader };
}
function elementAttributes(value) {
  const attributes = objectValue(value);
  if (!attributes) return void 0;
  const strings = {};
  for (const [name, item] of Object.entries(attributes)) {
    if (typeof item === "string") strings[name] = item;
  }
  return strings;
}
function elementTestId(element, attributes) {
  return stringValue(element.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]);
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}

// src/output-nodes/tests/targets.test.ts
test("identity signals are read from the descriptor's own fields", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    testId: "save-button",
    accessibleName: "Save changes",
    label: "Save"
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
  assert.equal(fingerprint?.label, "Save");
});
test("a recording made before the producer emitted the fields still resolves them from attributes", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    attributes: { "data-testid": "save-button", "aria-label": "Save changes" }
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
});
test("the test id falls back through the attribute names the selector prefers", () => {
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-test": "alpha" } })?.testId, "alpha");
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-cy": "beta" } })?.testId, "beta");
  assert.equal(elementFingerprint({ selector: "#a", testId: "own", attributes: { "data-testid": "attribute" } })?.testId, "own");
});
test("an element with no identity signals gains no empty ones", () => {
  const fingerprint = elementFingerprint({ selector: "#plain", tagName: "div" });
  assert.deepEqual(fingerprint, { selector: "#plain", tagName: "div" });
});
test("the signals survive into the dispatched target", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", testId: "save-button", accessibleName: "Save changes" }
  });
  assert.equal((target?.element).testId, "save-button");
  assert.equal((target?.element).accessibleName, "Save changes");
});
var recordedElement = {
  selector: "#save-settings",
  xpath: "/html/body/main/form/button",
  tagName: "button",
  id: "save-settings",
  text: "Save changes",
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Save",
  visibleText: "Save changes",
  implicitRole: "button",
  classNames: ["btn", "btn-primary"],
  attributes: { id: "save-settings", "data-testid": "save-changes" }
};
var signalCount = (target) => Object.keys(target?.element ?? {}).length;
test("Core passed the target through untouched: the recorded identity is the dispatched one", () => {
  const target = outputTargetFromPayload({ selector: "#save-settings", element: recordedElement });
  assert.equal(signalCount(target), 12);
  assert.equal((target?.element).testId, "save-changes");
});
test("Core matched nothing: the recorded identity beats its own lossy re-derivation", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#save-settings", statePath: "web.elements.save.changes" }, source: "runtime" }
  });
  assert.equal(signalCount(target), 12, "all twelve recorded signals reach the wire, not just the selector");
  assert.equal((target?.element).testId, "save-changes");
  assert.equal((target?.element).accessibleName, "Save changes");
  assert.equal((target?.element).implicitRole, "button");
  assert.equal(target?.selector, "#save-settings");
});
test("Core matched a candidate: the drift-corrected candidate beats the recorded identity", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#save-settings" },
      candidates: [
        { candidateId: "candidate.stale", selector: "#save-settings-old", tagName: "button" },
        { candidateId: "candidate.current", selector: "#settings-save-v2", tagName: "button", testId: "save-changes", accessibleName: "Save changes" }
      ],
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.91, matchedSignals: ["testId"], failedSignals: ["selector"] }
    }
  });
  assert.equal((target?.element).selector, "#settings-save-v2", "the element the page really has, not the one that was recorded");
  assert.equal(target?.selector, "#settings-save-v2");
  assert.ok(signalCount(target) < 12);
});
test("Core matched but adapted only the fingerprint: the adaptation is still not discarded", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" },
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.88, matchedSignals: ["testId"], failedSignals: [] }
    }
  });
  assert.equal((target?.element).testId, "save-changes-v2");
  assert.equal((target?.element).selector, "#settings-save-v2");
});
test("an adapted target's own element wins when Core matched, and loses when it did not", () => {
  const adaptedElement = { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" };
  const matched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement, selectedCandidate: { candidateId: "candidate.current", confidence: 0.9 } }
  });
  assert.equal((matched?.element).testId, "save-changes-v2");
  const unmatched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement }
  });
  assert.equal((unmatched?.element).testId, "save-changes", "an unmatched pass-through is a re-derivation, not an adaptation");
});
test("a source with no recognized signal does not shadow one that has them", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: { nothingRecognized: true },
    target: { kind: "element", fingerprint: { selector: "#save-settings", tagName: "button" }, source: "runtime" }
  });
  assert.deepEqual(target?.element, { selector: "#save-settings", tagName: "button" });
});
test("the element ordering does not decide the selector or the emptiness guard", () => {
  assert.equal(outputTargetFromPayload({
    selector: "#recorded",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#adapted" }, source: "runtime" }
  })?.selector, "#adapted");
  assert.equal(outputTargetFromPayload({ element: recordedElement })?.selector, "#save-settings", "an element-only payload still resolves its selector from the element");
  assert.equal(outputTargetFromPayload({ element: { tagName: "button", text: "Save" } }), void 0, "no selector and no visual target is still no target");
});
var recordedContext = {
  formId: "settings-form",
  formName: "settings",
  formAction: "/workspace/settings",
  fieldsetLegend: "General",
  landmark: "main",
  heading: "Workspace settings",
  listPosition: { index: 3, total: 24 },
  tablePosition: { row: 2, column: 4, columnHeader: "Total" }
};
test("where the element sat survives into the fingerprint, field by field", () => {
  const fingerprint = elementFingerprint({ selector: "#save", tagName: "button", context: recordedContext });
  assert.deepEqual(fingerprint?.context, recordedContext);
});
test("and into the dispatched target, which is the layer it used to die at", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", context: { formName: "settings", fieldsetLegend: "General" } }
  });
  assert.deepEqual((target?.element).context, { formName: "settings", fieldsetLegend: "General" });
});
test("a context key the normalizer does not know does not reach the page", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    context: { formName: "settings", formIdentifier: "settings-form", landmark: 7 }
  });
  assert.deepEqual(fingerprint?.context, { formName: "settings" }, "an unknown key and a mistyped one are both dropped");
});
test("a position is only a position when it is complete", () => {
  const partial = elementFingerprint({
    selector: "#cell",
    context: { listPosition: { index: 3 }, tablePosition: { row: 2, column: 4 } }
  });
  assert.deepEqual(partial?.context, { tablePosition: { row: 2, column: 4 } }, "an index with no total says how far along nothing");
});
test("an element inside no form, list or table carries no context at all", () => {
  assert.equal("context" in (elementFingerprint({ selector: "#plain", tagName: "div" }) ?? {}), false);
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: {} }) ?? {}), false, "an empty context is absent, not an empty object");
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: "main" }) ?? {}), false, "a context that is not an object is absent");
});
test("the attribute map is narrowed to the strings Core compares", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    attributes: { "data-testid": "save", "aria-hidden": true, "data-config": { nested: 1 } }
  });
  assert.deepEqual(fingerprint?.attributes, { "data-testid": "save" });
  assert.deepEqual(elementFingerprint({ selector: "#save", attributes: {} })?.attributes, {}, "an element that carried an empty map still carries one");
});
