// What the creation build read the person's instructions to ask for, from the run's step log.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLiveLlmStepLogInstructed } from "../step-log-instructed.js";

async function stepLog(t: test.TestContext, folders: Record<string, { meta?: unknown; decision?: unknown }>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-step-log-instructed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, files] of Object.entries(folders)) {
    await mkdir(path.join(root, name), { recursive: true });
    if (files.meta !== undefined) await writeFile(path.join(root, name, "meta.json"), JSON.stringify(files.meta));
    if (files.decision !== undefined) await writeFile(path.join(root, name, "decision.json"), JSON.stringify(files.decision));
  }
  return root;
}

const meta = (phase: string, part: string | null = "creation") => ({ kind: "decide", provider: "deepseek", part, phase });
const complete = (instructed: unknown) => ({ response: { kind: "evidence_tool_decision", summary: "...", decision: { kind: "complete", result: { instructed } } } });

/** `run-murzln6g-11debe1d`, `S/0015/decision.json`: the reading its build made before any page evidence. */
const MURZLN6G_READ = [
  { consequence: "modify_existing", quote: "Switch my pickup store to Millbrook Crossing Supercenter" },
  { consequence: "create_new", quote: "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup" },
];

test("the creation build's reading of its instructions is read from its read-phase step, in the person's words", async (t) => {
  const directory = await stepLog(t, {
    "0003-decide": { meta: meta("explore"), decision: { response: { decision: { kind: "tool_call" } } } },
    "0015-decide": { meta: meta("read"), decision: complete(MURZLN6G_READ) },
    "0069-judge": { meta: { ...meta("judge"), kind: "judge" }, decision: complete([{ consequence: "move_money", quote: "not a reading" }]) },
  });
  assert.deepEqual(await readLiveLlmStepLogInstructed(directory), MURZLN6G_READ);
});

test("no reading -- no log, none in it, one still being written, a re-author's, or an answer of another shape -- is null, and a reading of nothing is empty", async (t) => {
  assert.equal(await readLiveLlmStepLogInstructed(path.join(await stepLog(t, {}), "missing")), null);
  assert.equal(await readLiveLlmStepLogInstructed(await stepLog(t, { "0003-decide": { meta: meta("explore"), decision: complete(MURZLN6G_READ) } })), null);
  assert.equal(await readLiveLlmStepLogInstructed(await stepLog(t, { "0015-decide": { decision: complete(MURZLN6G_READ) } })), null);
  assert.equal(await readLiveLlmStepLogInstructed(await stepLog(t, { "0015-decide": { meta: meta("read", "reauthor"), decision: complete(MURZLN6G_READ) } })), null);
  assert.equal(await readLiveLlmStepLogInstructed(await stepLog(t, { "0015-decide": { meta: meta("read"), decision: complete([{ consequence: "Not A Class", quote: "x" }]) } })), null);
  assert.deepEqual(await readLiveLlmStepLogInstructed(await stepLog(t, { "0015-decide": { meta: meta("read"), decision: complete([]) } })), []);
});
