// A call reports the states it saw from its own captures, and so costs the page
// only those captures.
//
// Core's build loop used to ask `captureStateDigest` before and after every
// call, and each answer was a whole `web.dom.capture_snapshot`: a look cost
// three captures and an action four plus the action, every one of them a
// "Looking at the page" in the side panel
// (`docs/working/language-driven-flow-loop-plan/reports/looking-at-page-repeat.md`).
// Now each result carries `stateDigests` and the binding says
// `stateDigestsOnCalls`, which is what stops Core asking. These tests hold three
// things: the digest a call reports is exactly the one `captureStateDigest`
// would have answered for the same page;
// it is stable on an unchanged page and moves with a change; and what each kind
// of decision costs the page, under the old protocol and the new one.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution
} from "../..";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const NAVIGATE = "web.output.browser-navigate";
const CAPTURE = "web.dom.capture_snapshot";
const PERMITTED = async () => ({ permitted: true as const });
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];

type FakePage = { url: string; title: string; elements: JsonObject[] };

/**
 * A gateway that counts what it is sent. A click moves the page to `onClick`
 * when one is given; `failClick` makes the page refuse it instead.
 */
function fakeGateway(start: FakePage | undefined, options: { onClick?: FakePage; failClick?: boolean } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let page = start;
  const snapshotOf = (current: FakePage): JsonObject => ({
    url: current.url,
    title: current.title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: current.elements
  });
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
  return {
    gateway,
    commands,
    captures: () => commands.filter((command) => command.actionType === CAPTURE).length,
    setPage: (next: FakePage) => { page = next; }
  };
}

function button(selector: string, text: string): JsonObject {
  return { tagName: "button", selector, visibleText: text };
}

function smallPage(title = "Fixture"): FakePage {
  return { url: "https://example.test/start", title, elements: [button("#go", "Go"), button("#other", "Other")] };
}

/** A page of forty-one elements, more than the packet once held. */
function largePage(): FakePage {
  const elements = Array.from({ length: 40 }, (_, index) => ({
    tagName: "a",
    selector: `#item-${index}`,
    visibleText: `Item number ${index} with a description long enough to cost the packet real bytes`,
    href: `/items/${index}`
  }));
  return { url: "https://example.test/list", title: "A long list", elements: [button("#go", "Go"), ...elements] };
}

async function look(runtime: WebAutomationLlmEvidenceRuntime, callId: string): Promise<WebLlmEvidenceToolExecution> {
  const value = { node: SNAPSHOT, parameters: {}, consequences: [] };
  return await runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value });
}

async function click(runtime: WebAutomationLlmEvidenceRuntime, callId: string, handle: string): Promise<WebLlmEvidenceToolExecution> {
  const value = { node: CLICK, parameters: { target: { handle } }, consequences: [] };
  return await runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value });
}

async function asked(runtime: WebAutomationLlmEvidenceRuntime, callId: string): Promise<string | undefined> {
  return await runtime.captureStateDigest({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, phase: "before" });
}

function handleOf(result: WebLlmEvidenceToolExecution, text: string): string {
  return shownHandle(result.evidence, text);
}

test("the binding says its calls report their own states", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(fakeGateway(smallPage()).gateway);
  assert.equal(runtime.stateDigestsOnCalls, true);
});

test("a look's digest is what captureStateDigest answers for the same page", async () => {
  const fake = fakeGateway(largePage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const answer = await asked(runtime, "call.asked");

  assert.ok(answer);
  assert.deepEqual(looked.stateDigests, { before: answer, after: answer });
  // What the look returned is the compact view of that page (t223); the digest
  // is of the structured packet behind it, the one the host reads.
  assert.equal((looked.evidence as JsonObject).schemaVersion, "web-llm-page.v3");
});

test("an action's digests are the page it found and the page it left, as captureStateDigest reads them", async () => {
  const moved: FakePage = { url: "https://example.test/list", title: "Moved", elements: largePage().elements };
  const fake = fakeGateway(largePage(), { onClick: moved });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const found = await asked(runtime, "call.before");

  const pressed = await click(runtime, "call.click", handleOf(looked, "Go"));
  const left = await asked(runtime, "call.after");

  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(pressed.stateDigests, { before: found, after: left });
  assert.notEqual(found, left);
});

test("digests are stable across calls on an unchanged page and move when the page does", async () => {
  const fake = fakeGateway(smallPage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const first = await look(runtime, "call.one");
  const second = await look(runtime, "call.two");
  assert.ok(first.stateDigests?.after);
  assert.equal(first.stateDigests?.after, second.stateDigests?.after);

  fake.setPage(smallPage("Changed"));
  const third = await look(runtime, "call.three");
  assert.notEqual(third.stateDigests?.after, second.stateDigests?.after);

  // An action that changes nothing on the page leaves the state it found.
  const pressed = await click(runtime, "call.four", handleOf(third, "Go"));
  assert.equal(pressed.stateDigests?.before, third.stateDigests?.after);
  assert.equal(pressed.stateDigests?.after, third.stateDigests?.after);
});

test("a refusal before acting found and left the page it read; a failed action says what it left only from a page read after", async () => {
  const fake = fakeGateway(smallPage(), { failClick: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const state = looked.stateDigests?.after;
  assert.ok(state);

  const unobserved = await click(runtime, "call.unobserved", "t999");
  assert.equal(unobserved.resultCode, "web.action.rejected.target_unobserved");
  assert.deepEqual(unobserved.stateDigests, { before: state, after: state });

  const failed = await click(runtime, "call.failed", handleOf(looked, "Go"));
  assert.equal(failed.effectApplied, false);
  // The page came back with the refusal, read after the attempt.
  assert.equal(typeof (failed.evidence as JsonObject).page, "object");
  assert.deepEqual(failed.stateDigests, { before: state, after: state });
});

test("a detection says the state it read the page in, on a refusal thrown after the read as on an answer", async () => {
  const fake = fakeGateway({ url: CATALOG.url, title: CATALOG.title, elements: [button("#go", "Go")] });
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const looked = await look(runtime, "call.look");
  const state = looked.stateDigests?.after;
  assert.ok(state);

  const detected = await runtime.executeTool({ ...PROJECT, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detected.resultCode, "web.structure.detected");
  assert.deepEqual(detected.stateDigests, { before: state, after: state });

  const refused = await runtime.executeTool({ ...PROJECT, callId: "call.refused", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: "t999" } });
  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  assert.deepEqual(refused.stateDigests, { before: state, after: state });

  // Refused on its input, before anything was read: no state.
  const malformed = await runtime.executeTool({ ...PROJECT, callId: "call.malformed", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: 7 } });
  assert.equal(malformed.resultCode, "web.action.rejected.invalid_input");
  assert.equal(malformed.stateDigests, undefined);
});

test("a call that read no page reports no state", async () => {
  // Refused before anything was captured.
  const fake = fakeGateway(smallPage());
  const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
  const unknown = await runtime.executeTool({ ...PROJECT, callId: "call.unknown", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "builtin.logic.and", parameters: {}, consequences: [] } });
  assert.equal(unknown.stateDigests, undefined);
  assert.equal(fake.captures(), 0);

  // Told where the Flow starts, on the blank tab: a look found no page that
  // could be read, so nothing is said of it.
  const start = "https://example.test/start";
  const unreadable = await createWebAutomationLlmEvidenceRuntime(fakeGateway(undefined).gateway).executeTool({
    ...PROJECT, callId: "call.early-look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: start,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(unreadable.resultCode, "web.action.rejected.not_at_start_location");
  assert.equal(unreadable.stateDigests, undefined);

  // Told where the Flow starts, and not there yet: a press is refused, and the
  // page read is not this build's page, so nothing is said of it.
  const notThere = await createWebAutomationLlmEvidenceRuntime(fakeGateway(smallPage()).gateway).executeTool({
    ...PROJECT, callId: "call.early", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: start,
    value: { node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(notThere.resultCode, "web.action.rejected.not_at_start_location");
  assert.equal(notThere.stateDigests, undefined);

  // The move that goes there found no page, and says only what it left.
  const blank = fakeGateway(undefined);
  const went = await createWebAutomationLlmEvidenceRuntime(blank.gateway).executeTool({
    ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: start,
    value: { node: NAVIGATE, parameters: { url: start }, consequences: [] }
  });
  assert.equal(went.effectApplied, true);
  assert.equal(went.stateDigests?.before, undefined);
  assert.match(went.stateDigests?.after ?? "", /^web-state\.v4:/u);
});

/**
 * One decision as Core makes it. `digests-around-calls` is the old protocol:
 * a `captureStateDigest` before and after the call. `digests-on-calls` is the
 * new one, taken only because the binding declares it.
 */
async function decide(
  runtime: WebAutomationLlmEvidenceRuntime,
  protocol: "digests-around-calls" | "digests-on-calls",
  request: Parameters<WebAutomationLlmEvidenceRuntime["executeTool"]>[0]
): Promise<WebLlmEvidenceToolExecution> {
  const around = protocol === "digests-around-calls" || runtime.stateDigestsOnCalls !== true;
  const bracket = { projectId: request.projectId, flowId: request.flowId, callId: request.callId, toolId: request.toolId };
  if (around) await runtime.captureStateDigest({ ...bracket, phase: "before" });
  const result = await runtime.executeTool(request);
  if (around) await runtime.captureStateDigest({ ...bracket, phase: "after" });
  return result;
}

type Decision = {
  name: string;
  page?: () => FakePage;
  /** Whether the page refuses a click. */
  clickFails?: boolean;
  /** What happens first and is not counted: the look that shows a handle. */
  setUp?: (runtime: WebAutomationLlmEvidenceRuntime) => Promise<WebLlmEvidenceToolExecution | undefined>;
  request: (shown: WebLlmEvidenceToolExecution | undefined) => Parameters<WebAutomationLlmEvidenceRuntime["executeTool"]>[0];
  /** Whether Core ever bracketed this call with digests: a dry-run replay it never did. */
  bracketed: boolean;
  captures: { old: number; now: number };
  digests: "both" | "after" | "none";
};

const lookFirst = async (runtime: WebAutomationLlmEvidenceRuntime) => await look(runtime, "call.setup");
const catalogPage = (): FakePage => ({ url: CATALOG.url, title: CATALOG.title, elements: [button("#go", "Go")] });

const DECISIONS: Decision[] = [
  {
    name: "look",
    request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } }),
    bracketed: true, captures: { old: 3, now: 1 }, digests: "both"
  },
  {
    name: "action that runs",
    setUp: lookFirst,
    request: (shown) => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: handleOf(shown!, "Go") } }, consequences: [] } }),
    bracketed: true, captures: { old: 4, now: 2 }, digests: "both"
  },
  {
    name: "action refused before acting",
    setUp: lookFirst,
    request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: "t999" } }, consequences: [] } }),
    bracketed: true, captures: { old: 3, now: 1 }, digests: "both"
  },
  {
    name: "detect, page-wide",
    page: catalogPage,
    request: () => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }),
    bracketed: true, captures: { old: 3, now: 1 }, digests: "both"
  },
  {
    name: "detect, around a target",
    page: catalogPage,
    setUp: lookFirst,
    request: (shown) => ({ ...PROJECT, callId: "call.n", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: handleOf(shown!, "Go") } }),
    bracketed: true, captures: { old: 4, now: 2 }, digests: "both"
  },
  {
    name: "dry-run replay step that ran",
    request: () => ({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] } }),
    // t174-w82: a replayed in-place step is read before and after.
    bracketed: false, captures: { old: 2, now: 2 }, digests: "none"
  },
  {
    name: "dry-run replay step that failed",
    clickFails: true,
    request: () => ({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] } }),
    // Its one capture is the page the correction is made from, read after the
    // step's command went out, so it says only what the step left.
    // t174-w82: a replayed in-place step is read before and after.
    bracketed: false, captures: { old: 2, now: 2 }, digests: "after"
  }
];

for (const decision of DECISIONS) {
  test(`page captures for one decision (${decision.name}): ${decision.captures.old} digested around the call, ${decision.captures.now} digested on it`, async () => {
    for (const protocol of ["digests-around-calls", "digests-on-calls"] as const) {
      const fake = fakeGateway(decision.page?.() ?? smallPage(), { failClick: decision.clickFails === true });
      const runtime = createWebAutomationLlmEvidenceRuntime(fake.gateway);
      const shown = await decision.setUp?.(runtime);
      const before = fake.captures();
      const result = decision.bracketed
        ? await decide(runtime, protocol, decision.request(shown))
        : await runtime.executeTool(decision.request(shown));
      const spent = fake.captures() - before;

      assert.equal(spent, protocol === "digests-around-calls" ? decision.captures.old : decision.captures.now, protocol);
      if (decision.digests === "both") {
        assert.match(result.stateDigests?.before ?? "", /^web-state\.v4:/u, protocol);
        assert.match(result.stateDigests?.after ?? "", /^web-state\.v4:/u, protocol);
      } else if (decision.digests === "after") {
        assert.equal(result.stateDigests?.before, undefined, protocol);
        assert.match(result.stateDigests?.after ?? "", /^web-state\.v4:/u, protocol);
      } else {
        assert.equal(result.stateDigests, undefined, protocol);
      }
    }
  });
}
