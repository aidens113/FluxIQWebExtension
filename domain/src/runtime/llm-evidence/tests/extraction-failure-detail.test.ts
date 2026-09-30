// A failed extraction, end to end, as the model and a reader of the run see it.
//
// The run this pins is `run-mulryg6h-ff241a12`, 2026-09-28. Its build explored
// the everything-store competently for thirteen decisions, ran
// `web.output.dom-extract_list`, and was told `web.action.rejected.action_failed`
// with no reason attached. It amended one argument and ran it again: the same
// 6,149 bytes, byte for byte. It ran it a third time: the same bytes again. The
// three calls cost 37 seconds of page time and taught the model nothing, its
// draft never gained a record-producing step, Core's answerability check
// refused all three completion attempts, and the loop exhausted with no Flow.
//
// Two things had to be true for that to happen, and each has a test here. The
// extension's whole account of the read was computed and discarded on the way
// out, so the model could not tell which of seven shortfalls it was; and
// nothing anywhere noticed that the second and third answers were the first
// one again.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

const BASE = { projectId: "project.store", flowId: "flow.cart" } as const;
const EXTRACT_NODE = "web.output.dom-extract_list";

const CART = {
  url: "https://everything-store.test/cart",
  title: "Your cart",
  interactiveElements: [
    { tagName: "button", selector: "#save-for-later", accessibleName: "Save for later", attributes: { type: "button" } },
    { tagName: "button", selector: "#checkout", accessibleName: "Proceed to checkout", attributes: { type: "button" } }
  ]
};

/** What the page reports about a read whose item selector named nothing. */
const NEVER_APPEARED = {
  recordCount: 0,
  pagesRead: 1,
  truncated: false,
  missingFields: [],
  fieldNames: ["item", "quantity", "price"],
  itemsSeen: 0,
  emptyRecords: 0,
  listPresence: "never_appeared",
  listWait: { stoppedOn: "window_elapsed", waitedMs: 11_204, waitedFor: 1 }
};

type Read = { extraction: unknown; status: string; code: string };

/** A gateway whose cart page is always there and whose list read answers however the test says. */
function cartGateway(reads: { next(): Read }): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: CART } as unknown as JsonObject };
      const read = reads.next();
      return {
        status: read.status,
        failure: { code: read.code, actual: "0 records from 1 page; the item selector named nothing on the page" },
        payload: { extraction: read.extraction } as unknown as JsonObject
      };
    }
  };
}

function alwaysEmpty(): { next(): Read } {
  return { next: () => ({ extraction: NEVER_APPEARED, status: "failed", code: "web.validation.output_not_observed" }) };
}

function packet(execution: { evidence: unknown }): { code?: string; detail?: JsonObject; page?: JsonObject } {
  return execution.evidence as { code?: string; detail?: JsonObject; page?: JsonObject };
}

async function runExtraction(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, callId: string) {
  return await runtime.executeTool({ ...BASE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: {}, consequences: [] } });
}

test("a list read that came back with nothing tells the model why, and tells the run's own record too", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(cartGateway(alwaysEmpty()));
  const failed = await runExtraction(runtime, "call.extract");

  // What the model reads. `action_failed` was the whole of this until
  // 2026-09-28, and a model told only "it failed" has nothing to change.
  assert.equal(packet(failed).code, "output_not_observed");
  assert.deepEqual(packet(failed).detail, {
    reason: "list_never_appeared",
    recordsRead: 0,
    itemsSeen: 0,
    emptyRecords: 0,
    waitStoppedOn: "window_elapsed"
  });
  // The page still comes with it, so whatever has to be dealt with has a handle.
  assert.ok(packet(failed).page !== undefined);

  // What a reader of the run's bundle reads. Core records `resultCode` and
  // `resultReason` per step and nothing else of the refusal, so a reason that
  // reached only the packet would still leave the run undiagnosable afterwards
  // -- which is exactly why `run-mulryg6h-ff241a12` could not be told apart
  // from three other failure codes that fall through identically.
  assert.equal(failed.resultCode, "web.action.rejected.output_not_observed");
  assert.equal(failed.resultReason, "list_never_appeared");
  assert.equal(failed.effectApplied, false);
});

test("the same answer a second and third time says so, on the packet and on the trace row", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(cartGateway(alwaysEmpty()));
  const first = await runExtraction(runtime, "call.one");
  const firstBytes = JSON.stringify(first.evidence);

  const second = await runExtraction(runtime, "call.two");
  // The run this comes from proves the two are otherwise identical: the model
  // was handed 6,149 bytes twice and could not tell they were the same bytes.
  assert.equal(packet(second).detail?.repeatedAnswer, 2);
  assert.equal(second.resultReason, "answered_the_same_again");
  // The reason itself is still in the model's hand; only the trace row's single
  // slot changes, and the row before it carries the cause.
  assert.equal(packet(second).detail?.reason, "list_never_appeared");
  assert.notEqual(JSON.stringify(second.evidence), firstBytes);

  const third = await runExtraction(runtime, "call.three");
  assert.equal(packet(third).detail?.repeatedAnswer, 3);
  assert.equal(third.resultReason, "answered_the_same_again");
});

test("an answer that differs, and a call that worked, each start the count again", async () => {
  let reply: Read = { extraction: NEVER_APPEARED, status: "failed", code: "web.validation.output_not_observed" };
  const runtime = createWebAutomationLlmEvidenceRuntime(cartGateway({ next: () => reply }));

  await runExtraction(runtime, "call.one");
  assert.equal(packet(await runExtraction(runtime, "call.two")).detail?.repeatedAnswer, 2);

  // A different shortfall is a different answer: the model has been told
  // something new, so it is the first of its own run rather than the third of
  // the last one.
  reply = {
    extraction: { ...NEVER_APPEARED, recordCount: 2, emptyRecords: 2, itemsSeen: 2, listPresence: "appeared", listWait: { stoppedOn: "list_present", waitedMs: 310, waitedFor: 1 } },
    status: "failed",
    code: "web.validation.output_not_observed"
  };
  const changed = await runExtraction(runtime, "call.three");
  assert.equal(packet(changed).detail?.reason, "records_have_no_fields");
  assert.equal(packet(changed).detail?.repeatedAnswer, undefined);
  assert.equal(changed.resultReason, "records_have_no_fields");

  // And a read that worked clears the slot, so a later identical refusal is not
  // counted as a continuation of one from before the page moved on.
  reply = { extraction: { ...NEVER_APPEARED, recordCount: 2, itemsSeen: 2, listPresence: "appeared" }, status: "succeeded", code: "web.action.failed" };
  const worked = await runExtraction(runtime, "call.four");
  assert.equal(worked.resultCode, "web.inspect.succeeded");

  reply = { extraction: NEVER_APPEARED, status: "failed", code: "web.validation.output_not_observed" };
  const again = await runExtraction(runtime, "call.five");
  assert.equal(packet(again).detail?.repeatedAnswer, undefined);
});
