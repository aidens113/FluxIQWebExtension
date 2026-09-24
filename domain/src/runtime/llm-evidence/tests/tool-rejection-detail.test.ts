// What a refusal tells the model, proved through the tools the model calls.
//
// The defect this pins is round 1 of the live campaign, 2026-09-21: about
// seventy attempts to build a Flow produced one Flow, and
// `repeat_without_progress` was among the top endings. A refusal was a bare
// code, so `target_unobserved` read the same whether the handle had never been
// in a packet, its page had been left, or the control was gone -- and Core's
// loop answers a repeated call from what it already holds, so a model with
// nothing to route around spends the build making the same call.
//
// Two properties are held here. Every refusal says which of those happened, in
// this domain's own closed words; and no refusal says anything about the page
// beyond that, which is the guard the bare code was protecting
// (`../tool-rejection.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../capture";
import { WEB_PLAN_HANDLE_ISSUE_CODES } from "../plan-resolution";
import { rejectionDetail, webLlmHandleRejectionReason, WEB_LLM_TOOL_REJECTION_REASONS } from "../tool-rejection";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID } from "../vocabulary";

const BASE = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 16_000 } as const;

/** The page's own words, none of which may ever appear in a refusal. */
const PAGE_WORDS = ["Schedule post", "Draft to the Northwind account", "queue-rows", "#schedule"] as const;

type Page = { url: string; elements: Array<{ tagName: string; selector: string; accessibleName?: string; attributes?: Record<string, string> }> };

const QUEUE: Page = {
  url: "https://scheduler.example.test/queue",
  elements: [
    { tagName: "button", selector: "#schedule", accessibleName: "Schedule post", attributes: { type: "button" } },
    { tagName: "button", selector: `[data-testid="queue-rows"] #draft`, accessibleName: "Draft to the Northwind account", attributes: { type: "button" } }
  ]
};

/** A page whose two controls the capture addresses identically, as a re-render can. */
const TWINNED: Page = {
  url: QUEUE.url,
  elements: [
    { tagName: "button", selector: "#schedule", accessibleName: "Schedule post", attributes: { type: "button" } },
    { tagName: "button", selector: "#schedule", accessibleName: "Schedule post", attributes: { type: "button" } }
  ]
};

function labWith(pages: { next(): Page }): { gateway: WebLlmEvidenceGateway; clicks: string[] } {
  const clicks: string[] = [];
  return {
    clicks,
    gateway: {
      eligibleSessionIds: () => ["session.one"],
      executeAction: async (_sessionId, command) => {
        if (command.actionType !== "web.dom.capture_snapshot") {
          clicks.push(String((command.parameters as { selector?: string }).selector ?? ""));
          return { status: "succeeded" };
        }
        const page = pages.next();
        return { status: "succeeded", payload: { snapshot: { url: page.url, title: "Queue", interactiveElements: page.elements } } };
      }
    }
  };
}

/** One page throughout, unless something sets another. */
function standingPage(initial: Page): { next(): Page; set(page: Page): void } {
  let page = initial;
  return { next: () => page, set: (replacement) => { page = replacement; } };
}

function detailOf(execution: { evidence: unknown }): JsonObject | undefined {
  return (execution.evidence as { detail?: JsonObject }).detail;
}

function codeOf(execution: { evidence: unknown }): string {
  return String((execution.evidence as { code?: unknown }).code);
}

test("each way a handle stops naming one control is a different reason, and the handle comes back with it", async () => {
  const pages = standingPage(QUEUE);
  const { gateway, clicks } = labWith(pages);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  // A handle no packet ever carried.
  const invented = await runtime.executeTool({ ...BASE, callId: "call.invented", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.40" } }, consequences: [] } });
  assert.equal(codeOf(invented), "target_unobserved");
  // The resolver's own codes say which way the handle stopped naming one
  // control, because the handle is made real by the same resolver the built
  // Flow's parameters go through -- and the reason is now that answer instead
  // of `parameters_not_resolved`, which was one word for every one of them.
  // Each implies a different next call, and the shapes a handle is accepted in
  // ride with them, because a code is a name for a mistake and never a
  // statement of what is accepted instead.
  assert.deepEqual(detailOf(invented), { reason: "handle_not_in_packet", target: "target.40", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // The control the handle named has left the page.
  //
  // This reads `handle_not_in_packet` rather than `handle_no_longer_on_page`,
  // and that is the resolver being honest about what it knew. Running any node
  // recaptures the page first and remembers the new packet in that page's
  // place (`node-run/run.ts`, `run.shown`), so by the time the handle is
  // resolved it is simply not among this page's handles -- which is what
  // `web.handle.unknown` says. Telling "was issued, and the page dropped it"
  // apart from "was never issued" needs `plan-resolution/target-packets.ts` to
  // remember the handles a recapture replaced. Until it does, this reason is
  // not invented here.
  pages.set({ url: QUEUE.url, elements: [QUEUE.elements[1]!] });
  const gone = await runtime.executeTool({ ...BASE, callId: "call.gone", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });
  assert.deepEqual(detailOf(gone), { reason: "handle_not_in_packet", target: "target.1", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // The page the packet described has been left. The same answer, for the same
  // reason: the page remembered under that location no longer carries the
  // handle, so nothing is left for the resolver to call stale.
  pages.set({ url: "https://scheduler.example.test/queue/page/2", elements: QUEUE.elements });
  const moved = await runtime.executeTool({ ...BASE, callId: "call.moved", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });
  assert.deepEqual(detailOf(moved), { reason: "handle_not_in_packet", target: "target.1", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // Not a handle this domain issues at all.
  const malformed = await runtime.executeTool({ ...BASE, callId: "call.malformed", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "the schedule button" } }, consequences: [] } });
  // A token that is not a handle this domain mints is a locator the model
  // invented, and an acting node is refused for naming one. `malformed_handle`
  // and not `handle_not_in_packet`: looking again would not help, because what
  // was written is not the shape a handle is written in.
  assert.equal(codeOf(malformed), "target_unobserved");
  assert.deepEqual(detailOf(malformed), { reason: "malformed_handle", instead: ["web.handle.malformed", "web.handle.expected.selector.handle_location", "web.handle.malformed:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  assert.deepEqual(clicks, [], "nothing was pressed on a handle that named nothing");
});

test("a handle the page has turned into several elements says so, rather than being pressed at a guess", async () => {
  const pages = standingPage(QUEUE);
  const { gateway, clicks } = labWith(pages);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  pages.set(TWINNED);
  const several = await runtime.executeTool({ ...BASE, callId: "call.several", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });

  assert.equal(codeOf(several), "target_unobserved");
  assert.deepEqual(detailOf(several), { reason: "handle_names_several_now", target: "target.1", instead: ["web.handle.not_unique", "web.handle.not_unique:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });
  assert.deepEqual(clicks, []);
});

test("a call whose keys are not the tool's is told the keys the tool takes", async () => {
  const { gateway } = labWith(standingPage(QUEUE));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);

  const extra = await runtime.executeTool({ ...BASE, callId: "call.extra", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [], selector: "#schedule" } });
  assert.equal(codeOf(extra), "invalid_input");
  assert.deepEqual(detailOf(extra), { reason: "unexpected_input_keys", instead: ["node", "parameters", "consequences"] });

  const short = await runtime.executeTool({ ...BASE, callId: "call.short", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } } } });
  // A node that acts must say what acting would lastingly do. A call that says
  // nothing is refused rather than read as saying it causes nothing, and it is
  // told all three keys rather than only the one it left out.
  assert.deepEqual(detailOf(short), { reason: "missing_input_keys", instead: ["node", "parameters", "consequences"] });
});

/**
 * The standing product rule is that a blocked action is put to the person
 * rather than quietly refused. Core raises the request and answers with the
 * classes it is missing; what this holds is that the domain carries both out to
 * the model instead of flattening them into one bare code -- and that a refusal
 * nobody could be asked about is a different answer from one somebody now has.
 */
test("a press the run is not permitted names the classes it lacks and the request now in front of the person", async () => {
  const pages = standingPage(QUEUE);
  const { gateway, clicks } = labWith(pages);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const asked: Array<{ consequences: readonly string[]; verb: string }> = [];
  const permission: AutomationStudioActionPermissionCheck = async (declaration) => {
    asked.push({ consequences: declaration.consequences, verb: declaration.verb });
    return { permitted: false, missing: ["send_or_publish"], requestId: "permission-request:abc" };
  };

  await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const refused = await runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: ["send_or_publish"] } });

  assert.equal(codeOf(refused), "permission_required");
  assert.deepEqual(detailOf(refused), { reason: "consequences_not_granted", missing: ["send_or_publish"], requestId: "permission-request:abc" });
  assert.deepEqual(asked, [{ consequences: ["send_or_publish"], verb: "click" }]);
  assert.deepEqual(clicks, [], "a press that was not permitted did not happen");
});

test("a refusal with no run behind it to ask says nobody could be asked, and still names the classes", async () => {
  const { gateway, clicks } = labWith(standingPage(QUEUE));
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);

  await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const refused = await runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: ["send_or_publish", "create_new"] } });

  assert.equal(codeOf(refused), "permission_required");
  assert.deepEqual(detailOf(refused), { reason: "nobody_to_ask", missing: ["send_or_publish", "create_new"] });
  assert.deepEqual(clicks, []);

  // A declaration Core could not read is not a refusal to ask about: nothing was asked and nothing was pressed.
  const unreadable = await runtime.executeTool({ ...BASE, callId: "call.unreadable", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: ["sell_the_company"] } });
  assert.equal(codeOf(unreadable), "invalid_input");
  assert.deepEqual(detailOf(unreadable), { reason: "consequences_unreadable" });
});

test("no refusal carries a word of the page, whatever it refused", async () => {
  const pages = standingPage(QUEUE);
  const { gateway } = labWith(pages);
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  const refusals: unknown[] = [];
  refusals.push(await runtime.executeTool({ ...BASE, callId: "call.invented", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.40" } }, consequences: [] } }));
  refusals.push(await runtime.executeTool({ ...BASE, callId: "call.keys", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } } } }));
  refusals.push(await runtime.executeTool({ ...BASE, callId: "call.permission", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: ["delete"] } }));
  pages.set(TWINNED);
  refusals.push(await runtime.executeTool({ ...BASE, callId: "call.several", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } }));

  const serialized = JSON.stringify(refusals);
  for (const word of PAGE_WORDS) assert.equal(serialized.includes(word), false, word);
  // Every one of them refused, and every one of them said why.
  for (const refusal of refusals) assert.ok(detailOf(refusal as { evidence: unknown })?.reason, JSON.stringify(refusal));
});

/**
 * The table that turns the resolver's codes back into reasons has to cover the
 * resolver, or the flattening comes back quietly: a code it does not name falls
 * through to `parameters_not_resolved`, which is the one word this whole change
 * exists to remove. So the resolver's own published set is the test's input,
 * and a code added there fails here until a reason is chosen for it.
 *
 * The `web.handle.expected.*` codes are deliberately outside it. They are not
 * reasons at all -- a refusal carries them to say where a handle of that kind
 * is accepted and in which shape -- and reading one as the reason would answer
 * "what went wrong" with "here is the shape", which is what the model was
 * already told.
 */
test("every code the plan resolver can refuse with names a reason, and each reason is one of the closed set", () => {
  const reasons = new Set<string>(WEB_LLM_TOOL_REJECTION_REASONS);
  const unmapped: string[] = [];
  for (const code of WEB_PLAN_HANDLE_ISSUE_CODES) {
    const reason = webLlmHandleRejectionReason([code]);
    if (code.startsWith("web.handle.expected.")) {
      assert.equal(reason, "parameters_not_resolved", `${code} is a shape hint and must not be read as a reason`);
      continue;
    }
    if (reason === "parameters_not_resolved") unmapped.push(code);
    assert.equal(reasons.has(reason), true, `${code} named ${reason}, which is not one of this domain's reasons`);
  }
  assert.deepEqual(unmapped, [], "these resolver codes have no reason, so a refusal carrying one says nothing the model can act on");
});

test("the reason is the first the refusal names, and nothing but a code can become one", () => {
  // The resolver lists its reasons in its own published order before the
  // positions and the shapes, so reading in order is reading that order.
  assert.equal(webLlmHandleRejectionReason(["web.handle.malformed", "web.handle.unknown"]), "malformed_handle");
  assert.equal(webLlmHandleRejectionReason(["web.handle.unknown", "web.handle.malformed"]), "handle_not_in_packet");

  // A position is a code and a path, and a path is a parameter key the model
  // wrote. It is not a reason, and it is passed over rather than matched on.
  assert.equal(webLlmHandleRejectionReason(["web.handle.unknown:target", "web.handle.stale"]), "page_moved_since_packet");
  // As are the shapes a handle is accepted in.
  assert.equal(webLlmHandleRejectionReason(['target: {"handle": "target.N"}']), "parameters_not_resolved");
  // And nothing a page could have put there becomes a reason.
  assert.equal(webLlmHandleRejectionReason(["Schedule post", "#schedule", ""]), "parameters_not_resolved");
});

/**
 * The sharpening happens where the detail is built, so no caller can hold the
 * resolver's codes and forget to apply it -- and applying it twice changes
 * nothing, which is what lets a caller start passing the sharpened reason
 * itself without this becoming a second, disagreeing copy.
 */
test("a detail carrying the resolver's codes is sharpened once, and sharpening it again does not move it", () => {
  const first = rejectionDetail({ reason: "parameters_not_resolved", target: "target.3", instead: ["web.handle.stale", "web.handle.stale:target"], missing: undefined, requestId: undefined, startLocation: undefined });
  assert.deepEqual(first, { reason: "page_moved_since_packet", target: "target.3", instead: ["web.handle.stale", "web.handle.stale:target"] });
  assert.deepEqual(rejectionDetail({ ...first, instead: first.instead, missing: undefined, requestId: undefined, startLocation: undefined }), first);

  // A reason that was never the resolver's is left exactly as the caller said,
  // whatever else rides with it.
  assert.deepEqual(
    rejectionDetail({ reason: "node_not_runnable_here", target: "web.output.dom-teleport", instead: ["web.handle.unknown"], missing: undefined, requestId: undefined, startLocation: undefined }),
    { reason: "node_not_runnable_here", target: "web.output.dom-teleport", instead: ["web.handle.unknown"] }
  );
});
