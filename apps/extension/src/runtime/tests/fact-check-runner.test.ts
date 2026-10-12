// Coverage of fact-check-runner.ts: one message per frame a batch names, the
// answers put back in claim order, and every frame that could not be read
// answering its claims unknown.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationFactCheckReading, WebAutomationFactQuery } from "@fluxiq-web-extension/domain/client";
import type { FactCheckContentMessage } from "../../shared/fact-check-message";
import { runFactCheck } from "../fact-check-runner";

const AT = 1_760_000_000_000;
const TOP: WebAutomationFactQuery = { kind: "dialog", expected: true };
const IN_FRAME: WebAutomationFactQuery = { kind: "exists", target: { selector: "#card" }, expected: true, frameId: 4 };
const ALSO_TOP: WebAutomationFactQuery = { kind: "url", comparison: "contains", expected: "/checkout" };

type Sent = { tabId: number; frameId: number; message: FactCheckContentMessage };

function sender(reply: (message: FactCheckContentMessage, frameId: number) => unknown): { sent: Sent[]; send: (tabId: number, message: FactCheckContentMessage, frameId: number) => Promise<unknown> } {
  const sent: Sent[] = [];
  return {
    sent,
    send: async (tabId, message, frameId) => {
      sent.push({ tabId, frameId, message });
      return reply(message, frameId);
    }
  };
}

/** A frame that answers every claim it is sent `true`. */
function allTrue(message: FactCheckContentMessage, frameId: number): unknown {
  return { answers: message.request.queries.map(() => ({ result: "true", capturedAt: AT })), document: { url: `frame-${frameId}`, readyState: "complete" } };
}

test("each frame is asked once with its own claims, and the answers come back in claim order", async () => {
  const frames = sender(allTrue);
  const reading: WebAutomationFactCheckReading = { queries: [TOP, IN_FRAME, ALSO_TOP], documentTimeOrigin: 77 };
  const result = await runFactCheck(reading, { tabId: 9, send: frames.send, now: () => AT });
  assert.equal(frames.sent.length, 2);
  const top = frames.sent.find((entry) => entry.frameId === 0);
  const child = frames.sent.find((entry) => entry.frameId === 4);
  assert.deepEqual(top?.message.request.queries, [TOP, ALSO_TOP]);
  assert.equal(top?.message.request.documentTimeOrigin, 77);
  // The document identity is the top document's; a child frame is another one.
  assert.equal(child?.message.request.documentTimeOrigin, undefined);
  assert.equal(child?.message.frameId, 4);
  assert.deepEqual(result.answers.map((answer) => answer.result), ["true", "true", "true"]);
  assert.deepEqual(result.document, { url: "frame-0", readyState: "complete" });
});

test("a frame that does not answer leaves its claims unknown and the other frames' answers stand", async () => {
  const frames = sender((message, frameId) => {
    if (frameId === 4) throw new Error("Could not establish connection. Receiving end does not exist.");
    return allTrue(message, frameId);
  });
  const result = await runFactCheck({ queries: [TOP, IN_FRAME] }, { tabId: 9, send: frames.send, now: () => AT });
  assert.deepEqual(result.answers.map((answer) => [answer.result, answer.evidence?.reason]), [["true", undefined], ["unknown", "unreadable_frame"]]);
});

test("with no tab to read, every claim is unknown and nothing is sent", async () => {
  const frames = sender(allTrue);
  const result = await runFactCheck({ queries: [TOP, ALSO_TOP] }, { tabId: undefined, send: frames.send, now: () => AT });
  assert.equal(frames.sent.length, 0);
  assert.ok(result.answers.every((answer) => answer.result === "unknown" && answer.evidence?.reason === "unreadable_frame"));
});

test("a reply that answers other claims than those sent is unknown, never false", async () => {
  const frames = sender(() => ({ answers: [{ result: "false", capturedAt: AT }] }));
  const result = await runFactCheck({ queries: [TOP, ALSO_TOP] }, { tabId: 1, send: frames.send, now: () => AT });
  assert.deepEqual(result.answers.map((answer) => [answer.result, answer.evidence?.reason]), [["unknown", "capture_failed"], ["unknown", "capture_failed"]]);
});

test("an unreadable claim is not sent and keeps its slot", async () => {
  const frames = sender(allTrue);
  const result = await runFactCheck({ queries: [undefined, TOP] }, { tabId: 1, send: frames.send, now: () => AT });
  assert.deepEqual(frames.sent[0]?.message.request.queries, [TOP]);
  assert.deepEqual(result.answers.map((answer) => [answer.result, answer.evidence?.reason]), [["unknown", "unsupported"], ["true", undefined]]);
});
