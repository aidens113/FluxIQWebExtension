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
import type { AutomationStudioActionPermissionVerdict } from "fluxiq/automation-studio";
import type { WebLlmEvidenceGateway } from "../capture";
import { pressControl, type WebControlPress } from "../press";
import { RecoverableToolRejection } from "../tool-rejection";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

const BASE = { projectId: "project.one", flowId: "flow.one" } as const;
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
  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
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

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.open", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("New post")! } }, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(lab.clicked, [`${ROWS} #new-post`]);
  // The point of the press: the model can now see the field it has to fill.
  assert.equal(namesIn(pressed.evidence).includes("Post text"), true);
});

// The tick is no longer put back. While a press was an *exploratory* verb,
// leaving a row ticked would have turned the Flow's own tick into an untick; now
// the press is the Flow's step, run once, and putting it back would undo the
// step the build had just made.
test("ticks a row so the actions for chosen rows appear, and leaves the tick as the step it is", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.tick", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("Select order ORD-40100")! } }, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  // What the tick was for: the Retry button exists only while a row is chosen,
  // so the model cannot author a retry Flow without seeing it once.
  assert.equal(namesIn(pressed.evidence).includes("Retry failed orders"), true);
  // Pressed once, and left ticked: this press is the Flow's own tick.
  assert.deepEqual(lab.clicked, [`${ROWS} #row-1-select`]);
  assert.equal(lab.state.rowTicked, true);
});

test("presses a row's menu and a row's link, under a test id full of the word order", async () => {
  for (const [label, selector] of [["Order actions", `${ROWS} #row-1-menu`], ["ORD-40100", `${ROWS} #row-1-link`]] as const) {
    const lab = queueLab();
    const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
    const handles = await handlesByName(runtime);

    const pressed = await runtime.executeTool({ ...BASE, callId: "call.row", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get(label)! } }, consequences: [] } });

    assert.equal(pressed.resultCode, "web.action.succeeded", label);
    // Pressed once, and never pressed back.
    assert.deepEqual(lab.clicked, [selector], label);
  }
});

// The controls the old rule refused on its own judgement of how they look. None
// is refused on that now. What the model declares its own press does is asked
// of Core, which answers from the person's instruction and permission: without that
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

      const result = await runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get(label)! } }, consequences: [...consequences] }, permission });

      // Core is asked with the words the model was shown and the model's own classes.
      assert.deepEqual(asked, [{ consequences: [...consequences], control: { name: label, kind: "button" }, verb: "click", effect: "mutate" }], label);
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

test("a press that declares nothing lasting is still put to Core, and an unreadable declaration presses nothing", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);
  const asked: unknown[] = [];
  const permission = async (declaration: unknown) => { asked.push(declaration); return { permitted: true as const }; };

  const opened = await runtime.executeTool({ ...BASE, callId: "call.open", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("New post")! } }, consequences: [] }, permission });
  assert.equal(opened.resultCode, "web.action.succeeded");
  // Nothing is asked *for*, and Core is still told. Saying `[]` is the answer
  // every press in four measured live builds gave, and it used to stop here:
  // the check was never called, so what a permitted press had declared could
  // only be deduced from the absence of a refusal.
  assert.deepEqual(asked, [{ consequences: [], control: { name: "New post", kind: "button" }, verb: "click", effect: "mutate" }]);

  const unreadable = await runtime.executeTool({ ...BASE, callId: "call.bad", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("Send reply")! } }, consequences: ["spend_a_little"] }, permission });
  assert.equal(unreadable.resultCode, "web.action.rejected.invalid_input");
  assert.deepEqual(lab.clicked, [`${ROWS} #new-post`]);
});

test("with no permission check to ask, every high-risk declaration is refused", async () => {
  const lab = queueLab();
  const runtime = createWebAutomationLlmEvidenceRuntime(lab.gateway);
  const handles = await handlesByName(runtime);

  // With nobody to ask, what nobody could have allowed is still refused: a
  // high-risk class has no instruction that could have authorised it and no
  // request to raise.
  const refused = await runtime.executeTool({ ...BASE, callId: "call.delete", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("Send reply")! } }, consequences: ["delete"] } });
  assert.equal(refused.resultCode, "web.action.rejected.permission_required");
  assert.deepEqual(lab.clicked, []);

  // Sending is one of them again, as of 2026-09-30 (the user's rule: moving
  // money, deleting, and sending or publishing need a person every time).
  const sent = await runtime.executeTool({ ...BASE, callId: "call.send", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("Send reply")! } }, consequences: ["send_or_publish"] } });
  assert.equal(sent.resultCode, "web.action.rejected.permission_required");
  assert.deepEqual(lab.clicked, []);

  // Ordinary creation remains free.
  const created = await runtime.executeTool({ ...BASE, callId: "call.create", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("New post")! } }, consequences: ["create_new"] } });
  assert.equal(created.resultCode, "web.action.succeeded");
  assert.equal(lab.clicked.length, 1);
});

// A press that leaves the page looking the same is no longer refused. It was,
// while a press existed only to reveal something; a node that ran and succeeded
// is a step of the Flow whatever the sanitized packet then looks like -- a press
// that applies a filter can leave it identical -- so what changed is reported
// as a fact (`pageChanged`) and the step stands.
test("reports a press that changed nothing as a page that did not change, and keeps the step", async () => {
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

  const pressed = await runtime.executeTool({ ...BASE, callId: "call.inert", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handles.get("Nothing happens")! } }, consequences: [] } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, false);
  // Lane t195, run-munuxns5-833f4313: bigbox's first press after a load only wakes the page.
  assert.match(String((pressed.evidence as { unchangedPress?: string }).unchangedPress), /press the same control once more/u);
  assert.deepEqual(clicked, ["#inert"]);
});

// The repair path presses through `pressControl` directly. A press the person
// already declined is told as that, `consequences_declined`, and not as a
// request still in front of them; one Core is still asking about keeps
// `consequences_not_granted` (t195-w18).
test("a press refused by the person's own no says it was declined, and one still being asked says so", async () => {
  for (const declined of [true, false]) {
    const lab = queueLab();
    const verdict: AutomationStudioActionPermissionVerdict = { permitted: false, missing: ["move_money"], requestId: "permission-request:checkout" };
    if (declined) verdict.declined = true;
    const permission = async () => verdict;
    const press = {
      gateway: lab.gateway,
      sessionId: "session.one",
      request: { ...BASE, callId: "call.press", toolId: "web.recovery.press", value: {}, permission },
      current: undefined,
      element: { tag: "button", name: "Continue to checkout", selector: "#checkout" },
      restamp: (binding: unknown) => binding,
      consequences: ["move_money"],
    } as unknown as WebControlPress;

    await assert.rejects(pressControl(press), (error: unknown) => {
      assert.ok(error instanceof RecoverableToolRejection);
      assert.equal(error.code, "permission_required");
      assert.deepEqual(error.detail, declined
        // Told what to declare instead, so a press wrongly declared as money is re-declared rather than the order abandoned (t195-w19b #6).
        ? { reason: "consequences_declined", instead: ["declare only what this press itself does", "[] for a press that only opens a page or a form"], missing: ["move_money"], requestId: "permission-request:checkout" }
        : { reason: "consequences_not_granted", missing: ["move_money"], requestId: "permission-request:checkout" });
      return true;
    });
    assert.deepEqual(lab.clicked, [], "a refused press did not happen");
  }
});
