// A node a build runs against the live page finds its stale target again
// (t786, D7), with the page stubbed at the gateway where the domain meets it:
// the conversion into Core's `reacquire` answer, a row-bound replay that
// re-reads its list and is scoped to the fresh row, and an exploration press
// that looks again and acts on the same control under its new handle. Core
// decides when to ask; these call the callbacks directly.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_TARGET_GONE_CODE, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../../../capture";
import { captureEvidence } from "../../../capture";
import { webPacketElementFingerprint } from "../../../packet-fingerprint";
import type { WebNodeRun } from "../../context";
import { webNodeLookedUpReacquire, webNodeReplayedReads, webNodeReplayRowReacquire, webNodeRetryReacquire, type WebNodeDispatchResult } from "..";

const STALE_FAILURE: AutomationStudioFailureRecord = { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "unacted" };
const REQUEST = { projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: "fluxiq.run_node", value: {} };
const READ = "web.dom.extract_list";

type Command = { actionType: string; parameters: JsonObject; metadata: JsonObject };

function runOf(executeAction: WebLlmEvidenceGateway["executeAction"]) {
  const looked: unknown[] = [];
  const run = {
    gateway: { eligibleSessionIds: () => ["session.one"], executeAction },
    sessionId: "session.one",
    request: REQUEST,
    stores: { extractions: {}, targets: {} } as unknown as WebNodeRun["stores"],
    restamp: (binding: never) => binding,
    looked: (binding: unknown) => { looked.push(binding); }
  } as unknown as WebNodeRun;
  return { run, looked };
}

test("found dispatches the remaining attempts with the found parameters and keeps every answer", async () => {
  const sent: Command[] = [];
  const { run } = runOf(async (_session, command) => {
    sent.push(command);
    return { status: "succeeded" };
  });
  const answers: WebNodeDispatchResult[] = [];
  const command = { actionType: "web.dom.click", parameters: { selector: "#old" }, metadata: { callId: "x" } };
  const reacquire = webNodeRetryReacquire(run, command, async () => ({ outcome: "found", parameters: { selector: "#new" } }), answers);
  const answer = await reacquire({ failure: STALE_FAILURE });
  assert.equal(answer.outcome, "found");
  if (answer.outcome !== "found") return;
  await answer.dispatch(4);
  assert.deepEqual(sent, [{ ...command, parameters: { selector: "#new" } }]);
  assert.equal(answers.length, 1);
});

test("gone ends the node with Core's gone record; a finder that throws is unavailable", async () => {
  const { run } = runOf(async () => ({ status: "succeeded" }));
  const command = { actionType: "web.dom.click", parameters: {}, metadata: {} };
  const gone = await webNodeRetryReacquire(run, command, async () => ({ outcome: "gone" }), [])({ failure: STALE_FAILURE });
  assert.equal(gone.outcome, "gone");
  if (gone.outcome === "gone") {
    assert.equal(gone.result.status, "failed");
    assert.deepEqual({ ...gone.result.failure }, { category: "target_not_found", code: AUTOMATION_STUDIO_TARGET_GONE_CODE, retryable: false, stage: "target_resolution", effect: "unacted", expected: "the item the step was for", actual: "gone" });
  }
  const thrown = await webNodeRetryReacquire(run, command, async () => { throw new Error("page gone away"); }, [])({ failure: STALE_FAILURE });
  assert.deepEqual(thrown, { outcome: "unavailable" });
  assert.deepEqual(await webNodeRetryReacquire(run, command, async () => ({ outcome: "unmatched" }), [])({ failure: STALE_FAILURE }), { outcome: "unmatched" });
});

// --- The row-bound replay ---------------------------------------------------

const ROWS = [
  { author: "Ilya Brandt", text: "New bakery opened downtown", likes: "4 likes" },
  { author: "Mara Quill", text: "Kayak trip on the north lake", likes: "12 likes" }
];
const PRESS: JsonObject = { selector: "article button.like", element: { tagName: "button", accessibleName: "Like", context: { record: { values: ["Mara Quill", "Kayak trip on the north lake", "12 likes"] } } } };
const readRows = (_parameters: JsonObject, payload: JsonValue | undefined) => {
  const extracted = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload.extracted : undefined;
  return Array.isArray(extracted) ? { records: extracted } : undefined;
};

function feed(fresh: JsonObject[] | "fails") {
  const sent: Command[] = [];
  const { run } = runOf(async (_session, command) => {
    sent.push(command);
    if (command.actionType !== READ) return { status: "succeeded" };
    return fresh === "fails" ? { status: "failed", failure: { code: "web.target.not_found" } } : { status: "succeeded", payload: { extracted: fresh } };
  });
  webNodeReplayedReads(run).remember({ command: { actionType: READ, parameters: { extractList: { handle: "list" } } }, parameters: { extractList: {} }, rows: ROWS });
  return { run, sent };
}

test("a pass whose row was redrawn re-reads its list once and is scoped to the same row, fresh", async () => {
  const fresh = { author: "Mara Quill", text: "Kayak trip on the north lake", likes: "13 likes" };
  const { run, sent } = feed([fresh, ROWS[0]!]);
  const reacquire = webNodeReplayRowReacquire(run, { item: ROWS[1], parameters: PRESS, metadata: { callId: "pass.2" }, readRows });
  assert.ok(reacquire);
  const found = await reacquire(STALE_FAILURE);
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  const element = found.parameters.element as JsonObject;
  assert.deepEqual((element.context as { record: JsonObject }).record.values, ["Mara Quill", "Kayak trip on the north lake", "13 likes"]);
  assert.deepEqual(sent, [{ actionType: READ, parameters: { extractList: { handle: "list" } }, metadata: { callId: "pass.2" } }]);
});

test("a row no longer in the list is gone; a re-read that fails or reads nothing is unavailable", async () => {
  const someoneElse = { author: "Ilya Brandt", text: "Kayak trip on the north lake", likes: "12 likes" };
  assert.deepEqual(await webNodeReplayRowReacquire(feed([ROWS[0]!, someoneElse]).run, { item: ROWS[1], parameters: PRESS, metadata: {}, readRows })!(STALE_FAILURE), { outcome: "gone" });
  assert.deepEqual(await webNodeReplayRowReacquire(feed("fails").run, { item: ROWS[1], parameters: PRESS, metadata: {}, readRows })!(STALE_FAILURE), { outcome: "unavailable" });
  assert.deepEqual(await webNodeReplayRowReacquire(feed([]).run, { item: ROWS[1], parameters: PRESS, metadata: {}, readRows })!(STALE_FAILURE), { outcome: "unavailable" });
  // A row no remembered read answered has no source to re-read.
  assert.deepEqual(await webNodeReplayRowReacquire(feed([ROWS[1]!]).run, { item: { author: "Nobody", text: "Elsewhere", likes: "1" }, parameters: PRESS, metadata: {}, readRows })!(STALE_FAILURE), { outcome: "unavailable" });
  // No row, or no control to scope: nothing to find again.
  assert.equal(webNodeReplayRowReacquire(feed([]).run, { item: undefined, parameters: PRESS, metadata: {}, readRows }), undefined);
  assert.equal(webNodeReplayRowReacquire(feed([]).run, { item: ROWS[1], parameters: { selector: "#x" }, metadata: {}, readRows }), undefined);
});

// --- The exploration press on a looked-up handle --------------------------------

function cards(order: string[], prefix: string): JsonObject {
  return {
    url: "https://social.test/feed",
    title: "Feed",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: order.map((who, index) => ({ tagName: "button", selector: `${prefix} > article:nth-of-type(${index + 1}) > button`, accessibleName: `Like ${who}'s post`, visibleText: "Like" }))
  };
}

function page(snapshots: JsonObject[]) {
  let looks = 0;
  return runOf(async (_session, command) => {
    if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshots[Math.min(looks++, snapshots.length - 1)]! } };
    return { status: "succeeded" };
  });
}

/** The run's look, as `../../run.ts` takes it: the page as it stands. */
function lookOf(run: WebNodeRun) {
  return async () => await captureEvidence(run.gateway, run.sessionId, run.request);
}

async function staleLike(): Promise<JsonObject> {
  const { run } = page([cards(["Ilya", "Mara"], "#feed")]);
  const binding = await captureEvidence(run.gateway, run.sessionId, run.request);
  const element = binding.evidence.elements.find((candidate) => candidate.name === "Like Mara's post")!;
  const selector = binding.selectors.get(element.target)!;
  return { selector, element: webPacketElementFingerprint(element, { selector }) as unknown as JsonObject };
}

test("a press whose control was renumbered looks again and is dispatched on the same control's fresh selector", async () => {
  const stale = await staleLike();
  const { run, looked } = page([cards(["Mara", "Ilya", "Noor"], "#feed-v2")]);
  const reacquire = webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, look: lookOf(run) });
  assert.ok(reacquire);
  const found = await reacquire(STALE_FAILURE);
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  assert.equal(found.parameters.selector, "#feed-v2 > article:nth-of-type(1) > button");
  assert.equal((found.parameters.element as JsonObject).accessibleName, "Like Mara's post");
  assert.equal(looked.length, 1);
});

test("a control no look shows is gone; two that could be it are unmatched; a step with no handle has no finder", async () => {
  const stale = await staleLike();
  const gone = page([cards(["Ilya", "Noor"], "#feed-v2")]);
  assert.deepEqual(await webNodeLookedUpReacquire(gone.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, look: lookOf(gone.run) })!(STALE_FAILURE), { outcome: "gone" });
  const twice = page([cards(["Mara", "Mara"], "#feed-v2")]);
  assert.deepEqual(await webNodeLookedUpReacquire(twice.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, look: lookOf(twice.run) })!(STALE_FAILURE), { outcome: "unmatched" });
  // A look that cannot be read propagates, and Core's callback reads it as unavailable (`../reacquire.ts`).
  const unread = webNodeLookedUpReacquire(gone.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, look: async () => { throw new Error("page_unreadable"); } })!;
  await assert.rejects(unread(STALE_FAILURE));
  assert.deepEqual(await webNodeRetryReacquire(gone.run, { actionType: "web.dom.click", parameters: stale, metadata: {} }, unread, [])({ failure: STALE_FAILURE }), { outcome: "unavailable" });
  assert.equal(webNodeLookedUpReacquire(gone.run, { definitionId: "web.output.dom-click", handle: undefined, parameters: stale, look: lookOf(gone.run) }), undefined);
});
