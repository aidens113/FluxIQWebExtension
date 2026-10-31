import assert from "node:assert/strict";
import { it } from "node:test";
import { acceptAutomationStudioFlowBootstrapResult, automationStudioFlowBootstrapWrittenPlanBindingIssues } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
const { registry, resolution: EXAMPLE_RESOLUTION, blocks: exampleBlocks } = exampleSupport;
const AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT = exampleSupport.sections.loop;

const resolution = EXAMPLE_RESOLUTION;
function examples() { return new Map(exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT)); }
it("shows one example of each loop", () => {
  assert.deepEqual([...examples().keys()], ["Example, reading every page of a list:", "Example, acting on each row a listing kept:", "Example, a loop the site asked to slow down:"]);
});
it("builds the pages example as written: a Repeat around the read and the next page, left when the list ends", () => {
  const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples().get("Example, reading every page of a list:")! }, registry, resolution });
  assert.deepEqual(accepted.ok ? accepted.issues.filter((issue) => issue.severity === "error") : accepted.issues, []);
  if (!accepted.ok) return;
  const subflow = accepted.plan.subflows[0]!;
  assert.deepEqual(subflow.nodes.map((node) => node.definitionId), [
    "web.output.browser-navigate", "builtin.control.merge", "builtin.control.repeat", "web.output.dom-extract_list", "web.output.dom-next_page", "builtin.control.merge"
  ]);
  assert.equal(subflow.edges.some((edge) => edge.source.nodeKey === "s5" && edge.source.portId === "ended" && edge.target.nodeKey === "s6"), true);
  exampleSupport.subset(subflow.nodes[3]!.parameters?.recordOutput, { process: { where: [{ field: "year", atLeast: 2015 }] } });
  assert.deepEqual(automationStudioFlowBootstrapWrittenPlanBindingIssues({ plan: accepted.plan, registry, resolution }), []);
});
it("builds the rows example as written: a For Each over the listing, the press taking each row, the row's field bound", () => {
  const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples().get("Example, acting on each row a listing kept:")! }, registry, resolution });
  assert.deepEqual(accepted.ok ? accepted.issues.filter((issue) => issue.severity === "error") : accepted.issues, []);
  if (!accepted.ok) return;
  const subflow = accepted.plan.subflows[0]!;
  assert.deepEqual(subflow.nodes.map((node) => node.definitionId), [
    "web.output.browser-navigate", "web.output.dom-extract_list", "builtin.control.merge", "builtin.control.for-each",
    "web.output.dom-click", "web.output.dom-wait_for_text", "builtin.control.merge"
  ]);
  assert.equal(subflow.edges.some((edge) => edge.source.nodeKey === "s4" && edge.source.portId === "item" && edge.target.nodeKey === "s5" && edge.target.portId === "item"), true);
  assert.deepEqual(subflow.nodes[4]!.consequences, ["modify_existing"]);
  exampleSupport.subset(subflow.nodes[1]!.parameters?.extractList, { where: [{ field: "status", contains: "overdue" }], minItems: 0 });
  assert.equal(subflow.edges.some((edge) => edge.source.nodeKey === "s2" && edge.source.portId === "records" && edge.target.nodeKey === "s4" && edge.target.portId === "items"), true);
  assert.deepEqual(subflow.nodes[5]!.parameters?.text, { $state: { path: "item.number" } });
  assert.deepEqual(automationStudioFlowBootstrapWrittenPlanBindingIssues({ plan: accepted.plan, registry, resolution }), []);
});
it("carries extractList.sort into the listing step's request, as it carries extractList.where", () => {
  const script = [
    "flow: Mark the two oldest unpaid invoices as reviewed",
    "step: open the invoices",
    "  node: web.browser.navigate",
    "  url: https://billing.test/invoices",
    "step invoices: list the unpaid invoices",
    "  node: web.dom.extract_list",
    "  extractList: extraction.2",
    "  extractList.where: [{\"field\": \"status\", \"contains\": \"unpaid\"}]",
    "  extractList.sort: [{\"field\": \"due\", \"order\": \"asc\", \"as\": \"date\"}]",
    "  extractList.minItems: 0",
    "step: mark the invoice as reviewed",
    "  node: web.dom.click",
    "  target: t21",
    "  consequences: modify_existing",
    "  repeat over: invoices",
    "  repeat most: 2"
  ].join("\n");
  const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution });
  assert.deepEqual(accepted.ok ? accepted.issues.filter((issue) => issue.severity === "error") : accepted.issues, []);
  if (!accepted.ok) return;
  const listing = accepted.plan.subflows[0]!.nodes.find((node) => node.definitionId === "web.output.dom-extract_list")!;
  assert.deepEqual(listing.parameters?.extractList, {
    handle: "extraction.2",
    where: [{ field: "status", contains: "unpaid" }],
    sort: [{ field: "due", order: "asc", as: "date" }],
    minItems: 0
  });
});
it("builds the slow-down example as written: the notice's way past and the wait meet at a join that closes the loop, and the press keeps its pace", () => {
  const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples().get("Example, a loop the site asked to slow down:")! }, registry, resolution });
  assert.deepEqual(accepted.ok ? accepted.issues.filter((issue) => issue.severity === "error") : accepted.issues, []);
  if (!accepted.ok) return;
  const subflow = accepted.plan.subflows[0]!;
  assert.deepEqual(subflow.nodes.map((node) => node.definitionId), [
    "web.output.browser-navigate", "web.output.dom-extract_list", "builtin.control.merge", "builtin.control.for-each",
    "web.output.dom-click", "web.output.dom-click", "builtin.timing.wait", "builtin.control.merge", "builtin.control.merge"
  ]);
  const edges = subflow.edges.map((edge) => `${edge.source.nodeKey}.${edge.source.portId} -> ${edge.target.nodeKey}.${edge.target.portId}`);
  for (const edge of ["s6.failed -> s8.in", "s6.success -> s7.in", "s7.success -> s8.branches", "s8.success -> s3.branches"]) assert.ok(edges.includes(edge));
  assert.equal(subflow.nodes[4]!.paceMs, 6_000);
  exampleSupport.subset(subflow.nodes[6]!.parameters, { duration: 6, unit: "seconds" });
  assert.deepEqual(automationStudioFlowBootstrapWrittenPlanBindingIssues({ plan: accepted.plan, registry, resolution }), []);
});
