import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BOUNDS } from "..";

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
    schemaVersion: "web-llm-evidence.v1", trust: "untrusted-page-evidence", location: "https://example.test/form", title: "Example",
    // Four elements were captured and three are described: the packet says so
    // rather than letting the model conclude the form has no password field.
    elementTotal: 4, truncated: false,
    elements: [
      { target: "target.1", tag: "input", selector: "#name", name: "Name" },
      { target: "target.2", tag: "a", selector: "#next", text: "Next", href: "https://example.test/next" },
      { target: "target.3", tag: "a", selector: "#away", text: "Away" },
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
    { target: "target.1", tag: "input", selector: "[data-testid=instruction-name]", name: "Name", hasValue: true },
    { target: "target.2", tag: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
    { target: "target.3", tag: "button", selector: "[data-testid=instruction-submit]", name: "Submit", controlType: "submit" },
    { target: "target.4", tag: "p", selector: "[data-testid=result]", text: "Not submitted" },
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
    { target: "target.1", tag: "textarea", selector: "#notes", hasValue: false },
    { target: "target.2", tag: "input", selector: "#hidden", inputType: "hidden" },
    { target: "target.3", tag: "select", selector: "#plan", options: [{ value: "team", label: "Team" }] },
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
      target: "target.1", tag: "button", selector: "[data-testid=add-1]", name: "Add to cart",
      form: "checkout", landmark: "main", heading: "Recommended for you", item: { index: 3, total: 24 },
    },
    { target: "target.2", tag: "td", selector: "#row-2-total", text: "48.00", landmark: "main", heading: "Order summary", cell: { row: 2, column: 4, header: "Total" } },
    // The heading only repeats the control's own name, so it is not paid for twice.
    { target: "target.3", tag: "input", selector: "#coupon", name: "Coupon", form: "discount" },
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
  assert.deepEqual(evidence.elements.map((element) => [element.selector, element.frameId]), [
    ["#place-order", undefined],
    ["#card-name", 3],
    ["#zip", 7],
  ]);
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

test("deduplicates representative 50-element semantic evidence without dropping executable selectors", () => {
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
  assert.match(JSON.stringify(evidence), /selector/u);
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
