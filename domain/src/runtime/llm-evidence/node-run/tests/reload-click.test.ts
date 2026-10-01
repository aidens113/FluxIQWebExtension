// A click that reloads the page it acted on is a click that worked, and what
// comes back is the page after the reload.
//
// Built from the bigbox store switch of `run-muncqlr0-3348202b`: the store
// flyout is open, "Set as my store" saves the store and then calls
// `location.reload()`, and the chip at the top of the new document names the
// store that is now current. The page the click is run against is stubbed at
// the gateway, which is exactly where the domain meets it: the click answers
// `succeeded`, and the looks after it meet the page between two documents --
// the old document's channel closes under a look, which the extension answers
// as a failed capture -- before the new document answers.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const URL_OF_PAGE = "https://bigbox.example.test/";
const OLD_STORE = "Pinecrest Plaza";
const NEW_STORE = "Millbrook Crossing Supercenter";
const SET_STORE = "#store-millbrook .set-store";
/** Chrome's words for a document that went while a message was in it. */
const PORT_CLOSED = "The message port closed before a response was received.";

type Packet = JsonObject & { page?: string; pageChanged?: boolean; pageUnreadable?: boolean };

/** The words of every line of the page a result carries (t223). */
function wordsOn(evidence: Packet): Array<string | undefined> {
  return shownPageLines(evidence).map((line) => line.words);
}

/**
 * The store page, before and after the switch. `unreadableLooks` is how many
 * looks after the click meet the page between documents before the new one
 * answers; `Infinity` is a page that never comes back.
 */
function storePage(unreadableLooks: number) {
  const commands: string[] = [];
  let phase: "before" | "reloading" | "after" = "before";
  let unreadable = unreadableLooks;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.click") {
        // The handler saves and then reloads; the click itself has landed.
        phase = "reloading";
        return { status: "succeeded", payload: { value: "ok" } };
      }
      if (phase === "reloading" && unreadable > 0) {
        unreadable -= 1;
        return { status: "failed", error: PORT_CLOSED };
      }
      if (phase === "reloading") phase = "after";
      return { status: "succeeded", payload: { snapshot: phase === "before" ? flyoutOpen() : reloaded() } };
    }
  };
  return { gateway, commands };
}

/** The old document: the chip names the old store and the flyout lists the stores. */
function flyoutOpen(): JsonObject {
  return {
    url: URL_OF_PAGE,
    title: "BigBox",
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#store-chip", visibleText: OLD_STORE },
      { tagName: "button", selector: "#store-flyout .close", accessibleName: "Close" },
      { tagName: "button", selector: SET_STORE, visibleText: "Set as my store" }
    ]
  };
}

/** The new document: the flyout is closed and the chip names the new store. */
function reloaded(): JsonObject {
  return {
    url: URL_OF_PAGE,
    title: "BigBox",
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#store-chip", visibleText: NEW_STORE },
      { tagName: "input", selector: "#search", inputType: "search", accessibleName: "Search" }
    ]
  };
}

async function pickStore(gateway: WebLlmEvidenceGateway, signal?: AbortSignal) {
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const button = shownHandle(looked.evidence, "Set as my store");
  const request = { ...PROJECT, callId: "pick-millbrook", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: button } }, consequences: [] } };
  return signal ? await runtime.executeTool({ ...request, signal }) : await runtime.executeTool(request);
}

function assertAppliedStep(picked: Awaited<ReturnType<typeof pickStore>>): void {
  assert.equal(picked.resultCode, "web.action.succeeded");
  assert.equal(picked.effectApplied, true);
  assert.equal(picked.draft?.actionId, CLICK);
  assert.equal(picked.draft?.proposes, true);
  assert.equal((picked.draft?.ranWith?.parameters as { selector?: string }).selector, SET_STORE);
  assert.deepEqual(picked.draft?.replay?.from, { location: URL_OF_PAGE });
}

test("a click whose page reloads under the look after it is applied, with the page after the reload", async () => {
  const page = storePage(1);
  const picked = await pickStore(page.gateway);
  assertAppliedStep(picked);
  const evidence = picked.evidence as Packet;
  assert.equal(evidence.pageChanged, true);
  assert.equal(evidence.pageUnreadable, undefined);
  // The chip of the new document says the switch took; the flyout of the old one is gone.
  const texts = wordsOn(evidence);
  assert.equal(texts.includes(NEW_STORE), true);
  assert.equal(texts.includes(OLD_STORE), false);
  assert.equal(texts.includes("Set as my store"), false);
  // look, look before the click, the click, the look that met the reload, the look that read the new page.
  assert.deepEqual(page.commands, ["web.dom.capture_snapshot", "web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot", "web.dom.capture_snapshot"]);
});

// Characterisation, not a regression: the shape run 6's own timings fit. The
// extension waits for the tab to settle before the look after a click, so a
// reload that starts quickly is already over when that look arrives.
test("a click whose reload is over before the look after it is applied, with the page after the reload", async () => {
  const page = storePage(0);
  const picked = await pickStore(page.gateway);
  assertAppliedStep(picked);
  const evidence = picked.evidence as Packet;
  assert.equal(evidence.pageChanged, true);
  assert.equal(wordsOn(evidence).includes(NEW_STORE), true);
});

// Audit A2, cause 1: the extension now answers a click whose page navigated
// before it could reply as `succeeded`, with a note that says so and no
// payload of the frame's own, where it used to rethrow the lost reply as a
// failure the domain read as a refusal. The step must be applied from that answer.
test("a click answered only by the note that it navigated its page before answering is applied, with the page after the reload", async () => {
  const page = storePage(1);
  const navigatedBeforeAnswering: WebLlmEvidenceGateway = {
    eligibleSessionIds: page.gateway.eligibleSessionIds,
    executeAction: async (sessionId, command) => {
      const answer = await page.gateway.executeAction(sessionId, command);
      if (command.actionType !== "web.dom.click") return answer;
      return {
        status: "succeeded",
        message: "The click navigated its page before it could answer.",
        payload: {
          validation: {
            status: "passed",
            expected: "the page the click leads to loads",
            actual: "the click navigated its page before it could answer, and the page it landed on loaded"
          }
        }
      };
    }
  };
  const picked = await pickStore(navigatedBeforeAnswering);
  assertAppliedStep(picked);
  assert.notEqual(picked.draft?.replay, undefined);
  const evidence = picked.evidence as Packet;
  assert.equal(evidence.pageChanged, true);
  assert.equal(evidence.pageUnreadable, undefined);
  assert.equal(wordsOn(evidence).includes(NEW_STORE), true);
  assert.equal(wordsOn(evidence).includes("Set as my store"), false);
});

test("a click whose page never comes back is still applied, and says the page could not be read", async () => {
  const page = storePage(Number.POSITIVE_INFINITY);
  const startedAt = Date.now();
  const picked = await pickStore(page.gateway);
  const elapsed = Date.now() - startedAt;
  assertAppliedStep(picked);
  const evidence = picked.evidence as Packet;
  assert.equal(evidence.pageUnreadable, true);
  // Not compared, so not said; and no packet of a page nobody could read.
  assert.equal(evidence.pageChanged, undefined);
  assert.equal(evidence.page, undefined);
  assert.equal(evidence.ok, true);
  // Bounded: about five seconds of looks a quarter of a second apart, not a hang.
  assert.ok(elapsed < 7_000, `waited ${elapsed} ms`);
  const looksAfterClick = page.commands.slice(page.commands.indexOf("web.dom.click") + 1);
  assert.ok(looksAfterClick.length >= 2 && looksAfterClick.length <= 21, `${looksAfterClick.length} looks`);
});

test("cancelling while the page is between documents ends the call at once, with the cancellation", async () => {
  const page = storePage(Number.POSITIVE_INFINITY);
  const controller = new AbortController();
  const reason = new Error("build cancelled");
  const wrapped: WebLlmEvidenceGateway = {
    eligibleSessionIds: page.gateway.eligibleSessionIds,
    executeAction: async (sessionId, command) => {
      const answer = await page.gateway.executeAction(sessionId, command);
      // Cancel during the wait after the first look that met the reload.
      if (answer.status === "failed") setTimeout(() => controller.abort(reason), 20);
      return answer;
    }
  };
  const startedAt = Date.now();
  await assert.rejects(pickStore(wrapped, controller.signal), (error) => error === reason);
  assert.ok(Date.now() - startedAt < 2_000);
});
