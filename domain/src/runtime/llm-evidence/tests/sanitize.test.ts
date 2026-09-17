import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BOUNDS } from "..";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";

test("sanitizes extension snapshots without values, sensitive controls, or URL secrets", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form?token=private#secret",
    title: "Example",
    interactiveElements: [
      { tagName: "input", selector: "#name", name: "Name", inputType: "text", value: "Ada", attributes: { type: "text" } },
      { tagName: "input", selector: "#password", name: "Password", inputType: "password", value: "private" },
      { tagName: "a", selector: "#next", visibleText: "Next", href: "/next?ticket=private" },
      { tagName: "a", selector: "#away", visibleText: "Away", href: "https://outside.test/" },
    ],
  });
  assert.deepEqual(evidence, {
    schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: "https://example.test/form", title: "Example",
    // Four elements were captured and three are described: the packet says so
    // rather than letting the model conclude the form has no password field.
    elementTotal: 4, truncated: false,
    elements: [
      { target: "target.1", tag: "input", name: "Name" },
      { target: "target.2", tag: "a", text: "Next", href: "https://example.test/next" },
      { target: "target.3", tag: "a", text: "Away" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(evidence), /Ada|private|token|ticket/u);
});

test("retains compact semantic labels, types, select options, and result text needed for instruction-only generation", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/scenarios/instruction-only-form/",
    title: "Instruction-only automation",
    interactiveElements: [
      { tagName: "input", selector: "[data-testid=instruction-name]", name: "Name", inputType: "text", hasValue: true, value: "Ada", attributes: { autocomplete: "off" } },
      { tagName: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", value: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
      { tagName: "button", selector: "[data-testid=instruction-submit]", name: "Submit", text: "Submit", attributes: { type: "submit" } },
      { tagName: "p", selector: "[data-testid=result]", text: "Not submitted", attributes: { "aria-live": "polite" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", name: "Name", hasValue: true },
    { target: "target.2", tag: "select", name: "Plan", selectedValue: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
    { target: "target.3", tag: "button", name: "Submit", controlType: "submit" },
    { target: "target.4", tag: "p", text: "Not submitted" },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /Ada/u);
});

test("exposes only bounded non-secret completion state", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#notes", hasValue: false, value: "private notes" },
      { tagName: "input", selector: "#hidden", inputType: "hidden", hasValue: true, value: "private hidden" },
      { tagName: "select", selector: "#plan", selectedValue: "unlisted", options: [{ value: "team", label: "Team" }] },
      { tagName: "select", selector: "#secret", selectedValue: "team", options: [{ value: "team", label: "Team" }], attributes: { "data-sensitive": "true" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "textarea", hasValue: false },
    { target: "target.2", tag: "input", inputType: "hidden" },
    { target: "target.3", tag: "select", options: [{ value: "team", label: "Team" }] },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /private|unlisted/u);
});

test("carries the page selection and marks the focused element, but never announces a focused secret", () => {
  const focusedField = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    selectedText: "  order  reference   4471  ",
    focusedElement: { tagName: "input", selector: "#email", name: "Email", inputType: "email" },
    interactiveElements: [
      { tagName: "input", selector: "#email", name: "Email", inputType: "email" },
      { tagName: "button", selector: "#continue", visibleText: "Continue" },
    ],
  });
  assert.equal(focusedField.selectedText, "order reference 4471");
  assert.deepEqual(focusedField.elements.map((element) => [element.target, element.focused]), [["target.1", true], ["target.2", undefined]]);

  const focusedSecret = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    focusedElement: { tagName: "input", selector: "#password", name: "Password", inputType: "password" },
    interactiveElements: [
      { tagName: "input", selector: "#password", name: "Password", inputType: "password" },
      { tagName: "button", selector: "#continue", visibleText: "Continue" },
    ],
  });
  assert.equal(focusedSecret.elements.some((element) => element.focused), false);
  assert.doesNotMatch(JSON.stringify(focusedSecret), /password|Password/u);

  const longSelection = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    selectedText: "s".repeat(5_000),
    interactiveElements: [{ tagName: "button", selector: "#continue", visibleText: "Continue" }],
  });
  assert.equal(longSelection.selectedText?.length, WEB_LLM_EVIDENCE_BOUNDS.text);
});

test("carries where an element sits: its form, landmark, heading, list position and table cell", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/catalog",
    interactiveElements: [
      {
        tagName: "button", selector: "[data-testid=add-1]", name: "Add to cart",
        context: { formId: "checkout", landmark: "main", heading: "Recommended for you", listPosition: { index: 3, total: 24 } },
      },
      {
        tagName: "td", selector: "#row-2-total", text: "48.00",
        context: { landmark: "main", heading: "Order summary", tablePosition: { row: 2, column: 4, columnHeader: "Total" } },
      },
      { tagName: "input", selector: "#coupon", name: "Coupon", context: { formName: "discount", heading: "Coupon" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    {
      target: "target.1", tag: "button", name: "Add to cart",
      form: "checkout", landmark: "main", heading: "Recommended for you", item: { index: 3, total: 24 },
    },
    { target: "target.2", tag: "td", text: "48.00", landmark: "main", heading: "Order summary", cell: { row: 2, column: 4, header: "Total" } },
    // The heading only repeats the control's own name, so it is not paid for twice.
    { target: "target.3", tag: "input", name: "Coupon", form: "discount" },
  ]);
});

test("reports child-frame elements with a selector that works inside the frame and the frame that owns it", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout",
    frame: { isTop: true },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3", "data-fluxiq-frame-url": "https://payments.example.test/f" } },
      { tagName: "input", selector: "#zip", name: "Postcode", attributes: { "data-fluxiq-frame-id": "7" } },
    ],
  });
  assert.deepEqual(evidence.frame, { isTop: true, childFrameIds: [3, 7] });
  // The selector is the binding's, not the packet's: the packet names the
  // element `target.2` and says which frame it belongs to, and the selector that
  // works inside that frame is what the domain kept behind.
  const bound = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/checkout",
    frame: { isTop: true },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3", "data-fluxiq-frame-url": "https://payments.example.test/f" } },
      { tagName: "input", selector: "#zip", name: "Postcode", attributes: { "data-fluxiq-frame-id": "7" } },
    ],
  });
  assert.deepEqual(evidence.elements.map((element) => [element.target, element.frameId]), [
    ["target.1", undefined],
    ["target.2", 3],
    ["target.3", 7],
  ]);
  assert.deepEqual([...bound.selectors], [["target.1", "#place-order"], ["target.2", "#card-name"], ["target.3", "#zip"]]);
  assert.doesNotMatch(JSON.stringify(evidence), /frame\[3\]/u);
});

test("says the capture came from inside a child frame rather than presenting it as the whole page", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://payments.example.test/fields",
    frame: { isTop: false, viewportOffset: { x: 10, y: 20, width: 300, height: 200 } },
    interactiveElements: [{ tagName: "input", selector: "#card-number", name: "Card number" }],
  });
  assert.deepEqual(evidence.frame, { isTop: false });
});

test("deduplicates representative 50-element semantic evidence without dropping what names each element", () => {
  const interactiveElements = Array.from({ length: 50 }, (_, index) => ({
    tagName: "button",
    selector: `[data-component="global-navigation-item-${index}"][data-instance="${"x".repeat(72)}"]`,
    name: `Open workspace section ${index}`,
    visibleText: `Open workspace section ${index}`,
    attributes: { type: "button" },
  }));
  const evidence = sanitizeWebLlmSnapshot({ url: "https://example.test/workspace", title: "Workspace", interactiveElements }, { maxEvidenceBytes: 12_000 });
  const compactBytes = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  const legacyBytes = new TextEncoder().encode(JSON.stringify({ ...evidence, elements: evidence.elements.map((element) => ({ ...element, text: element.name })) })).byteLength;
  assert.equal(evidence.elements.length, 40);
  assert.equal(evidence.elementTotal, 50);
  assert.equal(evidence.truncated, true);
  assert.equal(compactBytes <= 10_500, true, `compact evidence used ${compactBytes} bytes`);
  assert.equal(compactBytes < legacyBytes, true, `compact ${compactBytes} bytes versus duplicate-semantic ${legacyBytes} bytes`);
  // Each element is still individually addressable -- by its opaque handle,
  // which is what replaced the 100-character selector that used to be repeated
  // fifty times and is most of why the packet got smaller.
  assert.deepEqual(evidence.elements.map((element) => element.target).slice(0, 3), ["target.1", "target.2", "target.3"]);
  assert.doesNotMatch(JSON.stringify(evidence), /selector|data-component/u);
});

test("rejects a snapshot that is malformed or off the origin the caller expected", () => {
  assert.throws(() => sanitizeWebLlmSnapshot("not a snapshot"), /must be an object/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "https://example.test/", interactiveElements: "many" }), /elements are malformed/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "ftp://example.test/", interactiveElements: [] }), /HTTP\(S\) URL/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "https://user:secret@example.test/", interactiveElements: [] }), /HTTP\(S\) URL/u);
  assert.throws(
    () => sanitizeWebLlmSnapshot({ url: "https://elsewhere.test/", interactiveElements: [] }, { expectedOrigin: "https://example.test" }),
    /escaped the expected origin/u
  );
});

// A failure packet's one statement about its own target. The model is shown up
// to forty elements and asked to repair one action; without a mark it has to
// guess which element the action was aiming at. The mark is an opaque handle,
// so it names the element and addresses nothing.
test("a failure packet marks the failed action's element with its opaque handle, never with a selector", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay" } });
  assert.equal(evidence.failedTarget, "target.2");
  assert.equal(evidence.elements[1]?.name, "Pay now", "the handle names the control the action addressed");
  assert.equal(evidence.failedTargetMissing, undefined);
  assert.equal(evidence.failedTargetUnknown, undefined);
  assert.doesNotMatch(JSON.stringify(evidence), /#pay|selector/u);
});

test("a failure packet whose target has left the page says so, rather than marking nothing", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay-now-v2" } });
  assert.equal(evidence.failedTarget, undefined);
  assert.equal(evidence.failedTargetMissing, true);
  assert.equal(evidence.budgetTruncated, undefined, "nothing was trimmed, so the control is gone rather than cut");
});

test("a failure packet whose producer named no control says that, and it is not the same as the control being gone", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: {} });
  assert.equal(evidence.failedTargetUnknown, true);
  assert.equal(evidence.failedTargetMissing, undefined);
  assert.equal(evidence.failedTarget, undefined);
});

test("a packet that is not describing a failure marks no target at all", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage());
  assert.equal(evidence.failedTarget, undefined);
  assert.equal(evidence.failedTargetMissing, undefined);
  assert.equal(evidence.failedTargetUnknown, undefined);
});

test("a handle the byte budget trimmed away becomes a missing target rather than pointing at nothing", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay" }, maxEvidenceBytes: 260 });
  assert.equal(evidence.budgetTruncated, true);
  assert.equal(evidence.failedTarget, undefined, "the element it named was popped");
  assert.equal(evidence.failedTargetMissing, true);
  assert.ok(!evidence.elements.some((element) => element.name === "Pay now"));
});

// A failure packet's other statement: which keys a target override fills. Core
// tells the model to fill one handle per repairable parameter the evidence
// offers, so a packet that offered none left the model to guess the key, and a
// correct live repair was refused for guessing wrong (`run-mu4tfxld-e78debce`).
const ELEMENT_PARAMETER = { element: "the target handle of the one element the failed action should act on instead" };

test("a failure packet names the parameters a repair fills, as a copy of what the producer gave", () => {
  const repairParameters = { ...ELEMENT_PARAMETER };
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters } });
  assert.deepEqual(evidence.repairParameters, ELEMENT_PARAMETER);
  assert.equal(evidence.failedTargetUnknown, true, "naming the parameters is not naming the control");
  repairParameters.element = "changed afterwards";
  assert.deepEqual(evidence.repairParameters, ELEMENT_PARAMETER);
  // Beside a marked control as well.
  const marked = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay", repairParameters: ELEMENT_PARAMETER } });
  assert.equal(marked.failedTarget, "target.2");
  assert.deepEqual(marked.repairParameters, ELEMENT_PARAMETER);
  assert.doesNotMatch(JSON.stringify(marked), /#pay|selector/u);
});

test("an empty map says the failed action offers nothing to re-point, and no map says nothing at all", () => {
  assert.deepEqual(sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters: {} } }).repairParameters, {});
  assert.equal("repairParameters" in sanitizeWebLlmSnapshot(failurePage(), { failedAction: {} }), false);
  assert.equal("repairParameters" in sanitizeWebLlmSnapshot(failurePage()), false);
});

test("the parameters are paid for inside the budget, and given up only after the page facts", () => {
  const generous = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters: ELEMENT_PARAMETER } });
  const generousBytes = Buffer.byteLength(JSON.stringify(generous), "utf8");
  assert.equal(generous.budgetTruncated, undefined);
  // One byte short: an element goes, the parameters stay, and it fits.
  const tight = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters: ELEMENT_PARAMETER }, maxEvidenceBytes: generousBytes - 1 });
  assert.ok(Buffer.byteLength(JSON.stringify(tight), "utf8") <= generousBytes - 1);
  assert.equal(tight.budgetTruncated, true);
  assert.equal(tight.elements.length, 1);
  assert.deepEqual(tight.repairParameters, ELEMENT_PARAMETER);
  // A budget the parameters cannot fit beside even one element: the page facts
  // go first, then the parameters, and the one element is kept.
  const oversized = { element: `the target handle ${"x".repeat(400)}` };
  const starved = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters: oversized }, maxEvidenceBytes: 300 });
  assert.ok(Buffer.byteLength(JSON.stringify(starved), "utf8") <= 300);
  assert.equal(starved.repairParameters, undefined);
  assert.equal(starved.title, undefined);
  assert.equal(starved.elements.length, 1);
  assert.equal(starved.budgetTruncated, true);
});

function failurePage(): Record<string, unknown> {
  return {
    url: "https://fixture.test/checkout",
    title: "Checkout",
    interactiveElements: [
      { tagName: "a", selector: "#basket", visibleText: "Basket", href: "/basket" },
      { tagName: "button", selector: "#pay", role: "button", name: "Pay now" },
    ],
  };
}
