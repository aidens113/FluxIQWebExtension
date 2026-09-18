// What exploring may press, proved through the tool the model actually calls.
//
// Anything it is asked to. FluxIQ does not refuse a control on its own
// judgement of what the control looks like: the user's instruction is the
// authority, and an act with a lasting consequence is a matter of permission
// that Core will carry and put to the person (the seam is in `../press.ts`).
// What the tool still does on its own is leave the page as it found it: a
// ticked checkbox is ticked back, because a tick left behind would turn the
// Flow's own tick of that row into an untick.
//
// Driven through `createWebAutomationLlmEvidenceRuntime` rather than against a
// helper, because the defect this replaces lived in the tool: on three fixtures
// across a live slice, not one state-changing job changed the page, and five of
// six refused presses were `target_unsafe` with the control sitting in the
// packet -- a plain "New post" button refused for not being a disclosure, and
// every row control of an order-management site refused because its selector
// carried the word "order".

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceGateway } from "../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_PRESS_TOOL_ID } from "../vocabulary";

const BASE = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 16_000 } as const;
const ROWS = `[data-testid="order-rows"]`;

type PacketElement = { target: string; name?: string };
type QueueLab = { gateway: WebLlmEvidenceGateway; clicked: string[]; state: { composerOpen: boolean; rowTicked: boolean; presses: number } };

/**
 * The queue page of an order-management site, which is the shape that broke.
 * Every row control is addressed through a test id carrying the word "order",
 * as a real one is. Every press changes the page's title, so a press is never
 * mistaken for no progress.
 */
function queueLab(): QueueLab {
  const clicked: string[] = [];
  const state = { composerOpen: false, rowTicked: false, presses: 0 };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        const selector = String((command.parameters as { selector: string }).selector);
        clicked.push(selector);
        state.presses += 1;
        if (selector === `${ROWS} #new-post`) state.composerOpen = true;
        if (selector === `${ROWS} #row-1-select`) state.rowTicked = !state.rowTicked;
        return { status: "succeeded" };
      }
      return {
        status: "succeeded",
        payload: {
          snapshot: {
            url: "https://orders.example.test/queue",
            title: `Queue (${state.presses})`,
            interactiveElements: [
              { tagName: "button", selector: `${ROWS} #new-post`, accessibleName: "New post", attributes: { type: "button" } },
              { tagName: "input", selector: `${ROWS} #row-1-select`, inputType: "checkbox", accessibleName: "Select order ORD-40100", attributes: { type: "checkbox" } },
              { tagName: "button", selector: `${ROWS} #row-1-menu`, accessibleName: "Order actions", attributes: { type: "button", "aria-expanded": "false", "aria-controls": "row-1-menu-panel" } },
              { tagName: "a", selector: `${ROWS} #row-1-link`, accessibleName: "ORD-40100", href: "https://orders.example.test/orders/ORD-40100" },
              ...(state.rowTicked ? [{ tagName: "button", selector: `${ROWS} #retry`, accessibleName: "Retry failed orders", attributes: { type: "button" } }] : []),
              ...(state.composerOpen ? [{ tagName: "textarea", selector: "#body", name: "Post text" }] : []),
              { tagName: "button", selector: "#send", accessibleName: "Send reply", attributes: { type: "button" } },
              { tagName: "button", selector: "#delete", accessibleName: "Delete order", attributes: { type: "button" } },
              { tagName: "button", selector: "#confirm", accessibleName: "Confirm", attributes: { type: "button" } },
              { tagName: "button", selector: "#refund", accessibleName: "Refund this order", attributes: { type: "submit" } },
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

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.open", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("New post")!, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(lab.clicked, [`${ROWS} #new-post`]);
  // The point of the press: the model can now see the field it has to fill.
  assert.equal(namesIn(pressed.evidence).includes("Post text"), true);
});

test("ticks a row so the actions for chosen rows appear, then ticks it back", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.tick", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("Select order ORD-40100")!, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  // What the tick was for: the Retry button exists only while a row is chosen,
  // so the model cannot author a retry Flow without seeing it once.
  assert.equal(namesIn(pressed.evidence).includes("Retry failed orders"), true);
  // And the page is left as it was found, so the Flow's own tick is a tick.
  assert.deepEqual(lab.clicked, [`${ROWS} #row-1-select`, `${ROWS} #row-1-select`]);
  assert.equal(lab.state.rowTicked, false);
});

test("presses a row's menu and a row's link, under a test id full of the word order", async () => {
  for (const [label, selector] of [["Order actions", `${ROWS} #row-1-menu`], ["ORD-40100", `${ROWS} #row-1-link`]] as const) {
    const lab = queueLab();
    const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
    const handles = await handlesByName(runtime);

    const pressed = await runtime.executeTool({ ...BASE, callId: "call.row", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get(label)!, consequences: [] } });

    assert.equal(pressed.resultCode, "web.action.succeeded", label);
    // Pressed once, and only a checkbox is pressed back.
    assert.deepEqual(lab.clicked, [selector], label);
  }
});

// The controls the old rule refused on its own judgement of how they look. None
// is refused on that now. What the model declares its own press does is asked
// of Core, which answers from the person's instruction and grant: without that
// authority the press is not made and Core's request goes to the person; with
// it, the press is made. A press that declares nothing lasting asks nothing.
const PERMISSION_CASES = [
  ["Send reply", ["send_or_publish"]],
  ["Delete order", ["delete"]],
  ["Confirm", ["modify_existing"]],
  ["Refund this order", ["move_money", "modify_existing"]],
  ["Retry failed orders", ["send_or_publish"]],
] as const;

for (const [label, consequences] of PERMISSION_CASES) {
  test(`asks Core before pressing ${label}: refused without authority, pressed with it`, async () => {
    for (const permitted of [false, true]) {
      const lab = queueLab();
      lab.state.rowTicked = true;
      const asked: unknown[] = [];
      const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
      const handles = await handlesByName(runtime);
      const permission = async (declaration: unknown) => {
        asked.push(declaration);
        return permitted ? { permitted: true as const } : { permitted: false as const, missing: [...consequences], requestId: "permission-request:test" };
      };

      const result = await runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get(label)!, consequences: [...consequences] }, permission });

      // Core is asked with the words the model was shown and the model's own classes.
      assert.deepEqual(asked, [{ consequences: [...consequences], control: { name: label, kind: "button" }, verb: "press" }], label);
      if (permitted) {
        assert.equal(result.resultCode, "web.action.succeeded", label);
        assert.equal(lab.clicked.length, 1, label);
      } else {
        assert.equal(result.resultCode, "web.action.rejected.permission_required", label);
        assert.deepEqual(lab.clicked, [], label);
      }
    }
  });
}

test("a press that declares nothing lasting asks nothing, and an unreadable declaration presses nothing", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);
  const asked: unknown[] = [];
  const permission = async (declaration: unknown) => { asked.push(declaration); return { permitted: true as const }; };

  const opened = await runtime.executeTool({ ...BASE, callId: "call.open", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("New post")!, consequences: [] }, permission });
  assert.equal(opened.resultCode, "web.action.succeeded");
  assert.deepEqual(asked, []);

  const unreadable = await runtime.executeTool({ ...BASE, callId: "call.bad", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("Send reply")!, consequences: ["spend_a_little"] }, permission });
  assert.equal(unreadable.resultCode, "web.action.rejected.invalid_input");
  assert.deepEqual(lab.clicked, [`${ROWS} #new-post`]);
});

test("with no permission check to ask, a declared consequence is refused rather than taken", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  const refused = await runtime.executeTool({ ...BASE, callId: "call.send", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("Send reply")!, consequences: ["send_or_publish"] } });

  assert.equal(refused.resultCode, "web.action.rejected.permission_required");
  assert.deepEqual(lab.clicked, []);
});

test("reports a press that changed nothing as no progress, and still presses", async () => {
  const clicked: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicked.push(String((command.parameters as { selector: string }).selector));
        return { status: "succeeded" };
      }
      return { status: "succeeded", payload: { snapshot: { url: "https://orders.example.test/queue", title: "Queue", interactiveElements: [
        { tagName: "button", selector: "#inert", accessibleName: "Nothing happens", attributes: { type: "button" } },
      ] } } };
    },
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const handles = await handlesByName(runtime);

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.inert", toolId: WEB_LLM_PRESS_TOOL_ID, value: { target: handles.get("Nothing happens")!, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.rejected.no_progress");
  assert.deepEqual(clicked, ["#inert"]);
});
