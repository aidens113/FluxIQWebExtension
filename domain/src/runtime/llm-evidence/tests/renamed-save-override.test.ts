import assert from "node:assert/strict";
import test from "node:test";
import { validateWebRuntimeTargetOverrideEvidence } from "..";
import { elementFillsRepairableParameter, webFailureRepairParameters } from "../repairable-parameters";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";

// Whether a correct repair of identity-drift's `renamed-redesign` could pass
// this domain's own evidence check. In that rendering the matcher refuses Save
// outright (-0.104 against the 0.35 floor, measured in Chromium by
// `apps/extension/e2e/content/tests/identity-resolution.spec.ts`), so the only
// way the run completes is a `temporary_target_override` Core first hands to
// `validateWebRuntimeTargetOverrideEvidence`.
//
// The snapshot below is what the content script captured for that page in
// Chromium on 2026-09-16 (`harness.capture()`), with the layout fields the
// sanitizer never reads -- bounds, xpath, class lists, viewport visibility --
// left out, and the lab's random port fixed. It is sanitized exactly as
// `captureSanitizedFailureEvidence` does it for this recorded Flow: the failure
// budget, no control named (Core's failed-action identity names none), and the
// repairable parameters offered for a `builtin.policy.action`, whose verb Core's
// capture request does not name.

const FORM_SECTION = { formId: "settings-form", landmark: "region", landmarkName: "General", heading: "General" };
const ADVANCED_SECTION = { formId: "settings-form", landmark: "region", landmarkName: "Advanced", heading: "Advanced" };
const RENAMED_SAVE_SELECTOR = "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)";
const DEFINITION_LIST = [["Data region", "EU (Frankfurt)"], ["Message retention", "365 days"], ["Audit log", "Enabled for all members"], ["API access", "Workspace owners only"]] as const;

const listCell = (tag: "dt" | "dd", index: number, text: string) => ({
  tagName: tag, selector: `main > form > section:nth-of-type(2) > dl > ${tag}:nth-of-type(${index + 1})`, text, visibleText: text, accessibleName: text, context: ADVANCED_SECTION
});

const capturedRenamedRedesign = {
  url: "http://127.0.0.1:4173/scenarios/identity-drift/",
  title: "Workspace settings",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 1277, devicePixelRatio: 1 },
  frame: { isTop: true, viewportOffset: { x: 0, y: 0, width: 1280, height: 720 } },
  interactiveElements: [
    {
      tagName: "button", selector: "#discard-settings", text: "Discard changes", visibleText: "Discard changes", id: "discard-settings", testId: "discard-changes",
      accessibleName: "Discard changes", implicitRole: "button", context: FORM_SECTION,
      attributes: { id: "discard-settings", class: "btn btn-secondary", type: "reset", "data-testid": "discard-changes" }
    },
    {
      tagName: "button", selector: RENAMED_SAVE_SELECTOR, text: "Apply changes", visibleText: "Apply changes",
      accessibleName: "Apply changes", implicitRole: "button", context: FORM_SECTION,
      attributes: { class: "ui-button ui-button--accent", type: "submit" }
    },
    {
      tagName: "input", selector: "#display-name", id: "display-name", value: "Workspace 121", inputType: "text", hasValue: true, testId: "display-name",
      accessibleName: "Workspace name", label: "Workspace name", implicitRole: "textbox", context: FORM_SECTION,
      attributes: { id: "display-name", name: "displayName", type: "text", autocomplete: "organization", "aria-describedby": "display-name-hint", "data-testid": "display-name" }
    },
    { tagName: "label", selector: "body > main > form > section:nth-of-type(1) > label", text: "Workspace name", visibleText: "Workspace name", accessibleName: "Workspace name", context: FORM_SECTION, attributes: { for: "display-name" } },
    { tagName: "h2", selector: "#general-heading", text: "General", visibleText: "General", id: "general-heading", accessibleName: "General", implicitRole: "heading", context: { ...FORM_SECTION, heading: "Workspace settings" }, attributes: { id: "general-heading" } },
    { tagName: "h2", selector: "#advanced-heading", text: "Advanced", visibleText: "Advanced", id: "advanced-heading", accessibleName: "Advanced", implicitRole: "heading", context: { ...ADVANCED_SECTION, heading: "General" }, attributes: { id: "advanced-heading" } },
    { tagName: "p", selector: "#display-name-hint", text: "Shown in the sidebar and on invitations.", visibleText: "Shown in the sidebar and on invitations.", id: "display-name-hint", implicitRole: "paragraph", context: FORM_SECTION, attributes: { id: "display-name-hint" } },
    { tagName: "h1", selector: "body > main > header > h1", text: "Workspace settings", visibleText: "Workspace settings", accessibleName: "Workspace settings", implicitRole: "heading", context: { landmark: "banner" } },
    { tagName: "p", selector: "body > main > header > p", text: "Changes apply to everyone in this workspace.", visibleText: "Changes apply to everyone in this workspace.", implicitRole: "paragraph", context: { landmark: "banner", heading: "Workspace settings" } },
    { tagName: "p", selector: "body > main > form > section:nth-of-type(2) > p", text: "Your organization manages these settings; they are read-only here.", visibleText: "Your organization manages these settings; they are read-only here.", implicitRole: "paragraph", context: ADVANCED_SECTION },
    ...DEFINITION_LIST.map(([term], index) => listCell("dt", index, term)),
    ...DEFINITION_LIST.map(([, detail], index) => listCell("dd", index, detail)),
    { tagName: "p", selector: "body > main > form > footer > p", text: "Need something else? Ask a workspace owner.", visibleText: "Need something else? Ask a workspace owner.", implicitRole: "paragraph", context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Advanced" } },
    {
      tagName: "form", selector: "#settings-form", id: "settings-form", name: "Workspace settings", testId: "settings-form", accessibleName: "Workspace settings", implicitRole: "form",
      context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Workspace settings" },
      attributes: { id: "settings-form", "aria-label": "Workspace settings", "data-testid": "settings-form" }
    },
    {
      tagName: "div", selector: "[data-testid=\"primary-actions\"]", role: "group", name: "General actions", testId: "primary-actions", accessibleName: "General actions", context: FORM_SECTION,
      attributes: { class: "form-actions", "aria-label": "General actions", "data-testid": "primary-actions" }
    },
    {
      tagName: "footer", selector: "[data-testid=\"footer-actions\"]", role: "group", name: "Footer actions", testId: "footer-actions", accessibleName: "Footer actions", implicitRole: "contentinfo",
      context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Advanced" },
      attributes: { class: "form-footer", "aria-label": "Footer actions", "data-testid": "footer-actions" }
    },
    { tagName: "main", selector: "body > main", implicitRole: "main", context: { landmark: "main" } },
    { tagName: "header", selector: "body > main > header", implicitRole: "banner", context: { landmark: "banner" } },
    { tagName: "section", selector: "body > main > form > section:nth-of-type(1)", accessibleName: "General", implicitRole: "region", context: { ...FORM_SECTION, heading: "Workspace settings" }, attributes: { "aria-labelledby": "general-heading" } },
    { tagName: "section", selector: "body > main > form > section:nth-of-type(2)", accessibleName: "Advanced", implicitRole: "region", context: { ...ADVANCED_SECTION, heading: "General" }, attributes: { class: "advanced", "aria-labelledby": "advanced-heading" } },
    { tagName: "dl", selector: "body > main > form > section:nth-of-type(2) > dl", context: ADVANCED_SECTION }
  ],
  evidence: {
    elements: { scanned: 37, candidates: 35, matched: 27, returned: 27, truncated: false, changed: 0, recentlyInteracted: 0 },
    loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
    navigation: { url: "http://127.0.0.1:4173/scenarios/identity-drift/", origin: "http://127.0.0.1:4173", path: "/scenarios/identity-drift/", type: "navigate", historyLength: 2, visibility: "visible" },
    regions: [
      { role: "main", selector: "body > main", bounds: { x: 256, y: 32, width: 768, height: 1213.16 } },
      { role: "banner", selector: "body > main > header", bounds: { x: 256, y: 32, width: 768, height: 93.44 } },
      { role: "form", selector: "#settings-form", label: "Workspace settings", bounds: { x: 256, y: 145.34, width: 768, height: 1059.81 } },
      { role: "region", selector: "body > main > form > section:nth-of-type(1)", label: "General", bounds: { x: 256, y: 145.34, width: 768, height: 207.91 } },
      { role: "region", selector: "body > main > form > section:nth-of-type(2)", label: "Advanced", bounds: { x: 256, y: 373.16, width: 768, height: 792 } }
    ],
    forms: [{
      selector: "#settings-form", label: "Workspace settings", controlCount: 3,
      controls: [
        { selector: "#display-name", controlType: "text", name: "displayName", label: "Workspace name", required: true, hasValue: true, autocomplete: "organization" },
        { selector: RENAMED_SAVE_SELECTOR, controlType: "submit", label: "Apply changes" },
        { selector: "#discard-settings", controlType: "reset", label: "Discard changes" }
      ],
      submit: RENAMED_SAVE_SELECTOR
    }]
  },
  focusedElement: { tagName: "body", selector: "body" }
};

const failurePacket = () => sanitizeWebLlmSnapshotWithBindings(capturedRenamedRedesign, {
  budget: "failure",
  failedAction: { repairParameters: webFailureRepairParameters({ definitionId: "builtin.policy.action" }) }
});
const clickAction = { nodeId: "save-changes", definitionId: "web.output.dom-click" };
const override = (handle: string) => ({ handles: { element: handle } });

test("the failure packet shows the renamed Save as the page's one submit control, by its accessible name and never by selector", () => {
  const { evidence, selectors } = failurePacket();
  assert.equal(evidence.failedTargetUnknown, true);
  // The key a repair fills is named, and the packet still fits Core's gate with it.
  assert.deepEqual(Object.keys(evidence.repairParameters ?? {}), ["element"]);
  assert.ok(Buffer.byteLength(JSON.stringify(evidence), "utf8") <= 3_000);
  const submits = evidence.elements.filter((element) => element.controlType === "submit");
  // Named by its accessible name; the visible text is the same words, so it is not repeated.
  assert.deepEqual(submits, [{ target: "target.2", tag: "button", name: "Apply changes", controlType: "submit", form: "settings-form", landmark: "region", heading: "General" }]);
  // Beside it, the one other button a click could land on is the reset.
  assert.deepEqual(evidence.elements.filter((element) => element.tag === "button").map((element) => [element.name, element.controlType]), [["Discard changes", "reset"], ["Apply changes", "submit"]]);
  // Nothing on the page is called what the recording called Save.
  assert.doesNotMatch(JSON.stringify(evidence), /Save changes/);
  // The packet carries the handle, the binding keeps the selector, and no value leaves.
  assert.equal(selectors.get("target.2"), RENAMED_SAVE_SELECTOR);
  assert.doesNotMatch(JSON.stringify(evidence), /main > form|#display-name|Workspace 121/);
});

test("accepts an override naming the renamed Save, and resolves it fingerprint first", () => {
  const { evidence, selectors } = failurePacket();
  const resolvedSave = {
    status: "resolved",
    target: {
      handles: { element: "target.2" },
      handleResolution: "named",
      tagName: "button",
      // The accessible name, which Core's matcher weighs above visible text. The
      // packet omits visible text that repeats the name, so the fingerprint does too.
      accessibleName: "Apply changes",
      selector: RENAMED_SAVE_SELECTOR,
      metadata: { controlType: "submit", formId: "settings-form" }
    }
  };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.2"), clickAction, selectors), resolvedSave);
  // The same repair as the live lane asks for it: a recorded click, named by
  // the output its policy node dispatches.
  const recordedClick = { nodeId: "save-changes", definitionId: "builtin.policy.action", outputId: "web.dom.click" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.2"), recordedClick, selectors), resolvedSave);
});

test("refuses an override naming a handle it was never shown, or anything on the page a click cannot use", () => {
  const { evidence, selectors } = failurePacket();
  // Three controls a click can use are described -- Discard, the renamed Save
  // and the text field -- so a handle that resolves to none of them has no
  // single compatible element to fall back to, and is refused as ambiguous.
  // Core's preflight turns that into "ambiguous in current sanitized evidence".
  const clickable = evidence.elements.filter((element) => elementFillsRepairableParameter(element, "clickable")).map((element) => element.target);
  assert.deepEqual(clickable, ["target.1", "target.2", "target.3"]);
  const unpressable = evidence.elements.filter((element) => !clickable.includes(element.target)).map((element) => element.target);
  assert.ok(unpressable.length > 0, "the packet described nothing a click cannot use");
  for (const handle of ["save-changes", "#save-settings", "Save changes", "target.0", "target.99"]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), clickAction, selectors), { status: "ambiguous", reason: "handle_not_issued" }, handle);
  }
  for (const handle of unpressable) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), clickAction, selectors), { status: "ambiguous", reason: "handle_incompatible" }, handle);
  }
  // An invented parameter is refused whatever handle rides with it.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { handles: { element: "target.2", button: "target.2" } }, clickAction, selectors), { status: "absent", reason: "parameter_not_offered" });
});

test("does not tell a pressable wrong control from Save: Discard, named by its own handle, is accepted as Discard", () => {
  const { evidence, selectors } = failurePacket();
  // The check proves the model was shown the control and that a click can use
  // it, not that it is the right one. Discard and the text field both pass it,
  // each resolved to its own fingerprint and never to Save's, so what stops a
  // run that presses one is the scenario's oracle, not this check.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), clickAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "button",
      accessibleName: "Discard changes",
      selector: "#discard-settings",
      metadata: { controlType: "reset", formId: "settings-form" }
    }
  });
  const textField = validateWebRuntimeTargetOverrideEvidence(evidence, override("target.3"), clickAction, selectors);
  assert.equal(textField.status, "resolved");
  assert.deepEqual(textField.status === "resolved" ? [textField.target.tagName, textField.target.selector] : undefined, ["input", "#display-name"]);
});
