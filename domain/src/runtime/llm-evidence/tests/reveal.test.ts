// What exploring may press, proved through the tool the model actually calls.
//
// The line is between revealing and committing. Revealing changes only what is
// on screen: the composer behind "New post", the actions that appear once a row
// is ticked, a row's menu. Committing changes what is stored, on somebody's
// real account: Send, Save, Delete, Confirm, Refund. Exploration does the first
// and never the second -- and it puts a ticked row back, because a tick left
// behind would turn the Flow's own tick of that row into an untick.
//
// Driven through `createWebAutomationLlmEvidenceRuntime` rather than against the
// predicate, because the defect this covers was that the tool refused controls
// the predicate was never asked about: on three fixtures across a live slice,
// not one state-changing job changed the page, and five of six refused presses
// were `target_unsafe` with the control sitting in the packet.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceGateway } from "../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_REVEAL_TOOL_ID } from "../vocabulary";

const BASE = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 16_000 } as const;

type PacketElement = { target: string; name?: string };
type QueueLab = { gateway: WebLlmEvidenceGateway; clicked: string[]; state: { composerOpen: boolean; rowTicked: boolean } };

/**
 * The queue page of an order-management site, which is the shape that broke.
 * Every row control is addressed through a test id carrying the word "order",
 * as a real one is; none of that is anything the page says to a person, and
 * none of it may decide what a press would do.
 */
function queueLab(): QueueLab {
  const clicked: string[] = [];
  const state = { composerOpen: false, rowTicked: false };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        const selector = String((command.parameters as { selector: string }).selector);
        clicked.push(selector);
        if (selector === `[data-testid="order-rows"] #new-post`) state.composerOpen = true;
        if (selector === `[data-testid="order-rows"] #row-1-select`) state.rowTicked = !state.rowTicked;
        return { status: "succeeded" };
      }
      return {
        status: "succeeded",
        payload: {
          snapshot: {
            url: "https://orders.example.test/queue",
            title: "Queue",
            interactiveElements: [
              { tagName: "button", selector: `[data-testid="order-rows"] #new-post`, accessibleName: "New post", attributes: { type: "button" } },
              {
                tagName: "input",
                selector: `[data-testid="order-rows"] #row-1-select`,
                inputType: "checkbox",
                accessibleName: "Select order ORD-40100",
                attributes: { type: "checkbox" },
              },
              {
                tagName: "button",
                selector: `[data-testid="order-rows"] #row-1-menu`,
                accessibleName: "Order actions",
                attributes: { type: "button", "aria-expanded": "false", "aria-controls": "row-1-menu-panel" },
              },
              {
                tagName: "a",
                selector: `[data-testid="order-rows"] #row-1-link`,
                accessibleName: "ORD-40100",
                href: "https://orders.example.test/orders/ORD-40100",
              },
              ...(state.rowTicked
                ? [{ tagName: "button", selector: `[data-testid="order-rows"] #retry`, accessibleName: "Retry failed orders", attributes: { type: "button" } }]
                : []),
              ...(state.composerOpen ? [{ tagName: "textarea", selector: "#body", name: "Post text" }] : []),
              { tagName: "button", selector: "#send", accessibleName: "Send reply", attributes: { type: "button" } },
              { tagName: "button", selector: "#delete", accessibleName: "Delete order", attributes: { type: "button" } },
              { tagName: "button", selector: "#confirm", accessibleName: "Confirm", attributes: { type: "button" } },
              { tagName: "button", selector: "#refund", accessibleName: "Refund this order", attributes: { type: "button" } },
            ],
          },
        },
      };
    },
  };
  return { gateway, clicked, state };
}

type EvidenceRuntime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

/** The handles the model was given, read back by the name a person would see. */
async function handlesByName(runtime: EvidenceRuntime): Promise<Map<string, string>> {
  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const elements = (inspected.evidence as { elements: PacketElement[] }).elements;
  const named = elements.filter((element): element is PacketElement & { name: string } => typeof element.name === "string");
  return new Map(named.map((element) => [element.name, element.target]));
}

function namesIn(evidence: unknown): Array<string | undefined> {
  return (evidence as { elements: PacketElement[] }).elements.map((element) => element.name);
}

test("opens the composer behind a plain New post button, which is the press three fixtures could not make", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  const revealed = await runtime.executeTool({ ...BASE, callId: "call.open", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: handles.get("New post")! } });

  assert.equal(revealed.resultCode, "web.action.succeeded");
  assert.equal(revealed.effectApplied, true);
  assert.deepEqual(lab.clicked, [`[data-testid="order-rows"] #new-post`]);
  // The point of the press: the model can now see the field it has to fill.
  assert.equal(namesIn(revealed.evidence).includes("Post text"), true);
});

test("ticks a row so the actions for chosen rows appear, then unticks it again", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  const revealed = await runtime.executeTool({ ...BASE, callId: "call.tick", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: handles.get("Select order ORD-40100")! } });

  assert.equal(revealed.resultCode, "web.action.succeeded");
  // What the tick was for: the Retry button exists only while a row is chosen,
  // so the model cannot author a retry Flow without seeing it once.
  assert.equal(namesIn(revealed.evidence).includes("Retry failed orders"), true);
  // And the page is left as it was found, so the Flow's own tick is a tick.
  assert.deepEqual(lab.clicked, [`[data-testid="order-rows"] #row-1-select`, `[data-testid="order-rows"] #row-1-select`]);
  assert.equal(lab.state.rowTicked, false);
});

test("presses a row's menu and a row's link, under a test id full of the word order", async () => {
  for (const [label, selector] of [["Order actions", `[data-testid="order-rows"] #row-1-menu`], ["ORD-40100", `[data-testid="order-rows"] #row-1-link`]] as const) {
    const lab = queueLab();
    const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
    const handles = await handlesByName(runtime);

    const revealed = await runtime.executeTool({ ...BASE, callId: "call.row", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: handles.get(label)! } });

    // This fake page does not change under either press, so the tool reports no
    // progress -- but it pressed, where before it refused the target as unsafe.
    assert.equal(revealed.resultCode, "web.action.rejected.no_progress", label);
    assert.deepEqual(lab.clicked, [selector], label);
  }
});

// The danger the whole gate exists for. Each of these changes somebody's real
// account, and each stays refused while a Flow is only being authored.
for (const label of ["Send reply", "Delete order", "Confirm", "Refund this order", "Retry failed orders"]) {
  test(`refuses ${label} while exploring, and presses nothing`, async () => {
    const lab = queueLab();
    // Ticked first, so the bulk action is on the page to be refused.
    lab.state.rowTicked = true;
    const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
    const handles = await handlesByName(runtime);

    const refused = await runtime.executeTool({ ...BASE, callId: "call.commit", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: handles.get(label)! } });

    assert.deepEqual(refused, {
      kind: "llm_evidence_tool_execution",
      evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unsafe" },
      effectApplied: false,
      resultCode: "web.action.rejected.target_unsafe",
    });
    assert.deepEqual(lab.clicked, []);
    // A refusal is a bare code and never says what it was protecting.
    assert.doesNotMatch(JSON.stringify(refused), /order|reply|refund|ORD-/iu);
  });
}
