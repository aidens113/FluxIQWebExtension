import assert from "node:assert/strict";
import test from "node:test";
import { exploreWebsiteAndProposeFlow, sanitizeWebExplorationSnapshot, type WebFlowExplorationBrowser } from "./web-flow-exploration.js";

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
