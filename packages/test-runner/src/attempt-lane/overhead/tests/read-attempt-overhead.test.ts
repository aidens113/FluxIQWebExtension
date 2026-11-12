import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readAttemptOverhead } from "../read-attempt-overhead.js";

async function folder(root: string, name: string, files: Record<string, unknown>): Promise<void> {
  await mkdir(path.join(root, name), { recursive: true });
  for (const [file, value] of Object.entries(files)) await writeFile(path.join(root, name, file), JSON.stringify(value));
}

test("it reads the step folders alone: a run of the Flow from step 1 is read from its decision, and a folder with no meta is left out", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "overhead-steps-"));
  try {
    await folder(root, "0001-chat", { "meta.json": { step: 1, kind: "chat", summary: "ok" } });
    await folder(root, "0002-tool-core.run_node", { "meta.json": { step: 2, kind: "tool", toolId: "core.run_node", resultCode: "web.action.succeeded", summary: "web.action.succeeded" }, "call.json": { callId: "a", toolId: "core.run_node", input: { node: "web.output.dom-click", parameters: { target: { handle: "t1" } } } } });
    await folder(root, "0003-decide", { "meta.json": { step: 3, kind: "decide", summary: "tool_call core.run_flow" }, "decision.json": { response: { decision: { toolId: "core.run_flow", input: { from: 1 } } } } });
    await folder(root, "0004-tool-core.run_node", { "meta.json": { step: 4, kind: "tool", toolId: "core.run_node", resultCode: "core.replay.ended", summary: "core.replay.ended" }, "call.json": { callId: "run.flow.all.1.1", toolId: "core.run_node", input: { node: "web.output.dom-click", parameters: { target: { handle: "t1" } }, replay: "step", from: { location: "http://x/" } } } });
    await folder(root, "0005-tool-unfinished", { "call.json": { callId: "x" } });
    await folder(root, "0006-flow-web.output.dom-click", { "meta.json": { step: 6, kind: "flow", toolId: "web.output.dom-click", summary: "succeeded" } });
    const [only] = await readAttemptOverhead(root);
    assert.equal(only?.liveBrowserCalls, 2);
    assert.equal(only?.flowBrowserCalls, 1);
    assert.equal(only?.overhead, 2);
    assert.equal(only?.wholeFlowRuns, 1);
    // A by-hand click and a replayed click of the same target and parameters, with the replay's own words taken away, but no place for the first: not a repeat.
    assert.equal(only?.repeatedCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a run with no steps folder has no attempts, and a step file that is not JSON is raised, not read as nothing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "overhead-steps-"));
  try {
    assert.deepEqual(await readAttemptOverhead(path.join(root, "no-steps-here")), []);
    await mkdir(path.join(root, "0001-chat"));
    await writeFile(path.join(root, "0001-chat", "meta.json"), "{ not json");
    await assert.rejects(readAttemptOverhead(root), SyntaxError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
