import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "..";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";
import { WEB_LLM_WITHHELD_TEXT } from "../withheld";

test("sanitizes extension snapshots: a secret control is dropped, a URL's secrets are withheld, the rest is carried whole", () => {
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
    schemaVersion: "web-llm-evidence.v2", trust: "untrusted-page-evidence", location: "https://example.test/form?token=(withheld)#secret", title: "Example",
    truncated: false,
    elements: [
      // A text field's own value is carried when the capture read it; a
      // password field is not described at all.
      { target: "t1", tag: "input", name: "Name", attributes: [["type", "text"]], value: "Ada" },
      { target: "t2", tag: "a", text: "Next", href: "https://example.test/next?ticket=(withheld)" },
      // Another origin's link is the page's too.
      { target: "t3", tag: "a", text: "Away", href: "https://outside.test/" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(evidence), /private|Password/u);
});

test("retains semantic labels, types, attributes, select options and result text needed for instruction-only generation", () => {
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
    { target: "t1", tag: "input", name: "Name", attributes: [["autocomplete", "off"]], hasValue: true, value: "Ada" },
    { target: "t2", tag: "select", name: "Plan", selectedValue: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
    { target: "t3", tag: "button", name: "Submit", attributes: [["type", "submit"]], controlType: "submit" },
    { target: "t4", tag: "p", text: "Not submitted", attributes: [["aria-live", "polite"]] },
  ]);
});

test("exposes non-secret completion state and never a sensitive control's", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#notes", hasValue: true, value: "my notes" },
      { tagName: "input", selector: "#hidden", inputType: "hidden", hasValue: true, value: "private hidden" },
      { tagName: "select", selector: "#plan", selectedValue: "unlisted", options: [{ value: "team", label: "Team" }] },
      { tagName: "select", selector: "#secret", selectedValue: "team", options: [{ value: "team", label: "Team" }], attributes: { "data-sensitive": "true" } },
    ],
  });
  assert.deepEqual(evidence.elements, [
    { target: "t1", tag: "textarea", hasValue: true, value: "my notes" },
    // Not a field anybody types into, so what it holds is not carried.
    { target: "t2", tag: "input", inputType: "hidden" },
    { target: "t3", tag: "select", options: [{ value: "team", label: "Team" }] },
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /private|unlisted|data-sensitive/u);
});

test("carries the page selection whole and marks the focused element, but never announces a focused secret", () => {
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
  assert.deepEqual(focusedField.elements.map((element) => [element.target, element.focused]), [["t1", true], ["t2", undefined]]);

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
  assert.equal(longSelection.selectedText?.length, 5_000);
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
      target: "t1", tag: "button", name: "Add to cart",
      form: "checkout", landmark: "main", heading: "Recommended for you", item: { index: 3, total: 24 },
    },
    { target: "t2", tag: "td", text: "48.00", landmark: "main", heading: "Order summary", cell: { row: 2, column: 4, header: "Total" } },
    // The heading only repeats the control's own name, so it is not said twice.
    { target: "t3", tag: "input", name: "Coupon", form: "discount" },
  ]);
});

test("reports child-frame elements with a selector that works inside the frame and the frame that owns it", () => {
  const page = {
    url: "https://example.test/checkout",
    frame: { isTop: true },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3", "data-fluxiq-frame-url": "https://payments.example.test/f" } },
      { tagName: "input", selector: "#zip", name: "Postcode", attributes: { "data-fluxiq-frame-id": "7" } },
    ],
  };
  const evidence = sanitizeWebLlmSnapshot(page);
  assert.deepEqual(evidence.frame, { isTop: true, childFrameIds: [3, 7] });
  // The selector is the binding's, not the packet's: the packet names the
  // element `t2` and says which frame it belongs to, and the selector that
  // works inside that frame is what the domain kept behind.
  const bound = sanitizeWebLlmSnapshotWithBindings(page);
  assert.deepEqual(evidence.elements.map((element) => [element.target, element.frameId]), [
    ["t1", undefined],
    ["t2", 3],
    ["t3", 7],
  ]);
  assert.deepEqual([...bound.selectors], [["t1", "#place-order"], ["t2", "#card-name"], ["t3", "#zip"]]);
  assert.doesNotMatch(JSON.stringify(evidence), /frame\[3\]/u);
  // The frame stamp is the extension's own, not the page's, so it is not
  // published among the element's attributes; the frame's address is.
  assert.deepEqual(evidence.elements[1]?.attributes, [["data-fluxiq-frame-url", "https://payments.example.test/f"]]);
  assert.equal(evidence.elements[2]?.attributes, undefined);
});

test("says the capture came from inside a child frame rather than presenting it as the whole page", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://payments.example.test/fields",
    frame: { isTop: false, viewportOffset: { x: 10, y: 20, width: 300, height: 200 } },
    interactiveElements: [{ tagName: "input", selector: "#card-number", name: "Card number" }],
  });
  assert.deepEqual(evidence.frame, { isTop: false });
});

test("carries all fifty of a fifty-element page, a text that repeats the name said once", () => {
  const interactiveElements = Array.from({ length: 50 }, (_, index) => ({
    tagName: "button",
    selector: `[data-component="global-navigation-item-${index}"][data-instance="${"x".repeat(72)}"]`,
    name: `Open workspace section ${index}`,
    visibleText: `Open workspace section ${index}`,
    attributes: { type: "button" },
  }));
  const evidence = sanitizeWebLlmSnapshot({ url: "https://example.test/workspace", title: "Workspace", interactiveElements });
  const compactBytes = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  const legacyBytes = new TextEncoder().encode(JSON.stringify({ ...evidence, elements: evidence.elements.map((element) => ({ ...element, text: element.name })) })).byteLength;
  assert.equal(evidence.elements.length, 50);
  assert.equal(evidence.truncated, false);
  assert.equal(compactBytes < legacyBytes, true, `compact ${compactBytes} bytes versus duplicate-semantic ${legacyBytes} bytes`);
  // Each element is individually addressable by its opaque handle, in order.
  assert.deepEqual(evidence.elements.map((element) => element.target), interactiveElements.map((_, index) => `t${index + 1}`));
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

// A failure packet's one statement about its own target. The model is shown
// every element and asked to repair one action; without a mark it has to guess
// which element the action was aiming at. The mark is an opaque handle, so it
// names the element and addresses nothing.
test("a failure packet marks the failed action's element with its opaque handle, never with a selector", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay" } });
  assert.equal(evidence.failedTarget, "t2");
  assert.equal(evidence.elements[1]?.name, "Pay now", "the handle names the control the action addressed");
  assert.equal(evidence.failedTargetMissing, undefined);
  assert.equal(evidence.failedTargetUnknown, undefined);
  assert.doesNotMatch(JSON.stringify(evidence), /#pay|selector/u);
});

test("a failure packet whose target has left the page says so, rather than marking nothing", () => {
  const evidence = sanitizeWebLlmSnapshot(failurePage(), { failedAction: { selector: "#pay-now-v2" } });
  assert.equal(evidence.failedTarget, undefined);
  assert.equal(evidence.failedTargetMissing, true);
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
  assert.equal(marked.failedTarget, "t2");
  assert.deepEqual(marked.repairParameters, ELEMENT_PARAMETER);
  assert.doesNotMatch(JSON.stringify(marked), /#pay|selector/u);
});

test("an empty map says the failed action offers nothing to re-point, and no map says nothing at all", () => {
  assert.deepEqual(sanitizeWebLlmSnapshot(failurePage(), { failedAction: { repairParameters: {} } }).repairParameters, {});
  assert.equal("repairParameters" in sanitizeWebLlmSnapshot(failurePage(), { failedAction: {} }), false);
  assert.equal("repairParameters" in sanitizeWebLlmSnapshot(failurePage()), false);
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

// The binding's second handle-keyed map: every element that sits in a record
// has its record, and one that does not has none.
test("the records an element's address carries are kept for exactly the handles that sit in one", () => {
  const row = (index: number): Record<string, unknown> => ({
    tagName: "button",
    selector: `#rows > tr:nth-of-type(${index}) > td > button`,
    accessibleName: `Reply to conversation ${index}`,
    context: { record: { keyAttribute: "data-conversation-id", key: `cnv_${index}` } }
  });
  const page = { url: "https://fixture.test/inbox", title: "Inbox", interactiveElements: [{ tagName: "button", selector: "#compose", name: "Compose" }, ...[1, 2, 3, 4, 5, 6].map(row)] };

  const whole = sanitizeWebLlmSnapshotWithBindings(page);
  assert.equal(whole.records.has("t1"), false, "the compose button sits in no record");
  assert.deepEqual([...whole.records.keys()], ["t2", "t3", "t4", "t5", "t6", "t7"]);
  assert.notEqual(whole.records.get("t2"), whole.records.get("t3"));
  assert.equal(whole.evidence.elements.length, 7);
});

// The structure the page view folds by (t223): an element's own words, the
// handle of its nearest described ancestor, the hidden flag a search capture
// sets, and the window the capture was taken in.

const STRUCTURE_URL = "https://shop.test/results";

test("own words are carried screened, and an element with no words of its own says so with the empty string", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: STRUCTURE_URL,
    interactiveElements: [
      { tagName: "li", selector: "#card", visibleText: "Kettle $39.99", ownText: "" },
      { tagName: "p", selector: "#note", visibleText: "Ships today. Learn more", ownText: "  Ships   today. " },
      { tagName: "p", selector: "#card-number", visibleText: "Card 4111111111111111 on file. Change", ownText: "Card 4111111111111111 on file." },
      { tagName: "span", selector: "#plain", visibleText: "Plain" }
    ]
  });
  const [card, note, key, plain] = evidence.elements;
  assert.equal(card?.ownText, "", "an empty own text is kept: the card's words are its children's");
  assert.equal(note?.ownText, "Ships today.", "collapsed to one line, as every page string is");
  assert.equal(plain !== undefined && "ownText" in plain, false, "a capture that did not report own words leaves the field absent");
  assert.equal(key?.ownText, `Card ${WEB_LLM_WITHHELD_TEXT} on file.`, "own words pass the same secret screen as every string");
});

test("a parent index becomes the parent's handle, passing over an ancestor the packet does not describe", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: STRUCTURE_URL,
    interactiveElements: [
      { tagName: "form", selector: "#login" },
      // A sensitive control is never described, so it has no handle to name.
      { tagName: "input", selector: "#password", inputType: "password", parent: 0 },
      // Its listed child walks on up to the form.
      { tagName: "span", selector: "#hint", visibleText: "8 or more", parent: 1 },
      { tagName: "button", selector: "#go", visibleText: "Sign in", parent: 0 },
      // A malformed parent (not before its child) names nothing.
      { tagName: "span", selector: "#loop", visibleText: "Loop", parent: 9 }
    ]
  });
  assert.deepEqual(evidence.elements.map((element) => [element.target, element.parent]), [
    ["t1", undefined],
    ["t2", "t1"],
    ["t3", "t1"],
    ["t4", undefined]
  ]);
  assert.equal("parent" in (evidence.elements[0] ?? {}), false, "an absent parent is a missing key, not a key holding undefined");
});

test("a hidden element is flagged, and the rendered elements are numbered first so their handles do not move", () => {
  const rendered = [
    { tagName: "div", selector: "#results" },
    { tagName: "a", selector: "#first", visibleText: "First", href: "/first", parent: 0 },
    { tagName: "a", selector: "#second", visibleText: "Second", href: "/second", parent: 0 }
  ];
  const withHidden = [
    rendered[0],
    { tagName: "div", selector: "#menu", hidden: true, parent: 0 },
    { tagName: "a", selector: "#first", visibleText: "First", href: "/first", parent: 1 },
    { tagName: "input", selector: "#trap", hidden: true, parent: 0 },
    rendered[2]
  ];
  const plain = sanitizeWebLlmSnapshot({ url: STRUCTURE_URL, interactiveElements: rendered });
  const searched = sanitizeWebLlmSnapshot({ url: STRUCTURE_URL, interactiveElements: withHidden });
  assert.deepEqual(plain.elements.map((element) => element.target), ["t1", "t2", "t3"]);
  assert.deepEqual(searched.elements.map((element) => [element.target, element.hidden, element.parent]), [
    ["t1", undefined, undefined],
    ["t4", true, "t1"],
    // A rendered element inside a hidden one names the hidden one as its parent.
    ["t2", undefined, "t4"],
    ["t5", true, "t1"],
    ["t3", undefined, "t1"]
  ], "document order is kept; the handles of rendered elements are those of the ordinary capture");
});

test("the window the capture was taken in is carried whole, or not at all", () => {
  const measured = sanitizeWebLlmSnapshotWithBindings({
    url: STRUCTURE_URL,
    viewport: { width: 1280, height: 720.4, scrollX: 0, scrollY: 1440, documentWidth: 1280, documentHeight: 5000, devicePixelRatio: 2 },
    interactiveElements: []
  }).evidence;
  assert.deepEqual(measured.viewport, { width: 1280, height: 720, scrollX: 0, scrollY: 1440 });

  const partial = sanitizeWebLlmSnapshot({ url: STRUCTURE_URL, viewport: { width: 1280, height: 720 }, interactiveElements: [] });
  assert.equal("viewport" in partial, false, "a viewport without its scroll would put lines on the wrong side of the fold");
  const empty = sanitizeWebLlmSnapshot({ url: STRUCTURE_URL, viewport: { width: 0, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: [] });
  assert.equal("viewport" in empty, false);
});
