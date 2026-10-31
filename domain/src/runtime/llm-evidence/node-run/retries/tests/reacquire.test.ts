// A node a build runs against the live page finds its stale target again
// (t786, D7), with the page stubbed at the gateway where the domain meets it:
// the conversion into Core's `reacquire` answer, a row-bound replay that
// re-reads its list and is scoped to the fresh row, and an exploration press
// that looks again and acts on the same control under its new handle. Core
// decides when to ask; these call the callbacks directly.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_TARGET_GONE_CODE, parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
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
    frame: { isTop: true },
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: order.map((who, index) => ({ tagName: "button", selector: `${prefix} > article:nth-of-type(${index + 1}) > button`, accessibleName: `Like ${who}'s post`, visibleText: "Like" })),
    evidence: {
      elements: { scanned: order.length, candidates: order.length, matched: order.length, returned: order.length, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: 100 }, captureOptions: { includeHidden: true }
    }
  };
}

function page(snapshots: JsonObject[]) {
  let looks = 0;
  return runOf(async (_session, command) => {
    if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshots[Math.min(looks++, snapshots.length - 1)]!, sourceId: "tab:17:frame:0" } };
    return { status: "succeeded" };
  });
}

/** The run's look, as `../../run.ts` takes it: the page as it stands. */
function lookOf(run: WebNodeRun) {
  return async (options?: Parameters<typeof captureEvidence>[5]) => await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal, undefined, options);
}

async function priorLike() {
  const { run } = page([cards(["Ilya", "Mara"], "#feed")]);
  return captureEvidence(run.gateway, run.sessionId, run.request);
}

async function staleLike(): Promise<JsonObject> {
  const binding = await priorLike();
  const element = binding.evidence.elements.find((candidate) => candidate.name === "Like Mara's post")!;
  const selector = binding.selectors.get(element.target)!;
  return { selector, element: webPacketElementFingerprint(element, { selector }) as unknown as JsonObject };
}

test("a press whose control was renumbered looks again and is dispatched on the same control's fresh selector", async () => {
  const stale = await staleLike();
  const { run, looked } = page([cards(["Mara", "Ilya", "Noor"], "#feed-v2")]);
  const reacquire = webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, before: await priorLike(), look: lookOf(run) });
  assert.ok(reacquire);
  const found = await reacquire(STALE_FAILURE);
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  assert.equal(found.parameters.selector, "#feed-v2 > article:nth-of-type(1) > button");
  assert.equal((found.parameters.element as JsonObject).accessibleName, "Like Mara's post");
  assert.equal(looked.length, 1);
});

test("only complete absence is gone; ambiguity remains unmatched; a saved identity needs no transient handle", async () => {
  const stale = await staleLike();
  const before = await priorLike();
  const gone = page([cards(["Ilya", "Noor"], "#feed-v2")]);
  assert.deepEqual(await webNodeLookedUpReacquire(gone.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, before, look: lookOf(gone.run) })!(STALE_FAILURE), { outcome: "gone" });
  const twice = page([cards(["Mara", "Mara"], "#feed-v2")]);
  assert.deepEqual(await webNodeLookedUpReacquire(twice.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, before, look: lookOf(twice.run) })!(STALE_FAILURE), { outcome: "unmatched" });
  // A look that cannot be read propagates, and Core's callback reads it as unavailable (`../reacquire.ts`).
  const unread = webNodeLookedUpReacquire(gone.run, { definitionId: "web.output.dom-click", handle: "t7", parameters: stale, before, look: async () => { throw new Error("page_unreadable"); } })!;
  await assert.rejects(unread(STALE_FAILURE));
  assert.deepEqual(await webNodeRetryReacquire(gone.run, { actionType: "web.dom.click", parameters: stale, metadata: {} }, unread, [])({ failure: STALE_FAILURE }), { outcome: "unavailable" });
  const renamed = page([cards(["Mara"], "#renewed")]);
  const noHandle = webNodeLookedUpReacquire(renamed.run, { definitionId: "web.output.dom-click", handle: undefined, parameters: stale, before, look: lookOf(renamed.run) });
  assert.ok(noHandle);
  const refreshed = await noHandle(STALE_FAILURE);
  assert.equal(refreshed.outcome, "found");
  assert.equal(refreshed.outcome === "found" && refreshed.parameters.selector, "#renewed > article:nth-of-type(1) > button");
});

test("authoring pins a scoped hidden-inclusive read and preserves action arguments and read semantics", async () => {
  const fieldAt = (selector: string): JsonObject => ({
    url: "https://preferences.test/profile", title: "Profile preferences", frame: { isTop: true },
    interactiveElements: [{ tagName: "input", inputType: "text", selector, accessibleName: "Display title", label: "Display title", attributes: { id: "display-title", name: "displayTitle", "data-testid": "profile-display-title" } }],
    evidence: {
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: 100 }, captureOptions: { includeHidden: true }
    }
  });
  const original = page([fieldAt("#original-form input[name='displayTitle']")]);
  const before = await captureEvidence(original.run.gateway, original.run.sessionId, original.run.request);
  const field = before.evidence.elements[0]!;
  const selector = before.selectors.get(field.target)!;
  const stale: JsonObject = { selector, element: webPacketElementFingerprint(field, { selector }) as unknown as JsonObject };
  (stale.element as JsonObject).readsWords = true;
  const parameters: JsonObject = { ...stale, text: "original value", ensureState: { value: true }, timeoutMs: 900 };
  const sent: Command[] = [];
  const { run, looked } = runOf(async (session, command) => {
    assert.equal(session, "session.one");
    sent.push(command);
    return { status: "succeeded", payload: { snapshot: fieldAt("#renewed-form input[name='displayTitle']"), sourceId: "tab:17:frame:0" } };
  });
  const callback = webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-type", handle: undefined, parameters, before, look: lookOf(run) });
  assert.ok(callback);
  const answer = await callback(STALE_FAILURE);
  assert.equal(answer.outcome, "found");
  if (answer.outcome !== "found") return;
  assert.deepEqual(sent[0]!.parameters, { includeHidden: true, browserTabId: 17, browserFrameId: 0 });
  assert.equal((sent[0] as Command & { timeoutMs?: number }).timeoutMs, 5_000);
  assert.equal(answer.parameters.text, "original value");
  assert.deepEqual(answer.parameters.ensureState, { value: true });
  assert.equal(answer.parameters.timeoutMs, 900);
  assert.equal((answer.parameters.element as JsonObject).readsWords, true);
  assert.equal(looked.length, 1);
  assert.equal(parameters.selector, stale.selector);
});

test("authoring declines state-bound targets, rows, unsupported reads and absent prior resource proof", async () => {
  const stale = await staleLike();
  const { run } = page([cards(["Mara"], "#fresh")]);
  const savedElement = stale.element as JsonObject;
  for (const parameters of [{ ...stale, target: { handle: "t7" } }, { selector: "#bare" }, { ...stale, element: { ...savedElement, context: { record: { values: ["row one"] } } } }]) {
    assert.equal(webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters, look: lookOf(run) }), undefined);
  }
  assert.equal(webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-extract_list", handle: undefined, parameters: stale, look: lookOf(run) }), undefined);
  let reads = 0;
  const missing = webNodeLookedUpReacquire(run, {
    definitionId: "web.output.dom-click", handle: undefined, parameters: stale,
    look: async () => {
      reads += 1;
      return undefined;
    }
  });
  assert.deepEqual(await missing!(STALE_FAILURE), { outcome: "unavailable" });
  assert.equal(reads, 0);
});

test("a scoped authoring read never silently selects a different gateway session", async () => {
  let commands = 0;
  const { run } = runOf(async () => {
    commands += 1;
    return { status: "succeeded" };
  });
  await assert.rejects(captureEvidence(run.gateway, run.sessionId, run.request, undefined, undefined, { includeHidden: true, scope: { kind: "single-frame", sessionId: "paired.previous", browserTabId: 17, browserFrameId: 0 } }));
  assert.equal(commands, 0);
});

test("scoped authoring can refresh a child only from its actual prior document", async () => {
  const stale = await staleLike();
  const sent: Command[] = [];
  const { run } = runOf(async (_session, command) => {
    sent.push(command);
    const raw = cards(["Mara"], "#child-fresh");
    raw.url = "https://social.test/editor";
    raw.frame = { isTop: false };
    return { status: "succeeded", payload: { snapshot: raw, sourceId: "tab:17:frame:4" } };
  });
  const scope = { kind: "single-frame" as const, browserTabId: 17, browserFrameId: 4, browserFrameUrlPath: "/editor" };
  const before = await captureEvidence(run.gateway, run.sessionId, run.request, undefined, undefined, { includeHidden: true, scope });
  const parameters = { ...stale, browserFrameId: 4, browserFrameUrlPath: "/editor" };
  const found = await webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters, before, look: lookOf(run) })!(STALE_FAILURE);
  assert.equal(found.outcome, "found");
  assert.deepEqual(sent.at(-1)!.parameters, { includeHidden: true, browserTabId: 17, browserFrameId: 4, browserFrameUrlPath: "/editor" });
  const unknownChild = await webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters, before: await priorLike(), look: lookOf(run) })!(STALE_FAILURE);
  assert.deepEqual(unknownChild, { outcome: "unavailable" });
  const legacy = await webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters: { ...stale, tabId: 17, frameId: 4, browserFrameUrlPath: "/editor" }, before, look: lookOf(run) })!(STALE_FAILURE);
  assert.equal(legacy.outcome, "found");
  const canonical = await webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters: { ...parameters, browserTabId: 17, tabId: 99, frameId: 9 }, before, look: lookOf(run) })!(STALE_FAILURE);
  assert.equal(canonical.outcome, "found");
});

test("partial, unacknowledged hidden capture and hidden look-alikes never turn authoring recovery into gone", async () => {
  const stale = await staleLike();
  const before = await priorLike();
  for (const mode of ["partial", "marker", "hidden", "place"] as const) {
    const raw = cards(["Mara"], "#fresh");
    const evidence = raw.evidence as JsonObject;
    if (mode === "partial") (evidence.elements as JsonObject).truncated = true;
    if (mode === "marker") delete evidence.captureOptions;
    if (mode === "hidden") ((raw.interactiveElements as JsonObject[])[0]!).hidden = true;
    if (mode === "place") raw.url = "https://social.test/elsewhere";
    const { run } = page([raw]);
    const answer = await webNodeLookedUpReacquire(run, { definitionId: "web.output.dom-click", handle: undefined, parameters: stale, before, look: lookOf(run) })!(STALE_FAILURE);
    assert.ok(answer.outcome === "unavailable" || answer.outcome === "unmatched", mode);
  }
});

test("authoring cancellation during a late read discards the replacement", async () => {
  const stale = await staleLike();
  const before = await priorLike();
  const controller = new AbortController();
  const { run } = page([cards(["Mara"], "#fresh")]);
  run.request = { ...run.request, signal: controller.signal };
  const callback = webNodeLookedUpReacquire(run, {
    definitionId: "web.output.dom-click", handle: undefined, parameters: stale, before,
    look: async (options) => {
      const captured = await lookOf(run)(options);
      controller.abort();
      return captured;
    }
  });
  const answer = await webNodeRetryReacquire(run, { actionType: "web.dom.click", parameters: stale, metadata: {} }, callback!, [])({ failure: STALE_FAILURE });
  assert.deepEqual(answer, { outcome: "unavailable" });
});


test("fresh-target dispatch records original thrown failures and unknown acknowledgements in the same attempt history", async () => {
  for (const attached of [true, false]) {
    const original: AutomationStudioFailureRecord = { category: "action_failed", code: "web.transport.transient", retryable: true, stage: "execution", effect: "ambiguous" };
    const { run } = runOf(async () => { throw attached ? Object.assign(new Error("lost"), { failure: original }) : new Error("lost"); });
    const answers: WebNodeDispatchResult[] = [];
    const reacquire = webNodeRetryReacquire(run, { actionType: "web.dom.click", parameters: {}, metadata: {} }, async () => ({ outcome: "found", parameters: { selector: "#fresh" } }), answers);
    const fresh = await reacquire({ failure: STALE_FAILURE });
    assert.equal(fresh.outcome, "found");
    if (fresh.outcome !== "found") continue;
    const result = await fresh.dispatch(4);
    assert.equal(answers.length, 1);
    assert.equal(answers[0], result);
    assert.equal(result.status, attached ? "failed" : "unknown");
    assert.equal(parseAutomationStudioFailureRecord(result.failure)?.effect, attached ? "ambiguous" : undefined);
  }
});
