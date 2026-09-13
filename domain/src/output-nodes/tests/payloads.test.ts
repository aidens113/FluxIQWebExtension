// T1 coverage of the recorded-payload mapping for `web.dom.check`, the one
// action added in Week 1 that a recorded user event produces.
//
// The rule under test: a toggle replays only when the recording says which
// state it was left in. A checkbox's recorded value is its `value` attribute
// ("on" by default), not its checked state, so guessing from it would invert
// the user's action half the time.
//
// Also covered here: a file choice (`web.dom.upload`), a tab switch or close
// (`web.browser.tab`), and a child frame's document path, the three recorded
// payloads the twenty-eighth dispatch added (P5, P4 and P6).

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationOutputPayload } from "../payloads";

const checkbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
const radio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };

test("a checkbox with a recorded checked state maps to that state", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true }, inputValue: "on" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: false }, inputValue: "on" }).checked, false);
});

test("a checkbox with no recorded state carries no state, rather than a guess", () => {
  const parameters = webAutomationOutputPayload("web.dom.check", { element: checkbox, inputValue: "on" });
  assert.equal("checked" in parameters, false, "the recorded value 'on' is the value attribute, not the checked state");
  assert.equal(parameters.selector, "input#terms", "the target is still recorded");
});

test("a custom control's aria-checked is a recorded state", () => {
  const widget = { selector: "#toggle", tagName: "div", role: "switch", attributes: { "aria-checked": "true" } };
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: widget }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...widget, attributes: { "aria-checked": "false" } } }).checked, false);
});

test("a radio needs no recorded state: its change can only mean selected", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: radio, inputValue: "team" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { selector: "#r", tagName: "div", role: "radio" } }).checked, true);
});

test("a check keeps the fingerprint and visual target replay falls back on", () => {
  const visualTarget = { namespace: "web", statePath: "web.elements.terms", selector: "input#terms" };
  const parameters = webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true, xpath: "/html/body/form/input" }, visualTarget });
  assert.equal((parameters.element as { xpath?: string }).xpath, "/html/body/form/input");
  assert.deepEqual(parameters.visualTarget, visualTarget);
});

test("the dispatch-only actions have no recorded payload", () => {
  // None of these is produced by a recorded user event: they are authored, or
  // driven by a Flow. Their parameters come from the node, not from a mapping.
  for (const outputId of ["web.dom.assert", "web.dom.extract_list", "web.dom.dialog", "web.browser.download"]) {
    assert.deepEqual(webAutomationOutputPayload(outputId, { element: checkbox, inputValue: "on" }), {}, outputId);
  }
});

// -- The frame the interaction was recorded in --------------------------------
// `client/gateway-mapping.ts` writes `browserFrameId` onto the recorded event
// and `client/gateway-action-parameters.ts` lifts it back onto
// `action.frameId`. This is the middle link: without it a click recorded in an
// iframe replays against the top document.

test("a DOM action carries the frame it was recorded in", () => {
  const recorded = { element: { ...checkbox, checked: true }, inputValue: "on", browserFrameId: 3 };
  assert.equal(webAutomationOutputPayload("web.dom.check", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.click", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.scroll", { scroll: { x: 0, y: 640 }, browserFrameId: 3 }).browserFrameId, 3);
});

test("frame 0 is the top document, and is carried as a frame rather than dropped", () => {
  assert.equal(webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId: 0 }).browserFrameId, 0);
});

test("a frame id that is not a frame is dropped rather than replayed", () => {
  for (const browserFrameId of [-1, 1.5, "3", null, undefined]) {
    const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId } as never);
    assert.equal("browserFrameId" in parameters, false, JSON.stringify(browserFrameId));
  }
});

test("a browser-scoped action acts on the tab, so it takes no frame", () => {
  // A navigation, a tab operation and a download are run by the worker against
  // the tab; routing one into a child frame would address the wrong thing.
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.navigate", { url: "https://example.test", browserFrameId: 3 }), false);
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.tab", { browserFrameId: 3 }), false);
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close" }, browserFrameId: 3 }), false);
});

test("an unexecutable event stays empty rather than becoming a command carrying only a frame", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.assert", { element: checkbox, browserFrameId: 3 }), {});
  assert.deepEqual(webAutomationOutputPayload("web.dom.capture_snapshot", { browserFrameId: 3 }), {});
});

// -- A child frame's document path (P6) ---------------------------------------
// Chrome renumbers a frame when it navigates, so a recorded child-frame id can
// name no frame on replay. The path finds the same document again; the lift
// puts it on `action.frameUrlPath`.

test("a child-frame action also carries its frame's URL path, and nothing else of the URL", () => {
  const url = "http://127.0.0.1:5174/scenarios/iframe-checkout/payment?session=tok-123#card";
  const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, url, browserFrameId: 4 });
  assert.equal(parameters.browserFrameId, 4, "the id still travels, as the tie-break");
  assert.equal(parameters.browserFrameUrlPath, "/scenarios/iframe-checkout/payment");
  const serialized = JSON.stringify(parameters);
  for (const leaked of ["127.0.0.1", "5174", "http:", "session", "tok-123", "card"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
});

test("a child frame whose document is not http(s) gains no path", () => {
  for (const url of ["about:blank", "about:srcdoc", "blob:https://example.test/1", "not a url", undefined]) {
    const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, url, browserFrameId: 4 } as never);
    assert.equal(parameters.browserFrameId, 4, String(url));
    assert.equal("browserFrameUrlPath" in parameters, false, String(url));
  }
});

test("every top-frame node's parameters are byte-identical to what they were before the frame path", () => {
  // Written out as JSON rather than recomputed, so a key added to a top-frame
  // node, or a key reordered, fails here. Each is the output of the code path
  // this change left alone for frame 0 and for an event with no frame.
  const url = "https://example.test/checkout?session=tok-123";
  const pay = { selector: "#pay", tagName: "button", id: "pay" };
  const email = { selector: "#email", tagName: "input", inputType: "email", id: "email" };
  const plan = { selector: "select#plan", tagName: "select", id: "plan" };
  const exact: [string, Record<string, unknown>, string][] = [
    ["web.dom.click", { element: pay, url, browserFrameId: 0 }, "{\"selector\":\"#pay\",\"element\":{\"selector\":\"#pay\",\"id\":\"pay\",\"tagName\":\"button\"},\"browserFrameId\":0}"],
    ["web.dom.click", { element: pay, url }, "{\"selector\":\"#pay\",\"element\":{\"selector\":\"#pay\",\"id\":\"pay\",\"tagName\":\"button\"}}"],
    ["web.dom.type", { element: email, url, inputValue: "ada@example.test", browserFrameId: 0 }, "{\"selector\":\"#email\",\"text\":\"ada@example.test\",\"element\":{\"selector\":\"#email\",\"id\":\"email\",\"tagName\":\"input\",\"inputType\":\"email\"},\"browserFrameId\":0}"],
    ["web.dom.clear", { element: email, url, browserFrameId: 0 }, "{\"selector\":\"#email\",\"element\":{\"selector\":\"#email\",\"id\":\"email\",\"tagName\":\"input\",\"inputType\":\"email\"},\"browserFrameId\":0}"],
    ["web.dom.select", { element: plan, url, inputValue: "team", browserFrameId: 0 }, "{\"selector\":\"select#plan\",\"value\":\"team\",\"element\":{\"selector\":\"select#plan\",\"id\":\"plan\",\"tagName\":\"select\"},\"browserFrameId\":0}"],
    ["web.dom.keypress", { element: email, url, key: "Enter", browserFrameId: 0 }, "{\"selector\":\"#email\",\"key\":\"Enter\",\"element\":{\"selector\":\"#email\",\"id\":\"email\",\"tagName\":\"input\",\"inputType\":\"email\"},\"browserFrameId\":0}"],
    ["web.dom.scroll", { url, scroll: { x: 0, y: 640 }, browserFrameId: 0 }, "{\"x\":0,\"y\":640,\"browserFrameId\":0}"],
    ["web.dom.check", { element: { ...checkbox, checked: true }, url, inputValue: "on", browserFrameId: 0 }, "{\"selector\":\"input#terms\",\"checked\":true,\"element\":{\"selector\":\"input#terms\",\"id\":\"terms\",\"tagName\":\"input\",\"inputType\":\"checkbox\",\"checked\":true},\"browserFrameId\":0}"]
  ];
  for (const [outputId, recorded, json] of exact) {
    assert.equal(JSON.stringify(webAutomationOutputPayload(outputId, recorded as never)), json, outputId);
  }
});

// -- A file choice (P5) -------------------------------------------------------
// The node asks for the files at run time (`upload-binding.ts`); the recording
// holds nothing of them that may travel.

/** A file input as the recorder described one before it stopped reading `value`: the value is Chrome's fake path. */
const fileInput = { selector: "#attachment", tagName: "input", inputType: "file", id: "attachment", value: "C:\\fakepath\\tax-return-2025.pdf" };

test("a file choice asks for its files through an upload request with no fallback", () => {
  const parameters = webAutomationOutputPayload("web.dom.upload", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf" });
  assert.deepEqual(parameters.upload, { $state: { path: "web.upload.attachment" } });
  assert.equal(parameters.selector, "#attachment");
  assert.equal((parameters.element as { inputType?: string }).inputType, "file", "the fingerprint replay falls back on is kept");
});

test("no recorded file name, count or content appears anywhere in an upload's parameters", () => {
  const parameters = webAutomationOutputPayload("web.dom.upload", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf", url: "https://example.test/upload?session=tok-123", browserFrameId: 0 });
  const serialized = JSON.stringify(parameters);
  for (const leaked of ["tax-return", "fakepath", ".pdf", "files", "contentBase64", "session"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
  assert.equal("value" in (parameters.element as object), false, "a file input's value is its file name");
});

test("a file choice with no identity to key a request on builds nothing", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.upload", { element: { tagName: "input", inputType: "file" } }), {});
});

// -- A tab switch or close (P4) -----------------------------------------------
// Replayed through `web.browser.tab`, named by path: tab ids do not survive to a
// replay, origins differ run to run, and a query may carry tokens.

test("a recorded tab switch carries its exact path, and a close carries only its operation", () => {
  assert.deepEqual(
    webAutomationOutputPayload("web.browser.tab", { url: "http://127.0.0.1:4173/scenarios/multi-tab/details?id=7", tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }),
    { tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }
  );
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close" } }), { tab: { operation: "close" } });
});

test("tab parameters carry the pathname only, never an origin, a query or a tab id", () => {
  const extras = { operation: "switch", urlPath: "/list", tabId: 41, url: "http://127.0.0.1:4173/list?session=tok-123" };
  const serialized = JSON.stringify(webAutomationOutputPayload("web.browser.tab", { url: "http://127.0.0.1:4173/list?session=tok-123", browserTabId: 41, tab: extras }));
  for (const leaked of ["127.0.0.1", "4173", "http:", "session", "tok-123", "41", "tabId"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close", tabId: 41, urlPath: "/list" } }), { tab: { operation: "close" } }, "a close names nothing, even when the recorded change carried more");
});

test("a switch whose path is not a bare pathname is built without one, never trimmed into one", () => {
  for (const urlPath of ["http://127.0.0.1:4173/list", "/list?session=tok-123", "/list#top", "list", "", 7, undefined]) {
    assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "switch", urlPath } } as never), { tab: { operation: "switch" } }, String(urlPath));
  }
});

test("the recording-start marker, which has no tab, builds nothing", () => {
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { url: "https://example.test/start", title: "Start", recordingState: "started" }), {});
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "open", urlPath: "/start" } }), {}, "an operation a recording never produces builds nothing");
});

// -- A value the recorder withheld --------------------------------------------
// The request itself, and Core's handling of it, are covered in
// `secret-binding.test.ts`. What belongs here is the branch this file owns:
// which recorded entries ask for a value, and which still carry one.

test("only a control the sensitivity rule marks asks for a withheld value", () => {
  // The rule in `domain/src/sensitivity` is the single authority over which
  // controls hold a secret. A missing value on any other control is a recorder
  // fault, not a secret nobody declared, and inventing a request for it would
  // put a node into a Flow asking the operator for something no manifest names.
  const plain = { selector: "input#nickname", tagName: "input", inputType: "text", id: "nickname" };
  assert.equal(webAutomationOutputPayload("web.dom.type", { element: plain }).text, "");
  const marked = { ...plain, inputType: "password" };
  assert.notEqual(webAutomationOutputPayload("web.dom.type", { element: marked }).text, "");
});

test("a withheld value is asked for by every route the rule recognizes, not only by input type", () => {
  // `autocomplete` is a token list, and a card field is spelled `billing
  // cc-number` in the wild -- the case a duplicated copy of this rule once
  // missed, leaking a card number. The rule is asked, never restated.
  for (const element of [
    { selector: "#pw", attributes: { type: "password" } },
    { selector: "#otp", attributes: { autocomplete: "one-time-code" } },
    { selector: "#card", attributes: { autocomplete: "billing cc-number" } },
    { selector: "#custom", attributes: { "data-sensitive": "true" } }
  ]) {
    assert.notEqual(webAutomationOutputPayload("web.dom.type", { element }).text, "", element.selector);
  }
});
