// A call reports the route state of the page it left, from the capture it
// already took, and so costs the page nothing more.
//
// Core's build routing asked the host's `observeRouteState` for a whole
// `web.dom.capture_snapshot` at build start and before most decisions, to record
// the route state each exploration step left
// (`docs/working/language-driven-flow-loop-plan/reports/flow-builder-walkthrough.md`,
// sections 3 and 7). Now each result carries `routeState`, and Core captures
// only where no call left one. These tests hold three things: the route state a
// call reports is exactly what `observeRouteState` returns for the same page,
// whatever stands in front of the
// page; it is always the page the call *left*, never an action's read before
// acting; and reporting it costs no capture at all.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { createWebAutomationHostRuntime } from "../../../host-runtime";

import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution
} from "../..";
import { WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS } from "../../capture";
import { shownHandle } from "../../page-view/tests/shown-page-lines";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const NAVIGATE = "web.output.browser-navigate";
const CAPTURE = "web.dom.capture_snapshot";
const PERMITTED = async () => ({ permitted: true as const });
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];

type FakePage = { url: string; title: string; elements: JsonObject[]; evidence?: JsonObject };

/**
 * One page, read by both sides: the evidence tools through a command-counting
 * gateway, and the host's `observeRouteState` -- the oracle -- through its own
 * dispatch, which is not counted. A click moves the page to `onClick` when one
 * is given; `failClick` makes the page refuse it instead.
 */
function fakePage(start: FakePage | undefined, options: { onClick?: FakePage; failClick?: boolean } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let page = start;
  const snapshotOf = (current: FakePage): JsonObject => {
    const snapshot: JsonObject = {
      url: current.url,
      title: current.title,
      viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
      interactiveElements: current.elements
    };
    if (current.evidence !== undefined) snapshot.evidence = current.evidence;
    return snapshot;
  };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === CAPTURE) {
        if (page === undefined) return { status: "failed", error: "this page cannot be read" };
        if (command.parameters.detectStructure === undefined) return { status: "succeeded", payload: { snapshot: snapshotOf(page) } };
        return { status: "succeeded", payload: { snapshot: snapshotOf(page), structure: structuredClone(CATALOG.structure) as unknown as JsonValue } };
      }
      if (command.actionType === "web.dom.click") {
        if (options.failClick) return { status: "failed", error: "the control is gone" };
        if (options.onClick) page = options.onClick;
      }
      if (command.actionType === "web.browser.navigate" && typeof command.parameters.url === "string") {
        page = { url: command.parameters.url, title: "Arrived", elements: [button("#go", "Go")] };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const host = createWebAutomationHostRuntime({
    dispatch: async (request) => ({
      outputId: request.outputId,
      ok: true,
      status: "succeeded",
      payload: { status: "succeeded", result: { snapshot: page === undefined ? null : snapshotOf(page) } }
    }) as OutputDispatchResult<JsonObject>
  });
  return {
    gateway,
    captures: () => commands.filter((command) => command.actionType === CAPTURE).length,
    setPage: (next: FakePage) => { page = next; },
    /** What the host would answer for the page as it now stands. */
    observed: async (): Promise<JsonObject> => await host.observeRouteState!({ projectId: PROJECT.projectId, flowId: PROJECT.flowId })
  };
}

function button(selector: string, text: string): JsonObject {
  return { tagName: "button", selector, visibleText: text };
}

function smallPage(title = "Fixture"): FakePage {
  return { url: "https://example.test/start", title, elements: [button("#go", "Go"), button("#other", "Other")] };
}

/** A page of forty-one controls, more than the packet once held. */
function largePage(): FakePage {
  const elements = Array.from({ length: 40 }, (_, index) => ({
    tagName: "a",
    selector: `#item-${index}`,
    visibleText: `Item number ${index} with a description long enough to cost the packet real bytes`,
    href: `/items/${index}`
  }));
  return { url: "https://example.test/list", title: "A long list", elements: [button("#go", "Go"), ...elements] };
}

/** A page with a dialog open and an overlay in front of it. */
function frontedPage(): FakePage {
  return {
    url: "https://example.test/queue",
    title: "Queue",
    elements: [button("#got-it", "Got it"), button("#go", "Go")],
    evidence: {
      dialogs: { open: [{ role: "dialog", label: "What's new", modal: true }] },
      overlays: { blockers: [{ role: "dialog", label: "Cookie consent", blocks: 2 }] }
    }
  };
}

async function look(runtime: WebAutomationLlmEvidenceRuntime, callId: string): Promise<WebLlmEvidenceToolExecution> {
  const value = { node: SNAPSHOT, parameters: {}, consequences: [] };
  return await runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value });
}

async function click(runtime: WebAutomationLlmEvidenceRuntime, callId: string, handle: string): Promise<WebLlmEvidenceToolExecution> {
  const value = { node: CLICK, parameters: { target: { handle } }, consequences: [] };
  return await runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value });
}

function handleOf(result: WebLlmEvidenceToolExecution, text: string): string {
  return shownHandle(result.evidence, text);
}

test("Core's reader has learned routeState, so a result carrying it is not refused", () => {
  assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes("routeState"), true);
});

test("a look's route state is what observeRouteState answers for the same page", async () => {
  const fake = fakePage(largePage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const answer = await fake.observed();

  assert.deepEqual(looked.routeState, answer);
  // What the look returned is the compact view of that page (t223); the route
  // state is of the structured packet behind it, the one the host reads.
  assert.equal((looked.evidence as JsonObject).schemaVersion, "web-llm-page.v3");
});

test("a page with a dialog open and an overlay in front says both, as observeRouteState does", async () => {
  const fake = fakePage(frontedPage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const answer = await fake.observed();
  const page = (answer as { page: JsonObject }).page;
  assert.equal(page.dialog, "What's new");
  assert.equal(page.blockedBy, "Cookie consent");
  assert.deepEqual(looked.routeState, answer);

  // Refused before acting, on the same page: it reports that page.
  const refused = await click(runtime, "call.refused", "t999");
  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  assert.deepEqual(refused.routeState, answer);
});

test("an action reports the page it left, never the page it acted on", async () => {
  const moved: FakePage = { url: "https://example.test/list/next", title: "Moved", elements: largePage().elements };
  const fake = fakePage(largePage(), { onClick: moved });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const found = await fake.observed();

  const pressed = await click(runtime, "call.click", handleOf(looked, "Go"));
  const left = await fake.observed();

  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(pressed.routeState, left);
  assert.notDeepEqual(pressed.routeState, found);
});

test("a refusal before acting reports the page it refused on, read by that call", async () => {
  const fake = fakePage(smallPage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  await look(runtime, "call.look");
  const shown = await fake.observed();

  // The page changed after the look; the refusal read the page again before
  // refusing, and that page is the one it reports.
  fake.setPage(smallPage("Changed"));
  const refused = await click(runtime, "call.unobserved", "t999");
  const refusedOn = await fake.observed();
  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  assert.deepEqual(refused.routeState, refusedOn);
  assert.notDeepEqual(refused.routeState, shown);
});

test("a failed action reports the page captured after the attempt", async () => {
  const fake = fakePage(frontedPage(), { failClick: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const failed = await click(runtime, "call.failed", handleOf(looked, "Go"));
  assert.equal(failed.effectApplied, false);
  assert.equal(typeof (failed.evidence as JsonObject).page, "object");
  assert.deepEqual(failed.routeState, await fake.observed());
});

test("a detection reports the page it read, on a refusal thrown after the read as on an answer", async () => {
  const fake = fakePage({ url: CATALOG.url, title: CATALOG.title, elements: [button("#go", "Go")] });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  await look(runtime, "call.look");
  const answer = await fake.observed();

  const detected = await runtime.executeTool({ ...PROJECT, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detected.resultCode, "web.structure.detected");
  assert.deepEqual(detected.routeState, answer);

  const refused = await runtime.executeTool({ ...PROJECT, callId: "call.refused", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: "t999" } });
  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  assert.deepEqual(refused.routeState, answer);

  // Refused on its input, before anything was read: no page, no route state.
  const malformed = await runtime.executeTool({ ...PROJECT, callId: "call.malformed", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: 7 } });
  assert.equal(malformed.resultCode, "web.action.rejected.invalid_input");
  assert.equal(Object.hasOwn(malformed, "routeState"), false);
});

test("a call that left no page it read reports no route state", async () => {
  const fake = fakePage(smallPage());
  const unknown = await createWebAutomationLlmEvidenceRuntime(fake.gateway).executeTool({ ...PROJECT, callId: "call.unknown", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "builtin.logic.and", parameters: {}, consequences: [] } });
  assert.equal(Object.hasOwn(unknown, "routeState"), false);
  assert.equal(fake.captures(), 0);

  // The move that goes there from nowhere reports where it arrived.
  const start = "https://example.test/start";
  const blank = fakePage(undefined);
  const went = await createWebAutomationLlmEvidenceRuntime(blank.gateway).executeTool({
    ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: start,
    value: { node: NAVIGATE, parameters: { url: start }, consequences: [] }
  });
  assert.equal(went.effectApplied, true);
  assert.deepEqual(went.routeState, await blank.observed());
});

type Decision = {
  name: string;
  page?: () => FakePage;
  clickFails?: boolean;
  /** What happens first and is not counted: the look that shows a handle. */
  setUp?: (runtime: WebAutomationLlmEvidenceRuntime) => Promise<WebLlmEvidenceToolExecution | undefined>;
  request: (shown: WebLlmEvidenceToolExecution | undefined) => Parameters<WebAutomationLlmEvidenceRuntime["executeTool"]>[0];
  /** The captures the call itself sends, which reporting its route state must not change. */
  captures: number;
  routeState: boolean;
};

const lookFirst = async (runtime: WebAutomationLlmEvidenceRuntime) => await look(runtime, "call.setup");
const catalogPage = (): FakePage => ({ url: CATALOG.url, title: CATALOG.title, elements: [button("#go", "Go")] });

// The counts are the ones `call-state-digests.test.ts` pins for the same
// decisions ("digested on it"), from before the route state was reported.
const DECISIONS: Decision[] = [
  { name: "look", request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } }), captures: 1, routeState: true },
  {
    name: "action that runs",
    setUp: lookFirst,
    request: (shown) => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: handleOf(shown!, "Go") } }, consequences: [] } }),
    captures: 2, routeState: true
  },
  {
    name: "action refused before acting",
    setUp: lookFirst,
    request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: "t999" } }, consequences: [] } }),
    captures: 1, routeState: true
  },
  { name: "detect, page-wide", page: catalogPage, request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }), captures: 1, routeState: true },
  {
    name: "detect, around a target",
    page: catalogPage,
    setUp: lookFirst,
    request: (shown) => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: handleOf(shown!, "Go") } }),
    captures: 2, routeState: true
  },
  {
    name: "dry-run replay step that ran",
    request: () => ({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] } }),
    captures: 0, routeState: false
  },
  {
    name: "dry-run replay step that failed",
    clickFails: true,
    request: () => ({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] } }),
    captures: 1, routeState: true
  }
];

for (const decision of DECISIONS) {
  test(`page captures for one decision (${decision.name}): still ${decision.captures}, with the route state it left ${decision.routeState ? "reported" : "absent"}`, async () => {
    const fake = fakePage(decision.page?.() ?? smallPage(), { failClick: decision.clickFails === true });
    const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
    const shown = await decision.setUp?.(runtime);
    const before = fake.captures();
    const result = await runtime.executeTool(decision.request(shown));

    assert.equal(fake.captures() - before, decision.captures);
    if (decision.routeState) assert.deepEqual(result.routeState, await fake.observed());
    else assert.equal(Object.hasOwn(result, "routeState"), false);
  });
}
