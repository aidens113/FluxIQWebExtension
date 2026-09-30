import assert from "node:assert/strict";
import test from "node:test";
import { exploreWebsiteAndProposeFlow, sanitizeWebExplorationSnapshot, type WebFlowExplorationBrowser } from "../web-flow-exploration.js";

test("sanitizes snapshots for Core without values, sensitive controls, or URL query data", () => {
  const page = sanitizeWebExplorationSnapshot({
    url: "https://example.test/form?session=private#token",
    title: "Account setup",
    selectedText: "never forward this",
    interactiveElements: [
      { tagName: "input", selector: "#name", name: "Name", value: "Ada", inputType: "text", attributes: { placeholder: "Your name" } },
      { tagName: "input", selector: "#password", name: "Password", value: "private", inputType: "password" },
      { tagName: "a", selector: "#next", visibleText: "Next", href: "https://example.test/next?ticket=private" },
      { tagName: "a", selector: "#external", visibleText: "External", href: "https://outside.test/" },
    ],
  }, ["https://example.test"]);
  assert.deepEqual(page, {
    location: "https://example.test/form",
    title: "Account setup",
    elements: [
      { tag: "input", selector: "#name", name: "Name", inputType: "text" },
      { tag: "a", selector: "#next", text: "Next", href: "https://example.test/next" },
      { tag: "a", selector: "#external", text: "External" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(page), /Ada|private|session|ticket|selectedText/u);
});

test("uses Core to select bounded same-origin pages then requests one proposal", async () => {
  const navigated: string[] = [];
  const snapshots = new Map<string, unknown>([
    ["https://example.test/start", snapshot("https://example.test/start", [
      { tagName: "a", selector: "#b", visibleText: "B", href: "/b" },
      { tagName: "a", selector: "#a", visibleText: "A", href: "/a" },
    ])],
    ["https://example.test/b", snapshot("https://example.test/b", [])],
  ]);
  let current = "";
  const browser: WebFlowExplorationBrowser = {
    navigate: async url => { current = url; navigated.push(url); },
    captureSnapshot: async () => snapshots.get(current),
  };
  const calls: unknown[] = [];
  const result = await exploreWebsiteAndProposeFlow({
    projectId: "project.one", flowId: "flow.blank", instruction: "Open B and build a flow", startUrl: "https://example.test/start", allowedOrigins: ["https://example.test"], limits: { maxPages: 2 },
  }, { browser, core: {
    selectExplorationPages: async input => { calls.push(input); return { locations: ["https://example.test/b"] }; },
    proposeFlowBootstrap: async input => { calls.push(input); return { adaptationId: "adaptation.one", status: "proposed" }; },
  } });
  assert.deepEqual(navigated, ["https://example.test/start", "https://example.test/b"]);
  assert.deepEqual(result, { adaptationId: "adaptation.one", status: "proposed", pagesCaptured: 2, elementsCaptured: 2, evidenceTruncated: true });
  assert.equal(calls.length, 2);
  assert.deepEqual((calls[0] as any).initialEvidence.trust, "untrusted-page-evidence");
  assert.deepEqual((calls[1] as any).explorationEvidence.trust, "untrusted-page-evidence");
  assert.equal(JSON.stringify(result).includes("Open B"), false);
});

test("sends every element of a large page to Core whole, with no count or text cuts", async () => {
  // Nothing trims exploration evidence any more: no byte budget, no per-page
  // element cap (formerly 80, max 150) and no text cuts (formerly 300
  // characters on text, names and titles, 500 on selectors, 80 on roles). The
  // only bound on a model request is the model's context window, enforced by Core.
  const longSelector = (index: number) => `#control-${index}-${"s".repeat(900)}`;
  const longText = (index: number) => `Control ${index} ${"t".repeat(1_200)}`;
  const longName = (index: number) => `Name ${index} ${"n".repeat(1_200)}`;
  const longRole = `role-${"r".repeat(200)}`;
  const longTitle = `Title ${"x".repeat(1_000)}`;
  const elements = Array.from({ length: 400 }, (_, index) => ({ tagName: "button", selector: longSelector(index), visibleText: longText(index), name: longName(index), role: longRole }));
  const browser: WebFlowExplorationBrowser = { navigate: async () => undefined, captureSnapshot: async () => ({ ...(snapshot("https://example.test/", elements) as object), title: longTitle }) };
  let sent: any;
  const result = await exploreWebsiteAndProposeFlow({ projectId: "project.one", flowId: "flow.one", instruction: "Inspect", startUrl: "https://example.test/", allowedOrigins: ["https://example.test"], limits: { maxPages: 1 } }, { browser, core: {
    selectExplorationPages: async () => ({ locations: [] }),
    proposeFlowBootstrap: async input => { sent = input.explorationEvidence; return { adaptationId: "a", status: "proposed" }; },
  } });
  assert.ok(Buffer.byteLength(JSON.stringify(sent), "utf8") > 1_000_000);
  assert.equal(sent.pages[0].elements.length, 400);
  assert.equal(sent.pages[0].title, longTitle);
  const last = sent.pages[0].elements[399];
  assert.deepEqual(last, { tag: "button", selector: longSelector(399), role: longRole, name: longName(399), text: longText(399) });
  assert.equal(result.elementsCaptured, 400);
  assert.equal(result.evidenceTruncated, false);
});

test("still screens secrets out of a page with no element cap", () => {
  const elements = [
    ...Array.from({ length: 200 }, (_, index) => ({ tagName: "button", selector: `#b${index}`, visibleText: `B${index}` })),
    { tagName: "input", selector: "#pw", name: "Password", value: "hunter2", inputType: "password" },
    { tagName: "input", selector: "#otp", name: "Code", value: "123456", attributes: { autocomplete: "one-time-code" } },
    { tagName: "input", selector: "#card", name: "Card", value: "4111", attributes: { autocomplete: "cc-number" } },
    { tagName: "input", selector: "#flagged", name: "Flagged", attributes: { "data-sensitive": "true" } },
    { tagName: "input", selector: "#last", name: "Last", value: "kept-out", inputType: "text" },
  ];
  const page = sanitizeWebExplorationSnapshot(snapshot("https://example.test/", elements), ["https://example.test"]);
  assert.equal(page.elements.length, 201);
  assert.deepEqual(page.elements.at(-1), { tag: "input", selector: "#last", name: "Last", inputType: "text" });
  assert.doesNotMatch(JSON.stringify(page), /hunter2|123456|4111|kept-out|#pw|#otp|#card|#flagged/u);
});

test("fails closed before Core for out-of-scope navigation and non-reviewable output", async () => {
  const browser: WebFlowExplorationBrowser = { navigate: async () => undefined, captureSnapshot: async () => snapshot("https://outside.test/", []) };
  let coreCalls = 0;
  await assert.rejects(exploreWebsiteAndProposeFlow({ projectId: "project.one", flowId: "flow.one", instruction: "Inspect", startUrl: "https://example.test/", allowedOrigins: ["https://example.test"] }, { browser, core: { selectExplorationPages: async () => { coreCalls += 1; return { locations: [] }; }, proposeFlowBootstrap: async () => { coreCalls += 1; return { adaptationId: "a", status: "proposed" }; } } }), /outside the allowed origins/);
  assert.equal(coreCalls, 0);

  const validBrowser: WebFlowExplorationBrowser = { navigate: async () => undefined, captureSnapshot: async () => snapshot("https://example.test/", []) };
  await assert.rejects(exploreWebsiteAndProposeFlow({ projectId: "project.one", flowId: "flow.one", instruction: "Inspect", startUrl: "https://example.test/", allowedOrigins: ["https://example.test"] }, { browser: validBrowser, core: { selectExplorationPages: async () => ({ locations: [] }), proposeFlowBootstrap: async () => ({ adaptationId: "a", status: "applied" }) } }), /reviewable proposal/);
});

test("rejects Core-selected pages that were not present in the captured extension evidence", async () => {
  const browser: WebFlowExplorationBrowser = { navigate: async () => undefined, captureSnapshot: async () => snapshot("https://example.test/", [{ tagName: "a", selector: "#safe", href: "/safe" }]) };
  let proposed = false;
  await assert.rejects(exploreWebsiteAndProposeFlow({ projectId: "project.one", flowId: "flow.one", instruction: "Inspect", startUrl: "https://example.test/", allowedOrigins: ["https://example.test"] }, { browser, core: {
    selectExplorationPages: async () => ({ locations: ["https://example.test/unseen"] }),
    proposeFlowBootstrap: async () => { proposed = true; return { adaptationId: "a", status: "proposed" }; },
  } }), /unavailable or duplicate/);
  assert.equal(proposed, false);
});

function snapshot(url: string, interactiveElements: unknown[]): unknown { return { url, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements }; }
