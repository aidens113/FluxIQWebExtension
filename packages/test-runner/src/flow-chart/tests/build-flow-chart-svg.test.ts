import assert from "node:assert/strict";
import test from "node:test";
import { buildFlowChartSvg } from "../build-flow-chart-svg.js";
import { SAMPLE_FLOW } from "./chart-fixture.js";

test("every node gets its own box with step number, kind, target and typed value, and the result is marked", () => {
  const svg = buildFlowChartSvg(SAMPLE_FLOW);
  for (const word of ["NAVIGATE", "ACT: TYPE", "READ", "ACT: NEXT PAGE", "target: Search", "typed / chosen: &quot;paper towels&quot;", "* RESULT", "START", "END"]) assert.ok(svg.includes(word), word);
  assert.equal(svg.match(/rx="8" fill="#(ffffff|eaf7ef)"/g)?.length, 4, "one box per node, none merged");
  assert.equal(svg.match(/\* RESULT/g)?.length, 1);
});

test("a loop is a bracket labelled with what it repeats and a branch is a side arrow labelled with its condition", () => {
  const svg = buildFlowChartSvg(SAMPLE_FLOW);
  assert.ok(svg.includes("repeats over"));
  assert.ok(svg.includes('stroke-dasharray="5 3"'));
  assert.ok(svg.includes("if a consent dialog"));
});

test("the input panel shows the instruction and each parameter's value, the nodes show what went through them, the output panel shows rows and the total", () => {
  const svg = buildFlowChartSvg(SAMPLE_FLOW);
  assert.ok(svg.includes("INPUT") && svg.includes("instruction: On the shop,"));
  assert.ok(svg.includes("parameter Search (step 2) = &quot;paper towels&quot;"));
  assert.ok(svg.includes("example: went to http://127.0.0.1:5000/shop/"));
  assert.ok(svg.includes("example: 8 rows read"));
  assert.ok(svg.includes("OUTPUT") && svg.includes("8 rows, first 2 shown") && svg.includes("name | price") && svg.includes("Big Rolls 12pk | $17.48"));
});

test("an attempt that returned nothing says no result, and a Flow with no node still draws", () => {
  const svg = buildFlowChartSvg({ ...SAMPLE_FLOW, nodes: [], loops: [], branches: [], output: { kind: "none", why: "no answer was recorded for this run" } });
  assert.ok(svg.includes("no result: no answer was recorded") && svg.includes("no step is in the Flow yet"));
});

test("long text wraps or ends in an ellipsis, markup is escaped, and a tall Flow grows the image", () => {
  const long = "word ".repeat(400);
  const many = Array.from({ length: 40 }, (_, index) => ({ step: index + 1, kind: "act: click", target: `<b>${long}</b>`, example: [long], result: false }));
  const svg = buildFlowChartSvg({ ...SAMPLE_FLOW, instruction: long, nodes: many, loops: [], branches: [] });
  assert.ok(svg.includes("…"));
  assert.ok(!svg.includes("<b>"));
  assert.ok(Number(/height="(\d+)"/.exec(svg)![1]) > 40 * 60);
  assert.ok(!/<text[^>]*>[^<]{200,}</.test(svg), "no single line runs on");
});

test("an offered completion is labelled and carries the check's outcome on the output panel", () => {
  const svg = buildFlowChartSvg({ ...SAMPLE_FLOW, output: { kind: "rows", source: "offered, not accepted", headline: "", columns: ["name"], rows: [["Soft Rolls"]], total: 16, check: ["check: held unconfirmed (answer_first.judged_unsure)"] } });
  assert.ok(svg.includes("(offered, not accepted)") && svg.includes("check: held unconfirmed (answer_first.judged_unsure)") && svg.includes("16 rows, first 1 shown"));
  assert.ok(buildFlowChartSvg(SAMPLE_FLOW).includes("(shown to the person)"));
});
