// Coverage of evaluate.ts: one gateway command per batch, answers in condition
// order, and every way a page could not be read answered `unknown` -- never
// `false`, never a throw.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE, type WebAutomationFactAnswer } from "../../../actions/fact-check";
import { WEB_LLM_WITHHELD_TEXT } from "../../llm-evidence";
import { createWebAutomationFactEvaluator, type WebAutomationFactDispatch } from "../evaluate";

const AT = 1_760_000_000_000;
const BUTTON = { selector: "#continue" };

type Sent = { outputId: string; payload: JsonObject; timeoutMs?: number | undefined };

/** A gateway that answers each command with the next scripted outcome and records what was sent. */
function gateway(...outcomes: Array<Partial<OutputDispatchResult<JsonObject>> | Error>): { dispatch: WebAutomationFactDispatch; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    dispatch: async (request) => {
      sent.push({ outputId: request.outputId, payload: request.payload, timeoutMs: request.timeoutMs });
      const outcome = outcomes[sent.length - 1] ?? new Error("no scripted answer");
      if (outcome instanceof Error) throw outcome;
      return { outputId: request.outputId, ok: false, ...outcome } as OutputDispatchResult<JsonObject>;
    }
  };
}

/** The dispatch result the page's answers arrive in, wrapped as `dispatchWebAutomationOutput` wraps them. */
function answered(answers: WebAutomationFactAnswer[], url = "https://shop.test/s?k=earbuds"): Partial<OutputDispatchResult<JsonObject>> {
  return { ok: true, status: "succeeded", payload: { status: "succeeded", result: { answers, document: { url, readyState: "complete", timeOrigin: 42 } } as unknown as JsonObject } };
}

test("a whole batch is one command with no wait, and the answers come back in condition order", async () => {
  const page = gateway(answered([
    { result: "true", capturedAt: AT },
    { result: "false", capturedAt: AT },
    { result: "unknown", evidence: { reason: "unclassified_dialog" }, capturedAt: AT }
  ]));
  const evaluate = createWebAutomationFactEvaluator(page.dispatch, () => AT);
  const results = await evaluate([
    { fact: "exists", op: "exists", target: BUTTON },
    { fact: "text", op: "contains", value: "Sold out" },
    { fact: "dialog.promotion", op: "exists" }
  ], { documentTimeOrigin: 42 });

  assert.equal(page.sent.length, 1, "one batch is one gateway command");
  assert.equal(page.sent[0]?.outputId, WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE);
  const request = page.sent[0]?.payload as { queries: unknown[]; documentTimeOrigin?: number };
  assert.equal(request.queries.length, 3);
  assert.equal(request.documentTimeOrigin, 42);
  assert.deepEqual(results.map((result) => result.result), ["true", "false", "unknown"]);
  assert.equal(results[2]?.evidence?.reason, "unclassified_dialog");
});

test("a condition that cannot be asked is unknown without being sent, and the rest still are", async () => {
  const page = gateway(answered([{ result: "true", capturedAt: AT }]));
  const results = await createWebAutomationFactEvaluator(page.dispatch, () => AT)([
    { fact: "value", op: "equals", value: { input: "query" }, target: BUTTON },
    { fact: "loggedIn", op: "equals", value: true },
    { fact: "url", op: "contains", value: "/s?k=" }
  ]);
  assert.equal((page.sent[0]?.payload as { queries: unknown[] }).queries.length, 1);
  assert.deepEqual(results.map((result) => [result.result, result.evidence?.reason]), [["unknown", "unbound"], ["unknown", "unsupported"], ["true", undefined]]);
});

test("nothing askable sends nothing", async () => {
  const page = gateway();
  const results = await createWebAutomationFactEvaluator(page.dispatch, () => AT)([{ fact: "nope", op: "exists" }]);
  assert.equal(page.sent.length, 0);
  assert.deepEqual(results, [{ result: "unknown", evidence: { reason: "unsupported" }, capturedAt: AT }]);
});

test("a page that could not be read makes every asked condition unknown, never false", async () => {
  const conditions = [{ fact: "absent", op: "absent", target: BUTTON }, { fact: "dialog", op: "absent" }];
  const cases: Array<[string, Partial<OutputDispatchResult<JsonObject>> | Error]> = [
    ["the command failed", { ok: false, status: "failed", error: "Receiving end does not exist." }],
    ["the command timed out", { ok: false, status: "timed_out" }],
    ["no client was selected", { ok: false, error: "A single paired web-automation client must be selected." }],
    ["the gateway threw", new Error("socket closed")],
    ["the page answered with something else", { ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot: {} } } }],
    ["the page answered fewer claims", answered([{ result: "true", capturedAt: AT }])]
  ];
  for (const [label, outcome] of cases) {
    const results = await createWebAutomationFactEvaluator(gateway(outcome).dispatch, () => AT)(conditions);
    assert.deepEqual(results.map((result) => result.result), ["unknown", "unknown"], label);
    assert.ok(results.every((result) => result.evidence?.reason === "capture_failed"), label);
  }
});

test("the page's own unknowns -- an unreadable frame, a stale document, a document still loading -- reach Core as they are", async () => {
  const page = gateway(answered([
    { result: "unknown", evidence: { reason: "unreadable_frame" }, capturedAt: AT },
    { result: "unknown", evidence: { reason: "stale_document" }, capturedAt: AT },
    { result: "unknown", evidence: { reason: "loading" }, capturedAt: AT }
  ]));
  const results = await createWebAutomationFactEvaluator(page.dispatch, () => AT)([
    { fact: "visible", op: "visible", target: { ...BUTTON, frameId: 3 } },
    { fact: "enabled", op: "enabled", target: BUTTON },
    { fact: "absent", op: "absent", target: BUTTON }
  ]);
  assert.deepEqual(results.map((result) => result.evidence?.reason), ["unreadable_frame", "stale_document", "loading"]);
  assert.ok(results.every((result) => result.result === "unknown"));
  assert.equal(((page.sent[0]?.payload as { queries: Array<{ frameId?: number }> }).queries[0])?.frameId, 3);
});

test("what reaches Core is screened: a secret-shaped excerpt is withheld and an address is published as the packet publishes it", async () => {
  const page = gateway(answered([
    { result: "true", evidence: { excerpt: "Card 4111 1111 1111 1111 on file", element: { tagName: "p" } }, capturedAt: AT },
    { result: "true", capturedAt: AT }
  ], "https://user:pw@shop.test/s?k=earbuds"));
  const results = await createWebAutomationFactEvaluator(page.dispatch, () => AT)([
    { fact: "text", op: "contains", value: "on file" },
    { fact: "url", op: "contains", value: "/s" }
  ]);
  assert.equal(results[0]?.evidence?.excerpt, `Card ${WEB_LLM_WITHHELD_TEXT} on file`);
  // An address carrying credentials is not one the packet publishes, so no excerpt.
  assert.equal(results[1]?.evidence?.excerpt, undefined);
});

test("a cancelled run asks nothing", async () => {
  const page = gateway(answered([{ result: "true", capturedAt: AT }]));
  const controller = new AbortController();
  controller.abort();
  const results = await createWebAutomationFactEvaluator(page.dispatch, () => AT)([{ fact: "exists", op: "exists", target: BUTTON }], { signal: controller.signal });
  assert.equal(page.sent.length, 0);
  assert.equal(results[0]?.result, "unknown");
});

test("the evaluator never throws, whatever it is handed", async () => {
  const results = await createWebAutomationFactEvaluator(gateway().dispatch, () => AT)([null, 7, "x"]);
  assert.equal(results.length, 3);
  assert.ok(results.every((result) => result.result === "unknown"));
});
