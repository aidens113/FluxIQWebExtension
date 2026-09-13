// The wait a recorded DOM addition proposes before the click after it (W25,
// option 2 of `i-late-target-wait`).
//
// Every entry is shaped as Core hands it to the mapper once the mapper has
// unwrapped it: a mutation batch as an `input.event` observation carrying
// `{ latestEvidence }`, a live click as an `action` entry whose parameters are
// the domain's own output payload, and a recorded event built by the domain's
// recording event builder. No row spells a wire field the builders make.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationRecordingEvent } from "../../../client";
import { webAutomationOutputPayload } from "../../../output-nodes";
import { webAutomationLateTargetWait } from "../late-target-wait";

type Step = Parameters<typeof webAutomationLateTargetWait>[0];

const PAGE = "https://example.test/scenarios/delayed-ui/";
const OTHER_PAGE = "https://example.test/scenarios/delayed-ui/other";
const LATE = "#late-action";

const lateWait = { outputId: "web.dom.wait_for_selector", parameters: { selector: LATE, wait: { condition: "present" } }, confidence: 0.9, label: "Wait for element" };

/** A mutation batch as recording evidence: Core's `input.event` observation, payload `{ latestEvidence }`. */
function mutation(added: number, url = PAGE): Step {
  return evidence({ kind: "dom.mutation", url, title: "Delayed UI", sequence: 2, timestamp: 1_000, mutation: { added, removed: 0, attributes: 0, text: 0 } });
}

function evidence(latestEvidence: JsonObject): Step {
  return { eventType: "input.event", timestamp: 1_000, payload: { latestEvidence }, metadata: { inputId: "web.recording.evidence", inputRole: "event", policyEligible: false } };
}

/** A recorded event as the domain's builder makes it, unwrapped. */
function recorded(input: Parameters<typeof createWebAutomationRecordingEvent>[0], frameId?: number): Step {
  const wire = createWebAutomationRecordingEvent(input, frameId === undefined ? {} : { tabId: 7, frameId });
  return { eventType: wire.eventType, timestamp: input.eventTimestampMs, payload: wire.payload ?? {}, metadata: wire.metadata ?? {} };
}

function clickEvent(input: { url?: string; selector?: string; frameId?: number } = {}): Step {
  const element = input.selector === undefined ? { selector: LATE, tagName: "button", text: "Late action" } : { selector: input.selector, tagName: "button" };
  return recorded({ kind: "dom.click", sequence: 3, url: input.url ?? PAGE, title: "Delayed UI", eventTimestampMs: 1_100, element }, input.frameId);
}

/** A live click as Core stores it: an `action` entry whose parameters are the output payload of the recorded click. */
function clickEntry(input: { outputId?: string; parameters?: JsonObject; frameId?: number } = {}): Step {
  const parameters = input.parameters ?? webAutomationOutputPayload("web.dom.click", clickEvent({ ...(input.frameId === undefined ? {} : { frameId: input.frameId }) }).payload);
  const outputId = input.outputId ?? "web.dom.click";
  return {
    eventType: "action",
    timestamp: 1_100,
    payload: { type: "action", actionType: outputId, outputId, confirmationInputId: "web.user.element_clicked", confirmationTimeoutMs: 5_000, parameters, origin: "operator", startedAt: 1_100, completedAt: 1_100 },
    metadata: { inputId: "web.user.element_clicked", inputRole: "action", policyEligible: true }
  };
}

test("a mutation that added nodes, then a click in the same document, proposes waiting for the click's selector", () => {
  assert.deepEqual(webAutomationLateTargetWait(mutation(1), [clickEntry()]), lateWait, "the live form: a Core action entry");
  assert.deepEqual(webAutomationLateTargetWait(mutation(3), [clickEvent()]), lateWait, "the recorded-event form");
  assert.deepEqual(webAutomationLateTargetWait(mutation(1), [clickEvent({ url: `${PAGE}#details` })]), lateWait, "a fragment does not change the document");
});

test("the wait carries no timeout, source input or confirmation", () => {
  const wait = webAutomationLateTargetWait(mutation(1), [clickEntry()]);
  assert.ok(wait);
  assert.equal("timeoutMs" in (wait.parameters ?? {}), false);
  assert.equal("sourceInputIds" in wait, false);
  assert.equal("expectedConfirmation" in wait, false);
});

test("evidence before the click is skipped", () => {
  const tab = evidence({ kind: "browser.tab", url: PAGE, title: "Delayed UI", sequence: 0, timestamp: 1_050 });
  const navigation = recorded({ kind: "browser.navigation", sequence: 0, url: PAGE, title: "", eventTimestampMs: 1_060, metadata: { transition: "link" } });
  assert.deepEqual(webAutomationLateTargetWait(mutation(1), [tab, navigation, clickEntry()]), lateWait);
});

test("a batch that added nothing proposes nothing", () => {
  assert.equal(webAutomationLateTargetWait(mutation(0), [clickEntry()]), undefined);
  assert.equal(webAutomationLateTargetWait(evidence({ kind: "dom.mutation", url: PAGE, timestamp: 1_000 }), [clickEntry()]), undefined, "a batch with no counts");
  assert.equal(webAutomationLateTargetWait(evidence({ kind: "browser.tab", url: PAGE, timestamp: 1_000 }), [clickEntry()]), undefined, "evidence that is not a mutation");
});

test("when the next executable entry is not a click, nothing is proposed, even with a click after it", () => {
  const typed = recorded({ kind: "dom.input", sequence: 3, url: PAGE, title: "Delayed UI", eventTimestampMs: 1_100, element: { selector: "input[name=q]", tagName: "input" }, inputValue: "ada" });
  assert.equal(webAutomationLateTargetWait(mutation(1), [typed, clickEntry()]), undefined, "the recorded-event form");
  assert.equal(webAutomationLateTargetWait(mutation(1), [clickEntry({ outputId: "web.dom.type", parameters: { selector: "input[name=q]", text: "ada" } }), clickEntry()]), undefined, "the live form");
});

test("a click with no selector proposes nothing", () => {
  const coordinatesOnly = clickEntry({ parameters: { visualTarget: { namespace: "web", bounds: { x: 10, y: 20, width: 90, height: 30 } } } });
  assert.equal(webAutomationLateTargetWait(mutation(1), [coordinatesOnly]), undefined);
  assert.equal(webAutomationLateTargetWait(mutation(1), [clickEntry({ parameters: { selector: "" } })]), undefined, "an empty selector");
});

test("a click in another document or frame proposes nothing", () => {
  assert.equal(webAutomationLateTargetWait(mutation(1), [clickEvent({ url: OTHER_PAGE })]), undefined, "the click names another URL");
  assert.equal(webAutomationLateTargetWait(mutation(1, "not a url"), [clickEntry()]), undefined, "the mutation names no document");
  assert.equal(webAutomationLateTargetWait(mutation(1), [evidence({ kind: "browser.tab", url: OTHER_PAGE, timestamp: 1_050 }), clickEntry()]), undefined, "evidence between them names another URL");
  assert.equal(webAutomationLateTargetWait(mutation(1), [clickEntry({ frameId: 2 })]), undefined, "a live click in a child frame");
  assert.equal(webAutomationLateTargetWait(mutation(1), [clickEvent({ frameId: 2 })]), undefined, "a recorded click in a child frame");
  assert.deepEqual(webAutomationLateTargetWait(mutation(1), [clickEntry({ frameId: 0 })]), lateWait, "frame 0 is the top document");
});

test("with no executable entry after it, a mutation proposes nothing", () => {
  assert.equal(webAutomationLateTargetWait(mutation(1), []), undefined);
  assert.equal(webAutomationLateTargetWait(mutation(1), [evidence({ kind: "browser.tab", url: PAGE, timestamp: 1_050 })]), undefined);
});

test("only a mutation proposes: a click's own entry proposes nothing, so Core's fallback click is not replaced", () => {
  assert.equal(webAutomationLateTargetWait(clickEntry(), [clickEntry()]), undefined);
  assert.equal(webAutomationLateTargetWait(clickEvent(), [clickEntry()]), undefined);
});
