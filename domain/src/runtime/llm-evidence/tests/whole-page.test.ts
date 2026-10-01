// The packet is the whole page (t200). The user's order of 2026-09-30: "Remove
// ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT HIDE
// INFORMATION OR USE ANY RANKING ALGORITHM." These hold that nothing between a
// capture and the packet caps, ranks or cuts anything -- and that the secret
// screens that replaced the cuts still withhold what they must.

import assert from "node:assert/strict";
import test from "node:test";
import { screenAutomationStudioLlmEvidence } from "fluxiq/automation-studio";
import { sanitizeWebLlmSnapshot, WEB_LLM_DENIED_EVIDENCE_KEYS, WEB_LLM_WITHHELD_TEXT } from "..";
import { secretParameterName } from "../location";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
const API_KEY = "sk-live0123456789abcdefghijKLMN";

const page = (interactiveElements: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  url: "https://shop.test/results",
  title: "Results",
  interactiveElements,
  ...extra
});

test("5,000 elements in are 5,000 elements out, in the capture's order", () => {
  const raw = Array.from({ length: 5_000 }, (_, index) => ({ tagName: index % 2 ? "span" : "button", selector: `#e${index}`, visibleText: `Element ${index}` }));
  const bound = sanitizeWebLlmSnapshotWithBindings(page(raw));
  assert.equal(bound.evidence.elements.length, 5_000);
  assert.equal(bound.evidence.truncated, false);
  assert.deepEqual(bound.evidence.elements.map((element) => element.text), raw.map((element) => element.visibleText));
  assert.deepEqual(bound.evidence.elements.map((element) => element.target), raw.map((_, index) => `target.${index + 1}`));
  assert.equal(bound.selectors.get("target.5000"), "#e4999");
  for (const absent of ["elementTotal", "elementsTruncated", "budgetTruncated", "captureTruncated"]) assert.equal(absent in bound.evidence, false, absent);
});

test("an open modal's controls stay where the page put them: nothing is moved to the front", () => {
  const evidence = sanitizeWebLlmSnapshot(page(
    [
      { tagName: "a", selector: "#home", visibleText: "Home", bounds: { x: 0, y: 0, width: 50, height: 20 } },
      { tagName: "button", selector: "#close", name: "Close", bounds: { x: 210, y: 210, width: 40, height: 20 } }
    ],
    { evidence: { dialogs: { modal: true, open: [{ selector: "#modal", role: "dialog", modal: true, native: false, label: "Offer", bounds: { x: 200, y: 200, width: 300, height: 200 } }] } } }
  ));
  assert.deepEqual(evidence.elements.map((element) => element.target), ["target.1", "target.2"]);
  assert.deepEqual(evidence.elements.map((element) => element.name ?? element.text), ["Home", "Close"]);
});

test("a 10,000-character text, name and label arrive whole", () => {
  const long = `${"word ".repeat(1_999)}last`;
  assert.equal(long.length, 9_999);
  const text = `${long}x`;
  const [element] = sanitizeWebLlmSnapshot(page([{ tagName: "p", selector: "#story", visibleText: text, accessibleName: `${text} named`, label: `${text} labelled` }])).elements;
  assert.equal(element?.text, text);
  assert.equal(element?.text?.length, 10_000);
  assert.equal(element?.name, `${text} named`);
  assert.equal(element?.label, `${text} labelled`);
});

test("all 100 options of a select arrive, in order, an empty value or label kept as it is", () => {
  const options = [{ value: "", label: "Choose a size" }, { value: "blank", label: "" }, ...Array.from({ length: 98 }, (_, index) => ({ value: `v${index}`, label: `Option ${index}` }))];
  const [element] = sanitizeWebLlmSnapshot(page([{ tagName: "select", selector: "#size", name: "Size", options, selectedValue: "v97" }])).elements;
  assert.equal(element?.options?.length, 100);
  assert.deepEqual(element?.options, options);
  assert.equal(element?.selectedValue, "v97");
});

test("attributes are [name, value] pairs in the page's order, `headers` included, and no key Core denies reaches the packet", () => {
  const recorded = { id: "cell-3", headers: "col-price row-2", class: "price  sale", "data-testid": "price", selector: "not a key here", "data-fluxiq-frame-id": "0" };
  const tupled: Array<[string, string]> = [["headers", "col-price"], ["id", "cell-4"], ["style", "color: red"]];
  const evidence = sanitizeWebLlmSnapshot(page([
    { tagName: "td", selector: "#cell-3", visibleText: "$4.00", attributes: recorded },
    { tagName: "td", selector: "#cell-4", visibleText: "$5.00", attributes: tupled }
  ]));
  assert.deepEqual(evidence.elements[0]?.attributes, [["id", "cell-3"], ["headers", "col-price row-2"], ["class", "price  sale"], ["data-testid", "price"], ["selector", "not a key here"]]);
  assert.deepEqual(evidence.elements[1]?.attributes, tupled);
  const screened = screenAutomationStudioLlmEvidence(evidence, WEB_LLM_DENIED_EVIDENCE_KEYS);
  assert.equal(screened.deniedKey, false, "an attribute name must never become an object key");
});

test("a secret-shaped attribute, text or option is withheld, and Core's own screen then finds nothing", () => {
  const evidence = sanitizeWebLlmSnapshot(page([
    { tagName: "button", selector: "#go", visibleText: "Go", attributes: { "data-auth": `Bearer ${API_KEY}`, "data-state": JWT, title: "Checkout" } },
    { tagName: "p", selector: "#leak", visibleText: `your key is ${API_KEY}` },
    { tagName: "select", selector: "#tokens", name: "Token", options: [{ value: JWT, label: "Session" }, { value: "plain", label: "Plain" }] }
  ]));
  assert.deepEqual(evidence.elements[0]?.attributes, [["data-auth", WEB_LLM_WITHHELD_TEXT], ["data-state", WEB_LLM_WITHHELD_TEXT], ["title", "Checkout"]]);
  assert.equal(evidence.elements[1]?.text, WEB_LLM_WITHHELD_TEXT);
  assert.deepEqual(evidence.elements[2]?.options, [{ value: WEB_LLM_WITHHELD_TEXT, label: "Session" }, { value: "plain", label: "Plain" }]);
  assert.doesNotMatch(JSON.stringify(evidence), /sk-live|eyJhbGci/u);
  assert.equal(screenAutomationStudioLlmEvidence(evidence, []).secretShaped, false);
});

test("URLs keep their path, query and fragment; a secret-named or secret-shaped query value is withheld; credentials are refused", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: `https://shop.test/search?q=running+shoes&page=2&session=abc123&x=${JWT}#results`,
    title: "Search",
    interactiveElements: [
      { tagName: "a", selector: "#partner", visibleText: "Partner", href: "https://partner.test/offer?id=7&access_token=abc#top" },
      { tagName: "a", selector: "#login", visibleText: "Login", href: "https://user:pass@partner.test/" },
      { tagName: "a", selector: "#mail", visibleText: "Mail us", href: "mailto:help@shop.test" },
      { tagName: "a", selector: "#oauth", visibleText: "Back", href: "/callback#access_token=abc&state=ok", attributes: { href: "/callback#access_token=abc&state=ok" } }
    ]
  });
  assert.equal(evidence.location, "https://shop.test/search?q=running+shoes&page=2&session=(withheld)&x=(withheld)#results");
  assert.deepEqual(evidence.elements.map((element) => element.href), [
    "https://partner.test/offer?id=7&access_token=(withheld)#top",
    undefined,
    "mailto:help@shop.test",
    "https://shop.test/callback#access_token=(withheld)&state=ok"
  ]);
  assert.deepEqual(evidence.elements[3]?.attributes, [["href", "https://shop.test/callback#access_token=(withheld)&state=ok"]]);
  assert.doesNotMatch(JSON.stringify(evidence), /abc123|user:pass|access_token=abc|eyJhbGci/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "https://user:pass@shop.test/", interactiveElements: [] }), /without credentials/u);
});

test("a parameter is secret by its whole words, never by a substring", () => {
  for (const name of ["token", "api_key", "apiKey", "X-Amz-Signature", "sessionid", "session_id", "code", "client_secret", "password", "auth", "ticket"]) assert.equal(secretParameterName(name), true, name);
  for (const name of ["q", "keyword", "zipcode", "author", "page", "sort", "design", "passenger"]) assert.equal(secretParameterName(name), false, name);
});

test("an element carries its click listener, implied role, label, rounded document box, viewport flag and checked state", () => {
  const [element] = sanitizeWebLlmSnapshot(page([{
    tagName: "input", selector: "#agree", inputType: "checkbox", accessibleName: "Agree", label: "I agree to the terms",
    implicitRole: "checkbox", hasClickHandler: true, checked: true, isVisibleOnViewport: false,
    documentBounds: { x: 10.4, y: 2_000.6, width: 16.2, height: 15.5 }
  }])).elements;
  assert.deepEqual(element, {
    target: "target.1", tag: "input", inputType: "checkbox", name: "Agree", label: "I agree to the terms", implicitRole: "checkbox",
    hasClickHandler: true, checked: true, onViewport: false, box: { x: 10, y: 2_001, width: 16, height: 16 }
  });
});

test("a sensitive control is still dropped, whichever form its attributes arrive in, and its value never travels", () => {
  const evidence = sanitizeWebLlmSnapshot(page([
    { tagName: "input", selector: "#card", accessibleName: "Card", value: "4111111111111111", attributes: [["autocomplete", "billing cc-number"]] },
    { tagName: "input", selector: "#pin", accessibleName: "PIN", value: "1234", attributes: [["type", "password"]] },
    { tagName: "input", selector: "#code", accessibleName: "Code", value: "998877", attributes: { "data-sensitive": "true" } },
    { tagName: "input", selector: "#city", accessibleName: "City", value: "Leeds" }
  ]));
  assert.deepEqual(evidence.elements.map((element) => element.name), ["City"]);
  assert.equal(evidence.elements[0]?.value, "Leeds");
  assert.doesNotMatch(JSON.stringify(evidence), /4111|1234|998877|Card|PIN/u);
});

test("every dialog, every blocker, each loading indicator with its label, the navigation URL and the unanswered frames are carried", () => {
  const dialogs = Array.from({ length: 5 }, (_, index) => ({ selector: `#d${index}`, role: "dialog", modal: index === 0, native: false, label: `Dialog ${index}` }));
  const blockers = Array.from({ length: 4 }, (_, index) => ({ selector: `#b${index}`, role: "presentation", label: `Layer ${index}`, blocks: 10 - index, blocked: [] }));
  const evidence = sanitizeWebLlmSnapshot(page([{ tagName: "button", selector: "#ok", name: "OK" }], {
    frame: { isTop: true },
    evidence: {
      dialogs: { modal: true, open: dialogs },
      overlays: { tested: 40, blockedCount: 10, blockers },
      loading: { documentState: "interactive", busy: true, busyRegions: ["#list"], pendingNavigation: false, indicators: [{ selector: "#s", kind: "spinner", label: "Updating total" }, { selector: "#p", kind: "progressbar" }] },
      navigation: { url: "https://shop.test/results?q=tea&token=zzz", origin: "https://shop.test", path: "/results", type: "reload", redirects: 1, historyLength: 3, visibility: "visible" },
      unansweredFrameIds: [9, 4]
    }
  }));
  assert.deepEqual(evidence.dialogs, dialogs.map((dialog, index) => (index === 0 ? { role: "dialog", name: dialog.label, modal: true } : { role: "dialog", name: dialog.label })));
  assert.deepEqual(evidence.blockedBy, blockers.map((blocker) => ({ role: "presentation", name: blocker.label, blocks: blocker.blocks })));
  assert.deepEqual(evidence.loading, { readyState: "interactive", busy: true, indicators: [{ kind: "spinner", label: "Updating total" }, { kind: "progressbar" }] });
  assert.deepEqual(evidence.navigation, { url: "https://shop.test/results?q=tea&token=(withheld)", type: "reload", redirects: 1 });
  assert.deepEqual(evidence.frame, { isTop: true, unansweredFrameIds: [4, 9] });
  assert.doesNotMatch(JSON.stringify(evidence), /#d0|#b0|#list|zzz/u);
});

test("the binding keeps every pair of the page's own query, not the first sixteen", () => {
  const pairs = Array.from({ length: 40 }, (_, index) => [`f${index}`, `v${index}`] as const);
  const url = `https://shop.test/results?${new URLSearchParams(pairs.map(([key, value]) => [key, value])).toString()}`;
  const bound = sanitizeWebLlmSnapshotWithBindings(page([{ tagName: "button", selector: "#go", visibleText: "Go" }], { url }));
  assert.deepEqual(bound.pageQuery, pairs.map(([key, value]) => [key, value]));
});
