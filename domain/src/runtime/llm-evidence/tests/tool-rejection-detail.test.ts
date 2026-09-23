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
  // The resolver's own codes now say which way the handle stopped naming one
  // control, because the handle is made real by the same resolver the built
  // Flow's parameters go through. Each still implies a different next call,
  // and the shapes a handle is accepted in ride with them, because a code is
  // a name for a mistake and never a statement of what is accepted instead.
  assert.deepEqual(detailOf(invented), { reason: "parameters_not_resolved", target: "target.40", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // The control the handle named has left the page.
  pages.set({ url: QUEUE.url, elements: [QUEUE.elements[1]!] });
  const gone = await runtime.executeTool({ ...BASE, callId: "call.gone", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });
  assert.deepEqual(detailOf(gone), { reason: "parameters_not_resolved", target: "target.1", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // The page the packet described has been left.
  pages.set({ url: "https://scheduler.example.test/queue/page/2", elements: QUEUE.elements });
  const moved = await runtime.executeTool({ ...BASE, callId: "call.moved", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.1" } }, consequences: [] } });
  assert.deepEqual(detailOf(moved), { reason: "parameters_not_resolved", target: "target.1", instead: ["web.handle.unknown", "web.handle.unknown:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

  // Not a handle this domain issues at all.
  const malformed = await runtime.executeTool({ ...BASE, callId: "call.malformed", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "the schedule button" } }, consequences: [] } });
  // A token that is not a handle this domain mints is a locator the model
  // invented, and an acting node is refused for naming one.
  assert.equal(codeOf(malformed), "target_unobserved");
  assert.deepEqual(detailOf(malformed), { reason: "parameters_not_resolved", instead: ["web.handle.malformed", "web.handle.expected.selector.handle_location", "web.handle.malformed:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });

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
  assert.deepEqual(detailOf(several), { reason: "parameters_not_resolved", target: "target.1", instead: ["web.handle.not_unique", "web.handle.not_unique:target", 'target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'] });
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
