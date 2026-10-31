import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptAutomationStudioFlowBootstrapResult, automationStudioEvidenceFlowBootstrapCompletionSchema } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";
const { registry, resolution: EXAMPLE_RESOLUTION, blocks: exampleBlocks } = exampleSupport;
const AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT = exampleSupport.sections.format;
const AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT = exampleSupport.sections.state;
const AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA = automationStudioEvidenceFlowBootstrapCompletionSchema(undefined, WEB_FLOW_SCRIPT_EXAMPLES);

describe("the format's guidance on saving values read one by one as one row", () => {

  const script = new Map(exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)).get("Example, values read one by one, saved as one row:")!;

  it("names the node, the records line and a bound value, and stays out of the legacy format", () => {
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("are saved as one row by a last step `node: builtin.data.write-records` whose `records:` is a list holding one object"));
    assert.ok((AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)?.includes("`records: [{\"plan\": \"$step.plan.value\"}]`"));
    assert.ok(!(AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT)?.includes("write-records"));
    assert.ok(!(JSON.stringify(AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA))?.includes("write-records"));
  });

  it("builds as written: three reads, then one row of their values, its columns the row's keys", () => {
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    const nodes = accepted.plan.subflows[0]!.nodes;
    assert.deepEqual(nodes.map((node) => node.definitionId), ["web.output.browser-navigate", "web.output.dom-extract", "web.output.dom-extract", "web.output.dom-extract", "builtin.data.write-records"]);
    const save = nodes.at(-1)!.parameters!;
    assert.deepEqual(save.records, [{ plan: { $state: { path: "$node.s2.value" } }, renews: { $state: { path: "$node.s3.value" } }, price: { $state: { path: "$node.s4.value" } } }]);
    const fields = ((save.recordOutput as { schema: { fields: Array<{ id: string }> } }).schema.fields).map((field) => field.id);
    assert.deepEqual(fields, ["plan", "renews", "price"]);
  });
});


describe("the web narrowing example", () => {
  it("shows its narrowing example on a site that is not a shop, a social feed or a job board", () => {
    const narrowing = exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT).find(([name]) => /narrowing/u.test(name));
    assert.notEqual(narrowing?.[1], undefined);
    assert.doesNotMatch(narrowing![1], /shop|store|order|cart|feed|social|post|job|career/iu);
  });
});