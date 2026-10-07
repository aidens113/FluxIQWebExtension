// Running the draft again as the Flow will run it, against a stub gateway.
//
// The reset is a navigation to the location the step recorded; a step is the
// node's own command with the parameters the Flow keeps; and the three ways a
// step can fail to replay are told apart here, because Core acts on which one
// it was and cannot work it out for itself.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";
import { webNodeRecordCount } from "../replay";
import { WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS } from "../../capture";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const EXTRACT_LIST = "web.output.dom-extract_list";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const NAVIGATE = "web.output.browser-navigate";
const START = "https://example.test/start";
const PERMITTED = async () => ({ permitted: true as const });

test("a step that ran records where it found the page and what it read", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = shownPageLines(looked.evidence)[0]!.target;
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: CLICK, parameters: { target: { handle } }, consequences: [] }
  });
  // The page it found, so a replay of the draft knows where to start. Only the
  // first proposed step's is ever used, and every step carries it.
  assert.deepEqual(pressed.draft?.replay?.from, { location: START });
});

test("a reset goes to the recorded location, through the navigate the Flow uses", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const reset = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: PERMITTED, value: { replay: "reset", from: { location: START } }
  });
  assert.equal(reset.resultCode, "core.replay.replayed");
  assert.equal(reset.effectApplied, true);
  const navigated = stubbed.commands.find((command) => command.actionType === "web.browser.navigate");
  // With the room to wait out a check that clears by itself, as every navigation has (`actions/check-wait.ts`),
  // and asking the browser to close the tabs FluxIQ's own clicks opened, so
  // each test of a build does not leave one more behind (t174-w104, cause 15).
  assert.deepEqual(navigated?.parameters, { url: START, closeOpenedTabs: true, checkWaitMs: 15_000 });
});

test("only the reset asks for opened tabs to be closed: a Flow's own navigate, replayed, does not", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: NAVIGATE, parameters: { url: START }, consequences: [] }
  });
  const navigated = stubbed.commands.find((command) => command.actionType === "web.browser.navigate");
  assert.equal(navigated?.parameters.url, START);
  assert.equal(Object.hasOwn(navigated?.parameters ?? {}, "closeOpenedTabs"), false);
});

test("a reset with no usable location refuses, so nothing is replayed from the wrong place", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  for (const from of [{}, { location: "file:///etc/passwd" }, { location: 7 }]) {
    const reset = await runtime.executeTool({
      ...PROJECT, callId: "dryrun.1.reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      permission: PERMITTED, value: { replay: "reset", from }
    });
    assert.equal(reset.resultCode, "core.replay.reset_failed", JSON.stringify(from));
  }
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);
});

test("a replayed step dispatches the node's own command with the parameters the Flow keeps", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal(replayed.effectApplied, true);
  // The command the finished Flow dispatches, not a rehearsal of it. No handle
  // is resolved: the draft's parameters are already real. The click carries
  // the check allowance, as the Flow's own node does when it runs
  // (`output-nodes/native-runtime.ts`).
  const clicked = stubbed.commands.find((command) => command.actionType === "web.dom.click");
  assert.deepEqual(clicked?.parameters, { selector: "#go", checkWaitMs: 15_000 });
});

test("a step whose target is gone is unreproducible, and every other failure is a failure", async () => {
  const gone = stub({ clickFailure: { code: "web.target.not_found" } });
  const runtimeGone = createWebAutomationLlmEvidenceRuntime(gone.gateway);
  const missing = await runtimeGone.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  // The one failure a page-level reset explains: a banner answered once stays
  // answered. Refusing it outright would push the model to delete the step.
  assert.equal(missing.resultCode, "core.replay.unreproducible");

  const broken = stub({ clickFailure: {} });
  const runtimeBroken = createWebAutomationLlmEvidenceRuntime(broken.gateway);
  const failed = await runtimeBroken.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(failed.resultCode, "core.replay.failed");
  assert.equal(failed.effectApplied, false);
});

test("a step that read rows and now reads none has changed, which is the defect this exists for", async () => {
  const stubbed = stub({ payload: { extracted: [] } });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const collapsed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.4", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], produced: { records: 16 } }
  });
  assert.equal(collapsed.resultCode, "core.replay.changed");

  // Fewer rows, or the same rows in another order, is the page and not the step.
  const fewer = stub({ payload: { extracted: [{ a: 1 }, { a: 2 }] } });
  const runtimeFewer = createWebAutomationLlmEvidenceRuntime(fewer.gateway);
  const still = await runtimeFewer.executeTool({
    ...PROJECT, callId: "dryrun.1.4", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], produced: { records: 16 } }
  });
  assert.equal(still.resultCode, "core.replay.replayed");
});

test("a replayed step the run does not hold permission for does not act", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const refused = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: async () => ({ permitted: false as const, missing: ["send_or_publish" as const], requestId: "request.one" }),
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: ["send_or_publish"] }
  });
  assert.equal(refused.resultCode, "core.replay.failed");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

// t252 (D6, D7): the build's test runs a loop once per row, sending each body
// step with the pass's row as `item`. The replay scopes the step's control to
// that row exactly as the Flow's For Each does (`output-nodes/targets/row-scope.ts`).
const CARD_CONTROL: JsonObject = {
  selector: "li.request:nth-of-type(1) button.confirm",
  element: { tagName: "button", visibleText: "Confirm", context: { listPosition: { index: 1, total: 3 }, record: { text: "Tom Becker 1 mutual friend Confirm" } } }
};
const ROW_SCOPED_ELEMENT = { tagName: "button", visibleText: "Confirm", context: { listPosition: { index: 1, total: 3 }, record: { values: ["Amara Osei", "23 mutual friends"] } } };

test("a replayed step carrying a row presses that row's control, as the Flow's loop pass does", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: CARD_CONTROL, consequences: [], item: { name: "Amara Osei", mutual: "23 mutual friends" } }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  const clicked = stubbed.commands.find((command) => command.actionType === "web.dom.click");
  assert.deepEqual(clicked?.parameters, { selector: CARD_CONTROL.selector, element: ROW_SCOPED_ELEMENT, checkWaitMs: 15_000 });
});

test("a replayed step with no row, or a row that is not an object, runs on what the step recorded", async () => {
  for (const item of [undefined, "Amara Osei", ["Amara Osei"]]) {
    const stubbed = stub();
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const value: JsonObject = { replay: "step", node: CLICK, parameters: CARD_CONTROL, consequences: [] };
    if (item !== undefined) value.item = item;
    await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
    const clicked = stubbed.commands.find((command) => command.actionType === "web.dom.click");
    assert.deepEqual(clicked?.parameters, { ...CARD_CONTROL, checkWaitMs: 15_000 }, JSON.stringify(item));
  }
});

test("a checked step carrying a row checks that row's control", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const checked = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "verify", node: CLICK, parameters: CARD_CONTROL, consequences: ["modify_existing"], from: { location: START }, item: { name: "Amara Osei", mutual: "23 mutual friends" } }
  });
  assert.equal(checked.resultCode, "core.replay.verified");
  const asserted = stubbed.commands.filter((command) => command.actionType === "web.dom.assert");
  assert.ok(asserted.length > 0);
  for (const command of asserted) assert.deepEqual(command.parameters.element, ROW_SCOPED_ELEMENT);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

// D6: the walker loops over the rows the list read returned *in this test*, so
// a replayed read answers them on `outputs`, keyed by the node's `records` port,
// exactly as the Flow's extract_list saves them: each row held to the record
// schema the node's dispatch derives, which keeps only the fields it reads.
test("a replayed list read answers the rows the Flow's extract_list would produce, on outputs.records", async () => {
  const stubbed = stub({ payload: { extracted: [{ name: "Amara Osei", mutual: "23 mutual friends", stray: "x" }, { name: "Jon Park", mutual: "4 mutual friends" }] } });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const read = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT_LIST, parameters: { extractList: { item: "li.request", fields: { name: ".name", mutual: ".mutual" } } }, consequences: [] }
  });
  assert.equal(read.resultCode, "core.replay.replayed");
  assert.deepEqual(read.outputs, { records: [{ name: "Amara Osei", mutual: "23 mutual friends" }, { name: "Jon Park", mutual: "4 mutual friends" }] });
});

// S4 of the read-list redesign (contract C3): the Flow's read answers only the
// rows it kept, and the build's test replays the Flow, so a replayed read asks
// the page for `answer: "kept"` as the Flow's dispatch does. Exploration is the
// model looking, and keeps the read's floor of rejected rows: it never asks.
test("a replayed list read asks for the kept rows alone, and an exploration read does not", async () => {
  const extractList = { item: "li.request", fields: { name: ".name" } };
  const replayedStub = stub({ payload: { extracted: [{ name: "Amara Osei" }] } });
  const replayed = await createWebAutomationLlmEvidenceRuntime(replayedStub.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT_LIST, parameters: { extractList }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  const replayedRead = replayedStub.commands.find((command) => command.actionType === "web.dom.extract_list");
  assert.equal((replayedRead?.parameters.extractList as JsonObject | undefined)?.answer, "kept");

  const exploringStub = stub({ payload: { extracted: [{ name: "Amara Osei" }] } });
  await createWebAutomationLlmEvidenceRuntime(exploringStub.gateway).executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: EXTRACT_LIST, parameters: { extractList }, consequences: [] }
  });
  const explored = exploringStub.commands.find((command) => command.actionType === "web.dom.extract_list");
  assert.ok(explored, "the exploration read went out");
  assert.equal(Object.hasOwn((explored.parameters.extractList as JsonObject | undefined) ?? {}, "answer"), false);
});

// S4 (contract C1): a replayed Next page dispatches the request the Flow keeps.
// A list with no next page is the loop's way out, never a failure: the answer
// passes and carries `route: "ended"` at its top level, which the build test's
// walker ends the do-while on. A move is an ordinary success line.
const NEXT_PAGE = "web.output.dom-next_page";
const NEXT_PAGE_REQUEST: JsonObject = { item: "li.result", pagination: { next: "a.next" } };

test("a replayed Next page dispatches its resolved request", async () => {
  const stubbed = stub({ payload: { nextPage: { outcome: "moved", by: "next", page: 2 } } });
  await createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: NEXT_PAGE, parameters: { nextPage: NEXT_PAGE_REQUEST }, consequences: [] }
  });
  const sent = stubbed.commands.filter((command) => command.actionType === "web.dom.next_page");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.parameters.nextPage, NEXT_PAGE_REQUEST);
});

test("a replayed Next page whose list ended answers core.replay.ended (S2) with route ended at the answer's top level", async () => {
  const stubbed = stub({ payload: { nextPage: { outcome: "ended", stop: "control_disabled" }, route: "ended" } });
  const ended = await createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: NEXT_PAGE, parameters: { nextPage: NEXT_PAGE_REQUEST }, consequences: [] }
  });
  assert.equal(ended.resultCode, "core.replay.ended");
  assert.equal(ended.resultReason, undefined);
  const value = ended.evidence as JsonObject;
  assert.equal(value.ok, true);
  assert.equal(value.route, "ended");
  assert.equal(value.said, "the step ran again: the list has no next page (control_disabled), so the loop over its pages ends here");
  // Carried in the evidence, never as a member of the execution result: Core
  // refuses a result member it has not learned (`unknown_key`).
  assert.equal(Object.hasOwn(ended, "route"), false);
});

test("a replayed Next page that moved says the page it moved to, with no route", async () => {
  for (const [nextPage, said] of [
    [{ outcome: "moved", by: "numbered", page: 3 }, "the step ran again: moved to page 3"],
    [{ outcome: "moved", by: "loadMore" }, "the step ran again: moved to the next page"]
  ] as const) {
    const stubbed = stub({ payload: { nextPage } });
    const moved = await createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({
      ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
      value: { replay: "step", node: NEXT_PAGE, parameters: { nextPage: NEXT_PAGE_REQUEST }, consequences: [] }
    });
    assert.equal(moved.resultCode, "core.replay.replayed");
    const value = moved.evidence as JsonObject;
    assert.equal(value.ok, true);
    assert.equal(value.said, said);
    assert.equal(Object.hasOwn(value, "route"), false);
  }
});

test("a route the page sent beside a list that moved is not carried", async () => {
  const stubbed = stub({ payload: { nextPage: { outcome: "moved", by: "next", page: 2 }, route: "ended" } });
  const moved = await createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: NEXT_PAGE, parameters: { nextPage: NEXT_PAGE_REQUEST }, consequences: [] }
  });
  assert.equal(Object.hasOwn(moved.evidence as JsonObject, "route"), false);
});

test("a replayed Next page the page could not move fails, with no route", async () => {
  const stubbed = stub({ nextPageFailure: { code: "web.validation.output_not_observed" } });
  const failed = await createWebAutomationLlmEvidenceRuntime(stubbed.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: NEXT_PAGE, parameters: { nextPage: NEXT_PAGE_REQUEST }, consequences: [] }
  });
  assert.equal(failed.resultCode, "core.replay.failed");
  assert.equal((failed.evidence as JsonObject).ok, false);
  assert.equal(Object.hasOwn(failed.evidence as JsonObject, "route"), false);
});

test("a replayed step that is not a list read, or a read that did not replay, answers no outputs", async () => {
  const stubbed = stub({ payload: { extracted: [{ name: "Amara Osei" }] } });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(Object.hasOwn(pressed, "outputs"), false);
  const empty = stub({ payload: { extracted: [] } });
  const collapsed = await createWebAutomationLlmEvidenceRuntime(empty.gateway).executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: EXTRACT_LIST, parameters: { extractList: { item: "li.request", fields: { name: ".name" } } }, consequences: [], produced: { records: 2 } }
  });
  assert.equal(collapsed.resultCode, "core.replay.changed");
  assert.equal(Object.hasOwn(collapsed, "outputs"), false);
});

test("outputs is a key this domain publishes only beside Core's reader of it", () => {
  assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes("outputs"), true);
});

test("what a read produced is the longest list its payload carries", () => {
  assert.equal(webNodeRecordCount({ extracted: [1, 2, 3], extraction: { fields: ["a"] } }), 3);
  assert.equal(webNodeRecordCount({ extracted: [] }), 0);
  assert.equal(webNodeRecordCount({ value: "ok" }), undefined);
  assert.equal(webNodeRecordCount(undefined), undefined);
});

// t174-w82, cause 4 of `run-murwd8le-79e735a8`: build-test replays 0045 and
// 0068 answered `core.replay.replayed`, "the step ran again", while the page
// said "You have reached the purchase limit for this item.". A replayed press
// is read as an exploration press is: the page's refusal fails the step and is
// quoted, and a press that ran says what it changed on the page.

test("a replayed press the page refused fails, carrying the refusal and the line the page answered with", async () => {
  const stubbed = answeringStub({ code: "web.action.refused_by_page" }, "You have reached the purchase limit for this item.");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const refused = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.15", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(refused.resultCode, "core.replay.failed");
  assert.equal(refused.effectApplied, false);
  assert.equal(refused.resultReason, "page_needs_something_first");
  const value = refused.evidence as JsonObject;
  assert.equal(value.ok, false);
  assert.equal(value.said, "the step did not run (refused_by_page)");
  const tip = shownPageLines(value).find((line) => line.words === "You have reached the purchase limit for this item.")!.target;
  assert.deepEqual(value.notice, [`${tip} "You have reached the purchase limit for this item."`]);
});

test("a replayed press the page answered busy still fails with the busy reason, and quotes the busy line", async () => {
  const stubbed = answeringStub({ code: "web.action.rate_limited" }, "Network busy, please try again");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const busy = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.9", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(busy.resultCode, "core.replay.failed");
  assert.equal(busy.resultReason, "page_busy_try_later");
  const value = busy.evidence as JsonObject;
  assert.deepEqual(value.notice, [`${shownPageLines(value).find((line) => line.words === "Network busy, please try again")!.target} "Network busy, please try again"`]);
});

test("a replayed press that ran says what it changed on the page, as an exploration press does", async () => {
  const stubbed = answeringStub(undefined, "Added to cart!");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.15", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  const value = replayed.evidence as JsonObject;
  assert.equal(value.said, "the step ran again");
  const changed = value.changed as string[];
  assert.equal(changed.length, 1);
  assert.match(changed[0]!, /^t[1-9]\d* "Added to cart!" appeared$/u);
  // A step that ran carries a line, never the page.
  assert.equal("page" in value, false);
});

/** A page whose Go button the page answers, failing with `failure` or not, by writing `answer` beside it. */
function answeringStub(failure: { code: string } | undefined, answer: string) {
  let answered = false;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        const elements: JsonObject[] = [{ tagName: "button", selector: "#go", visibleText: "Go" }];
        if (answered) elements.push({ tagName: "span", selector: "#tip", visibleText: answer });
        return { status: "succeeded", payload: { snapshot: { url: START, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: elements } } };
      }
      if (command.actionType === "web.dom.click") {
        answered = true;
        if (failure) return { status: "failed", failure: { code: failure.code }, error: "no" };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function stub(options: { clickFailure?: { code?: string }; nextPageFailure?: { code: string }; payload?: JsonObject; elements?: JsonObject[]; truncated?: true } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(options.elements, options.truncated) } };
      if (command.actionType === "web.dom.click" && options.clickFailure) {
        const code = options.clickFailure.code;
        return code === undefined ? { status: "failed", error: "no" } : { status: "failed", failure: { code }, error: "no" };
      }
      if (command.actionType === "web.dom.next_page" && options.nextPageFailure) return { status: "failed", failure: { code: options.nextPageFailure.code }, error: "no" };
      return { status: "succeeded", payload: options.payload ?? { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(elements: JsonObject[] = [{ tagName: "button", selector: "#go", visibleText: "Go" }], truncated?: true): JsonObject {
  const snapshot: JsonObject = {
    url: START,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: elements
  };
  if (truncated) snapshot.truncated = true;
  return snapshot;
}

// t174-w104, cause 7 of `run-musp8nz1-dbd3905a`: each build-test step that
// answered `remembered` (0035, 0038, 0043) first waited 5.1-6.9 s for its
// target, 17.2 s of a 36.6 s test. The page read taken before the press
// already says the target is gone, so the step answers without pressing.

test("a replayed press whose target the page read before it does not show, on the page it acted on, is remembered without pressing", async () => {
  const stubbed = stub({ clickFailure: { code: "web.target.not_found" }, elements: [{ tagName: "span", selector: "#done", visibleText: "Collected" }] });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const answered = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.12", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go", element: { tagName: "button", visibleText: "Get coupons" } }, consequences: [], from: { location: START } }
  });
  assert.equal(answered.resultCode, "core.replay.remembered");
  assert.equal((answered.evidence as JsonObject).ok, true);
  assert.equal(answered.effectApplied, false);
  // No press went out, so the node's own wait for its target was never spent.
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

test("a replayed press is still sent when the page read could hold its target, or is not the page it acted on", async () => {
  const cases: Array<{ why: string; elements: JsonObject[]; parameters: JsonObject; from: JsonObject; truncated?: boolean }> = [
    { why: "same words under another selector", elements: [{ tagName: "button", selector: "#coupon", visibleText: "Get coupons" }], parameters: { selector: "#go", element: { tagName: "button", visibleText: "Get coupons" } }, from: { location: START } },
    { why: "an identity with no words to compare", elements: [{ tagName: "span", selector: "#done", visibleText: "Collected" }], parameters: { selector: "#go", element: { tagName: "button" } }, from: { location: START } },
    { why: "no selector to compare", elements: [{ tagName: "span", selector: "#done", visibleText: "Collected" }], parameters: { element: { tagName: "button", visibleText: "Get coupons" } }, from: { location: START } },
    { why: "another page", elements: [{ tagName: "span", selector: "#done", visibleText: "Collected" }], parameters: { selector: "#go" }, from: { location: "https://example.test/elsewhere" } },
    { why: "a read cut short", elements: [{ tagName: "span", selector: "#done", visibleText: "Collected" }], parameters: { selector: "#go" }, from: { location: START }, truncated: true }
  ];
  for (const entry of cases) {
    const options: Parameters<typeof stub>[0] = { clickFailure: { code: "web.target.not_found" }, elements: entry.elements };
    if (entry.truncated) options.truncated = true;
    const stubbed = stub(options);
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    await runtime.executeTool({
      ...PROJECT, callId: "dryrun.1.12", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
      value: { replay: "step", node: CLICK, parameters: entry.parameters, consequences: [], from: entry.from }
    });
    assert.equal(stubbed.commands.filter((command) => command.actionType === "web.dom.click").length, 1, entry.why);
  }
});
