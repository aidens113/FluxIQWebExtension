import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loopsCaughtInSteps, readLoopReplayLoops, renderLoopReplayTable, replayLoopCorpus, replayLoopRun } from "../index.js";

/** Writes step folders as Core's step log writes them; the sites and values are made up. */
async function stepLog(root: string, runId: string, verdict: string, steps: ReadonlyArray<{ name: string; meta?: object; call?: object; result?: object; decision?: object }>): Promise<string> {
  const stepsDirectory = path.join(root, "2026-01-01", runId, "steps");
  await mkdir(stepsDirectory, { recursive: true });
  await writeFile(path.join(root, "2026-01-01", runId, "summary.json"), JSON.stringify({ verdict, scenarioId: "made-up-site" }));
  for (const step of steps) {
    const folder = path.join(stepsDirectory, step.name);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "meta.json"), JSON.stringify({ role: null, briefId: null, part: null, round: null, ...step.meta }));
    if (step.call) await writeFile(path.join(folder, "call.json"), JSON.stringify(step.call));
    if (step.result) await writeFile(path.join(folder, "result.json"), JSON.stringify(step.result));
    if (step.decision) await writeFile(path.join(folder, "decision.json"), JSON.stringify({ response: { decision: step.decision } }));
  }
  return stepsDirectory;
}

const number = (index: number): string => String(index).padStart(4, "0");

/** One press of one covered control, its reason reworded, on a page that never moves: the shape of a button pressed again and again. */
const pressedAgain = (times: number) => Array.from({ length: times }, (_, index) => {
  const input = { node: "web.output.dom-click", parameters: { target: { handle: "t9" } }, reason: `attempt ${index}` };
  return [
    { name: `${number(index * 2 + 1)}-decide`, meta: { iteration: index + 1 }, decision: { kind: "tool_call", callId: `c${index}`, toolId: "core.run_node", input } },
    { name: `${number(index * 2 + 2)}-tool-core.run_node`, meta: { effectApplied: false, resultCode: "web.action.rejected.target_covered" }, call: { callId: `c${index}`, toolId: "core.run_node", input }, result: { ok: false, location: "https://shop.invalid/a", page: `[frame ${index}]\nt${index} button "Close"` } }
  ];
}).flat();

/** Next and read, each on a new page with new rows. */
const workingThroughPages = (pages: number) => Array.from({ length: pages }, (_, index) => {
  const input = { node: "web.output.dom-extract_list", parameters: { extractList: { item: "article" } } };
  const next = { node: "web.output.dom-click", parameters: { target: { handle: "t3" } } };
  return [
    { name: `${number(index * 4 + 1)}-decide`, meta: { iteration: index * 2 + 1 }, decision: { kind: "tool_call", callId: `r${index}`, toolId: "core.run_node", input } },
    { name: `${number(index * 4 + 2)}-tool-core.run_node`, meta: { effectApplied: true, resultCode: "web.inspect.succeeded" }, call: { callId: `r${index}`, toolId: "core.run_node", input }, result: { location: `https://shop.invalid/page/${index}`, page: `listing ${index}`, read: { extracted: [{ name: `row ${index} one` }, { name: `row ${index} two` }] } } },
    { name: `${number(index * 4 + 3)}-decide`, meta: { iteration: index * 2 + 2 }, decision: { kind: "tool_call", callId: `n${index}`, toolId: "core.run_node", input: next } },
    { name: `${number(index * 4 + 4)}-tool-core.run_node`, meta: { effectApplied: true, resultCode: "web.action.succeeded" }, call: { callId: `n${index}`, toolId: "core.run_node", input: next }, result: { location: `https://shop.invalid/page/${index + 1}`, page: `listing ${index + 1}` } }
  ];
}).flat();

test("a button pressed again and again with its words changed is caught from the log", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const steps = await stepLog(root, "run-pressed", "failed", pressedAgain(20));

  const replayed = await replayLoopRun(steps);

  assert.equal(replayed.calls, 20);
  assert.equal(replayed.caught.near_repeat, 1);
  assert.equal(replayed.firings[0]?.rung, "steer");
  assert.equal(replayed.firings[0]?.pattern, "near_repeat");
  assert.ok(replayed.firings.some((firing) => firing.rung === "refuse"));
  assert.ok(replayed.firings.some((firing) => firing.rung === "change_approach"));
});

test("working through pages fires nothing, however many pages", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const steps = await stepLog(root, "run-pages", "passed", workingThroughPages(40));

  const replayed = await replayLoopRun(steps);

  assert.equal(replayed.calls, 80);
  assert.deepEqual(replayed.firings, []);
});

test("what leaves the log is digests and codes: no row, page text, handle or word the model wrote", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await stepLog(root, "run-pressed", "passed", pressedAgain(6));
  await stepLog(root, "run-pages", "passed", workingThroughPages(3));

  const corpus = await replayLoopCorpus(root);
  const table = renderLoopReplayTable(corpus);

  assert.match(table, /runs scanned: 2/u);
  assert.match(table, /\| passed \| 2 \| 1 \|/u);
  assert.match(table, /\| run-pressed \| - \| - \| 6 \| steer \| near_repeat \| 2 \| core\.run_node \|/u);
  for (const secret of ["Close", "attempt", "row 1", "listing", "shop.invalid", "article"]) assert.ok(!table.includes(secret), secret);
  const events = JSON.stringify((await readLoopReplayLoops(path.join(root, "2026-01-01", "run-pages", "steps"))).map((loop) => loop.events.map((event) => event.kind === "call" ? { ...event, answerText: undefined, call: { ...event.call, input: {} } } : event)));
  for (const secret of ["row 1", "listing", "shop.invalid"]) assert.ok(!events.includes(secret), secret);
});

/** One press, by node and handle, that landed and left the page view and location given; the view prints its controls as Core's page view does. */
const pressed = (step: number, handle: string, consequences: string[], location: string, view: string) => {
  const input = { node: "web.output.dom-click", parameters: { target: { handle } }, consequences };
  return [
    { name: `${number(step * 2 + 1)}-decide`, meta: { iteration: step + 1 }, decision: { kind: "tool_call", callId: `c${step}`, toolId: "core.run_node", input } },
    { name: `${number(step * 2 + 2)}-tool-core.run_node`, meta: { effectApplied: true, resultCode: "web.action.succeeded" }, call: { callId: `c${step}`, toolId: "core.run_node", input }, result: { location, page: view } }
  ];
};
const productPage = (handle: string, count: number) => `${handle} button "Add to cart"\ncart holds ${count}`;

test("one more added on one page is caught though the page changes every time; another product's page is another target", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const open = (location: string) => [{ name: "0000-tool-core.run_node", meta: { effectApplied: true, resultCode: "web.action.succeeded" }, call: { callId: "open", toolId: "core.run_node", input: { node: "web.output.browser-navigate", parameters: { url: location }, consequences: [] } }, result: { location, page: productPage("t9", 0) } }];
  const onePage = await stepLog(root, "run-one-page", "failed", [...open("https://shop.invalid/a"), ...Array.from({ length: 5 }, (_, index) => pressed(index, "t9", ["modify_existing"], "https://shop.invalid/a", productPage("t9", index + 1))).flat()]);
  const manyPages = await stepLog(root, "run-many-pages", "passed", [...open("https://shop.invalid/p0"), ...Array.from({ length: 5 }, (_, index) => pressed(index, `t${9 + index}`, ["create_new"], `https://shop.invalid/p${index + 1}`, productPage(`t${10 + index}`, 0))).flat()]);

  const replayed = await replayLoopRun(onePage);
  assert.equal(replayed.caught.same_act, 1);
  assert.equal(replayed.firings.find((firing) => firing.pattern === "same_act")?.rung, "steer");
  assert.ok(replayed.firings.some((firing) => firing.pattern === "same_act" && firing.rung === "refuse"));
  assert.deepEqual((await replayLoopRun(manyPages)).firings, []);
});

test("the fingerprint knows a renumbered handle; keyed by handle, the same button is a new call each time", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const view = (handle: string) => `${handle} button "Close"`;
  const open = { name: "0000-tool-core.run_node", meta: { effectApplied: true, resultCode: "web.action.succeeded" }, call: { callId: "open", toolId: "core.run_node", input: { node: "web.output.browser-navigate", parameters: { url: "https://shop.invalid/a" }, consequences: [] } }, result: { location: "https://shop.invalid/a", page: view("t1") } };
  const presses = Array.from({ length: 4 }, (_, index) => {
    const input = { node: "web.output.dom-click", parameters: { target: { handle: `t${index + 1}` } }, consequences: [] };
    return [
      { name: `${number(index * 2 + 1)}-decide`, meta: { iteration: index + 1 }, decision: { kind: "tool_call", callId: `c${index}`, toolId: "core.run_node", input } },
      { name: `${number(index * 2 + 2)}-tool-core.run_node`, meta: { effectApplied: false, resultCode: "web.action.rejected.target_covered" }, call: { callId: `c${index}`, toolId: "core.run_node", input }, result: { ok: false, location: "https://shop.invalid/a", page: view(`t${index + 2}`) } }
    ];
  }).flat();
  const steps = await stepLog(root, "run-renumbered", "failed", [open, ...presses]);

  assert.equal((await replayLoopRun(steps)).caught.near_repeat, 1);
  assert.equal((await replayLoopRun(steps, { byHandle: true })).caught.near_repeat, 0);
});

test("a live run's loops are counted from its log, for the Lab's report", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loop-replay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const steps = await stepLog(root, "run-live", "failed", [
    { name: "0001-loop", meta: { kind: "loop", rung: "steer", pattern: "near_repeat" } },
    { name: "0002-answer-core.run_node", meta: { kind: "answer", resultCode: "llm_evidence_loop.repeat_refused", resultReason: "near_repeat" } },
    { name: "0003-answer-core.run_node", meta: { kind: "answer", resultCode: "llm_evidence_loop.repeat_refused", resultReason: "failed" } },
    { name: "0004-loop", meta: { kind: "loop", rung: "change_approach", pattern: "cycle" } },
    { name: "0005-tool-core.run_node", meta: { kind: "tool", resultCode: "web.action.succeeded" } }
  ]);

  const caught = await loopsCaughtInSteps(steps);

  assert.deepEqual(caught.near_repeat, { steered: 1, refused: 1, changeApproach: 0, askPerson: 0 });
  assert.equal(caught.exact_repeat.refused, 1);
  assert.equal(caught.cycle.changeApproach, 1);
  assert.deepEqual(await loopsCaughtInSteps(path.join(root, "no-such-run")), await loopsCaughtInSteps(path.join(root, "nor-this-one")));
});
