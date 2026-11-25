import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFlowChartSvg } from "../build-flow-chart-svg.js";
import { readChartFlow } from "../read/index.js";
import { redactChartText } from "../redact-chart-text.js";
import { writeRunFixture } from "./chart-fixture.js";

const tempDirectory = (): Promise<string> => mkdtemp(path.join(os.tmpdir(), "t1039-"));

test("the newest draft is charted: Flow steps only, the typed value, the read's rows and first row, a loop, the instruction and the answer", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir);
  const flow = (await readChartFlow(dir))!;
  assert.deepEqual(flow.nodes.map((node) => [node.step, node.kind]), [[1, "navigate"], [2, "act: type"], [3, "read"], [4, "act: next page"]]);
  assert.equal(flow.otherSteps, 1);
  assert.equal(flow.source, "draft");
  assert.equal(flow.instruction, "Find the cheapest paper towels and list them.");
  assert.deepEqual(flow.parameters, [{ name: "Search (step 2)", value: "paper towels" }]);
  assert.deepEqual(flow.nodes[2]!.example, ["8 rows read", "first row: name: Soft Rolls 6pk | price: $10.47"]);
  assert.equal(flow.nodes[2]!.result, true);
  assert.deepEqual(flow.loops, [{ from: 3, to: 4, label: "repeats over name and price until nothing more" }]);
  assert.deepEqual(flow.output, { kind: "rows", source: "shown to the person", check: [], headline: "Found 8 rows", columns: ["name", "price"], rows: [["Soft Rolls 6pk", "$10.47"]], total: 8 });
});

test("a run with no answer says no result, and one with no draft charts nothing", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir, { answer: false });
  assert.equal((await readChartFlow(dir))!.output.kind, "none");
  assert.equal(await readChartFlow(await tempDirectory()), null);
});

test("secrets never reach the chart: a password field's value, bearer tokens, cookies and long keys are hidden", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir, { secret: true });
  const flow = (await readChartFlow(dir))!;
  assert.equal(flow.nodes[1]!.typed, "[hidden]");
  assert.ok(!JSON.stringify(flow).includes("hunter2"));
  for (const secret of ["Authorization: Bearer abcdef0123456789abcdef", "cookie=session-abc123def", "sk-abcdefghijklmnopqrstuvwxyz0123", "0123456789abcdef0123456789abcdef01234567"]) {
    const hidden = redactChartText(`x ${secret} y`);
    assert.ok(hidden.includes("[hidden]"), secret);
    assert.ok(!hidden.includes("abcdef0123"), secret);
  }
  assert.equal(redactChartText("/ip/loftwell-ultra-strong-paper-towels-6-double-rolls/402917554"), "/ip/loftwell-ultra-strong-paper-towels-6-double-rolls/402917554", "page addresses are evidence, not secrets");
  await writeFile(path.join(dir, "attempt.json"), JSON.stringify({ saved: { state: "ready", flowId: "flow.1" } }));
  assert.equal((await readChartFlow(dir))!.source, "saved Flow");
});

test("with no answer shown, the newest completion the model offered is the output, labelled offered, with the check's outcome in plain words", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir, { answer: false, offered: true });
  const { output } = (await readChartFlow(dir))!;
  assert.deepEqual(output, {
    kind: "rows", source: "offered, not accepted", headline: "", columns: ["name", "price"], total: 16,
    rows: [["Soft Rolls 6pk", "$10.47"], ["Big Rolls 12pk", "$17.48"]],
    check: ["check: held unconfirmed (answer_first.judged_unsure)", "could not read: read-first (web_judge.read_invalid); witnesses.before (judge_evidence.before_state_missing)"],
  });
});

test("an answer the chat showed wins over an offered completion", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir, { offered: true });
  const { output } = (await readChartFlow(dir))!;
  assert.equal(output.kind === "rows" && output.source, "shown to the person");
});

test("an attempt's own evidence folder supplies its answer and saved state, and the chart says which attempt it is", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir, { answer: false });
  const evidence = path.join(dir, "attempt-2");
  await mkdir(evidence);
  await writeFile(path.join(evidence, "answer-turn.json"), JSON.stringify({ visible: true, headline: "Here", columns: ["a"], rows: [["x"]], note: null, text: null }));
  const flow = (await readChartFlow({ runDirectory: dir, evidenceDirectory: evidence, attempt: 2, saved: true }))!;
  assert.equal(flow.attempt, 2);
  assert.equal(flow.source, "saved Flow");
  assert.equal(flow.output.kind === "rows" && flow.output.rows[0]![0], "x");
  assert.ok(buildFlowChartSvg(flow).includes("Flow chart, attempt 2 (saved Flow)"));
});
