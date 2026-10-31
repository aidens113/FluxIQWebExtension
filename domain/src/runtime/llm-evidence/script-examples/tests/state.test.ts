import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptAutomationStudioFlowBootstrapResult, automationStudioEvidenceFlowBootstrapCompletionSchema } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";
const { registry, resolution: EXAMPLE_RESOLUTION, blocks: exampleBlocks } = exampleSupport;
const AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT = exampleSupport.sections.format;
const AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT = exampleSupport.sections.loop;
const AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT = exampleSupport.sections.state;
const AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA = automationStudioEvidenceFlowBootstrapCompletionSchema(undefined, WEB_FLOW_SCRIPT_EXAMPLES);

describe("the state-aware Flow script format", () => {

  const examples = new Map(exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT));
  const planOf = (name: string) => {
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples.get(name)! }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    return accepted.plan;
  };

  it("stays out of the format and the legacy completion schema", () => {
    for (const words of ["start at:", "call:", "checkpoint: yes", "on retry for", "done when:", "then: carry on"]) {
      assert.ok(!(AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT)?.includes(words));
      assert.ok(!(JSON.stringify(AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA))?.includes(words));
    }
  });

  it("gives every new statement a one-line example", () => {
    for (const example of ["`call: payment`", "`card: $input.card = 4111`", "`start at: search` then `when: exists t4`", "`checkpoint: yes`", "`done when: text t11 contains \"Booked\"`", "`on retry for open: a notice covers the list`", "`then: carry on`", "`then: give up`", "`dialog <kind> \"<name>\"`"]) {
      assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes(example));
    }
  });

  it("keeps t378's rule for an interruption at one place, and sends one that can come anywhere to a handler", () => {
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("An interruption that can only come at one place is an `optional: yes` step there, with its `only after:` steps."));
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("One that can come at several places, or at any pass of a loop, is one handler instead"));
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("A loop the site asked to slow down still takes `repeat pace:` as well."));
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("never one you imagine"));
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT)?.includes("`repeat pace: <time>` goes beside `repeat over:` or `repeat while:`"));
  });

  it("starting where the page already is: the renewal step carries its entry and the Flow requires facts", () => {
    const plan = planOf("Example, starting where the page already is:");
    const main = plan.subflows[0]!;
    assert.deepEqual(main.nodes.map((node) => node.metadata ? `${node.key} ${Object.keys(node.metadata).join(",")}` : node.key), ["s1", "s2", "s3 fluxiq.entry", "s4", "s5"]);
    assert.deepEqual(main.nodes[2]!.metadata?.["fluxiq.entry"], { id: "renew", order: 1, when: [{ fact: "exists", op: "exists", target: { handle: "t6" } }], requires: [] });
    assert.deepEqual(plan.metadata, { requires: ["web.facts@1"] });
  });

  it("an interruption that can come at any pass: one automation-scope handler in the recovery Subflow, beside the loop", () => {
    const plan = planOf("Example, an interruption that can come at any pass:");
    assert.deepEqual(plan.subflows.map((subflow) => [subflow.key, subflow.role]), [["main", "primary"], ["recovery", "recovery"]]);
    const recovery = plan.subflows[1]!;
    assert.deepEqual(recovery.nodes.map((node) => node.definitionId), ["builtin.control.handler", "web.output.dom-click", "builtin.control.handler-end"]);
    exampleSupport.subset(recovery.nodes[0]!.parameters, {
      event: "before",
      scope: { kind: "automation" },
      when: [{ fact: "dialog", op: "visible", target: { kind: "dialog", role: "alertdialog", name: "Session expiring" } }],
      completionCheck: [{ fact: "dialog", op: "absent", target: { kind: "dialog", role: "alertdialog", name: "Session expiring" } }]
    });
    assert.deepEqual(recovery.nodes[2]!.parameters, { disposition: "resume", checkpointId: "", outputs: {} });
    assert.ok((plan.subflows[0]!.nodes.map((node) => node.definitionId))?.includes("builtin.control.for-each"));
    assert.deepEqual(plan.metadata, { requires: ["flow.handlers@1", "web.facts@1"] });
  });

  it("a second known way, checked the same: two parts with one success check, the call, and a fail handler that calls the other and resolves", () => {
    const plan = planOf("Example, a second known way, checked the same:");
    assert.deepEqual(plan.subflows.map((subflow) => [subflow.key, subflow.role]), [["main", "primary"], ["calendar", "utility"], ["floorplan", "utility"]]);
    const [main, calendar, floorplan] = plan.subflows;
    assert.deepEqual(main!.nodes.map((node) => `${node.key} ${node.definitionId}`), [
      "s1 web.output.browser-navigate", "s2 builtin.control.call-subflow",
      "h1-s1 builtin.control.handler", "h1-s2 builtin.control.call-subflow", "h1-s3 builtin.control.handler-end"
    ]);
    assert.deepEqual(main!.nodes[1]!.parameters, { subflowId: "calendar", inputs: {}, outputs: { reference: "reference" }, errors: {} });
    exampleSupport.subset(main!.nodes[2]!.parameters, { event: "fail", scope: { kind: "nodes", nodeIds: ["s2"] }, when: [], completionCheck: [] });
    exampleSupport.subset(main!.nodes[3]!.parameters, { subflowId: "floorplan" });
    assert.deepEqual(main!.nodes[4]!.parameters, { disposition: "resolve", checkpointId: "", outputs: { reference: { $state: { path: "$node.h1-s2.reference" } } } });
    const check = [{ fact: "text", op: "contains", value: "Booked", target: { handle: "t11" } }];
    assert.deepEqual(calendar!.metadata?.["fluxiq.successCheck"], check);
    assert.deepEqual(floorplan!.metadata?.["fluxiq.successCheck"], check);
    assert.deepEqual(calendar!.interface?.outputs.map((port) => port.metadata?.binding), [{ $state: { path: "$node.s2.value" } }]);
    assert.deepEqual(floorplan!.interface?.outputs.map((port) => port.metadata?.binding), [{ $state: { path: "$node.s3.value" } }]);
    for (const part of [calendar!, floorplan!]) {
      const read = part.nodes.at(-1)!;
      assert.equal(read.definitionId, "web.output.dom-extract");
      exampleSupport.subset(read.parameters, { target: { handle: "t12" }, extract: { mode: "text" } });
    }
    assert.ok(!(AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("$step.calendar-ref.records"));
    assert.deepEqual(plan.metadata, { requires: ["flow.handlers@1", "flow.subflow-calls@1", "web.facts@1"] });
  });
});

