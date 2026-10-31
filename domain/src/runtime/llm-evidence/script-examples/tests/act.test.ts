import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptAutomationStudioFlowBootstrapResult, automationStudioEvidenceFlowBootstrapCompletionSchema } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";
import { WEB_FLOW_SCRIPT_GUIDANCE } from "../../script-guidance";
const { registry } = exampleSupport;
const AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT = exampleSupport.sections.format;
const AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE = exampleSupport.sections.act;
const AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA = automationStudioEvidenceFlowBootstrapCompletionSchema(undefined, WEB_FLOW_SCRIPT_EXAMPLES, WEB_FLOW_SCRIPT_GUIDANCE);

describe("the Flow script act-on-one-item example", () => {

  const resolution = { scope: { kind: "domain" as const, domainId: "web-automation" }, runtimeCapabilities: ["web.actions"], permissions: ["web-automation.action"] };
  const lines = AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE.split("\n");
  const heading = lines.indexOf("Example, acting on one item:");
  const example = lines.slice(heading + 1).join("\n");
  const guidance = lines.slice(0, heading).join("\n");

  it("stays out of the format, so the legacy completion schema does not change", () => {
    assert.ok((heading) > 0);
    for (const words of ["acting on one item", "optional: yes", "the state it leaves", "web.dom.check"]) {
      assert.ok(!(AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT)?.includes(words));
      assert.ok(!(JSON.stringify(AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA))?.includes(words));
    }
  });

  it("builds as written: a banner closed if it shows, a search sent, a result opened, a chip set, a status chosen, an estimate typed, and last a press that declares modify_existing", () => {
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: example }, registry, resolution });
    assert.deepEqual(accepted.ok ? accepted.issues.filter((issue) => issue.severity === "error") : accepted.issues, []);
    const nodes = accepted.ok ? accepted.plan.subflows[0]?.nodes ?? [] : [];
    assert.deepEqual(nodes.map((node) => node.definitionId), [
      "web.output.browser-navigate", "web.output.dom-click", "builtin.control.merge", "web.output.dom-type", "web.output.dom-click",
      "web.output.dom-check", "web.output.dom-select", "web.output.dom-type", "web.output.dom-click"
    ]);
    const presses = nodes.filter((node) => node.definitionId === "web.output.dom-click");
    assert.deepEqual(presses.map((node) => node.consequences), [[], [], ["modify_existing"]]);
    exampleSupport.subset(nodes[3]?.parameters, { submit: true });
    assert.deepEqual(nodes[3]?.consequences, []);
    assert.equal(nodes[7]?.consequences, undefined);
    exampleSupport.subset(nodes[5]?.parameters, { checked: true });
    const edges = accepted.ok ? accepted.plan.subflows[0]?.edges ?? [] : [];
    assert.deepEqual(edges.filter((edge) => edge.source.nodeKey === "s2").map((edge) => `${edge.source.portId}->${edge.target.nodeKey}`).sort(), ["failed->s3", "success->s3"]);
  });

  it("carries the consequence line on every press in the example, because a model copies the example", () => {
    const steps = example.split(/\n(?=step)/u);
    const presses = steps.filter((step) => step.includes("node: web.dom.click") || step.includes("submit: true"));
    assert.equal(presses.length, 4);
    for (const step of presses) assert.match(step, /consequences: /u);
  });

  it("teaches a choice as the state it leaves, with the nodes that set a state, and says when a press is right instead", () => {
    assert.ok((guidance)?.includes("A choice is written as the state it leaves, not as a press. A press toggles: pressing an option the page already shows chosen un-chooses it."));
    assert.ok((guidance)?.includes("An option in a dropdown is `node: web.dom.select`"));
    assert.ok((guidance)?.includes("is `node: web.dom.check` on that control itself, `checked: true` to choose it or `checked: false` to clear it; it presses only when the state differs"));
    assert.ok((guidance)?.includes("a colour swatch or size chip drawn apart from the others (`marked`)"));
    assert.ok((guidance)?.includes("Never look for a hidden box behind a swatch or chip: check the swatch or chip itself."));
    assert.ok(!(guidance)?.includes("on the box or radio itself"));
    assert.ok((guidance)?.includes("Every option the instruction asks for gets its own step, even one the page arrives with already chosen: write it with `web.dom.check` or `web.dom.select`, which change nothing when the state is already right"));
    assert.ok(!(guidance)?.includes("needs no step"));
    assert.ok((guidance)?.includes("Press an option with `node: web.dom.click` only when the page shows no chosen state for it at all; `web.dom.check` refuses such a control and says so."));
    assert.ok((guidance)?.includes("A press is right for a control that does something each time it is pressed"));
    const steps = example.split(/\n(?=step)/u);
    assert.equal(steps.filter((step) => /^step: choose/u.test(step)).every((step) => !step.includes("web.dom.click")), true);
  });

  it("says not to end with an invented confirmation check, because the judge reads the end page, and ends its own example on the act", () => {
    assert.ok((guidance)?.includes("Do not end the Flow with a check you invented to confirm it worked: whether the run did what was asked is judged from the page it ends on"));
    assert.ok((guidance)?.includes("It waits only for something the page visibly showed after that act while you gathered evidence, never for text inside a closed panel or menu, or a notice that has already gone."));
    const steps = example.split(/\n(?=step)/u);
    assert.ok((steps.at(-1))?.includes("node: web.dom.click"));
    assert.ok(!(example)?.includes("web.dom.wait_for_text"));
  });

  it("teaches the optional line for a step only sometimes needed, and where it cannot stand", () => {
    assert.ok((guidance)?.includes("`optional: yes` marks a step that is only sometimes needed"));
    assert.ok((guidance)?.includes("never on one the answer depends on, and never beside an `on <port>:` line"));
    assert.ok(!(guidance)?.includes("never inside a repeat"));
    assert.ok((example)?.includes("  optional: yes"));
  });
});

