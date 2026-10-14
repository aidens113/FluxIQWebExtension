// Coverage of rewrite-steps-index.ts: the Lab's `steps/index.md` is Core's
// table word for word (`!FluxIQ` `runtime/llm/step-log/listing.ts`): a run
// with one agent keeps five columns, and a run any project agent wrote a step
// to gains Role and Brief after Kind.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rewriteStepsIndex } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "steps-index-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function step(directory: string, folder: string, meta: Record<string, unknown> | string): Promise<void> {
  await mkdir(path.join(directory, folder), { recursive: true });
  await writeFile(path.join(directory, folder, "meta.json"), typeof meta === "string" ? meta : JSON.stringify(meta));
}

test("a run with one agent keeps Core's five columns", async (t) => {
  const directory = await scratch(t);
  await step(directory, "0002-tool-core.run_node", { step: 2, kind: "tool", toolId: "core.run_node", summary: "Clicked | Go", role: null, briefId: null });
  await step(directory, "0001-decide", { step: 1, kind: "decide", summary: "Open the page", costUsd: 0.0012 });
  await step(directory, "0003-judge", "{ cut short");
  assert.equal(await rewriteStepsIndex(directory), 2);
  assert.equal(await readFile(path.join(directory, "index.md"), "utf8"), [
    "# Run steps",
    "",
    "One row per completed step folder, in step order. A folder is complete once it holds `meta.json`.",
    "",
    "| Step | Kind | Tool | Summary | Cost |",
    "| --- | --- | --- | --- | --- |",
    "| 0001 | decide | - | Open the page | $0.001200 |",
    "| 0002 | tool | core.run_node | Clicked \\| Go | - |",
    ""
  ].join("\n"));
});

test("a run a project agent wrote a step to gains Role and Brief after Kind, a step outside every agent reading -", async (t) => {
  const directory = await scratch(t);
  await step(directory, "0001-decide", { step: 1, kind: "decide", summary: "Plan the work", role: "supervisor" });
  await step(directory, "0002-decide", { step: 2, kind: "decide", summary: "Type kettle", role: "builder", briefId: "brief-1" });
  await step(directory, "0003-answer", { step: 3, kind: "answer", toolId: "core.answer", summary: "Done" });
  assert.equal(await rewriteStepsIndex(directory), 3);
  const lines = (await readFile(path.join(directory, "index.md"), "utf8")).split("\n");
  assert.deepEqual(lines.slice(4), [
    "| Step | Kind | Role | Brief | Tool | Summary | Cost |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 0001 | decide | supervisor | - | - | Plan the work | - |",
    "| 0002 | decide | builder | brief-1 | - | Type kettle | - |",
    "| 0003 | answer | - | - | core.answer | Done | - |",
    ""
  ]);
});
