import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { attemptSpeed, attemptSpeedLines } from "../speed.js";

const at = (ms: number): string => new Date(Date.UTC(2026, 10, 10, 0, 0, 0) + ms).toISOString();

async function step(root: string, name: string, meta: Record<string, unknown>, files: Record<string, string> = {}): Promise<void> {
  await mkdir(path.join(root, name));
  for (const [file, content] of Object.entries(files)) await writeFile(path.join(root, name, file), content);
  await writeFile(path.join(root, name, "meta.json"), JSON.stringify(meta));
}

test("splits an attempt's wall time into decisions, browser action and overhead, judge, interpretation and gaps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "attempt-speed-"));
  try {
    await step(root, "0001-chat", { kind: "chat", provider: "anthropic", startedAt: at(0), finishedAt: at(2_000), ms: 2_000 });
    // 1,000 output tokens of which 33 chars, about 10 tokens, were visible: almost all thinking.
    await step(root, "0002-decide", { kind: "decide", provider: "anthropic", startedAt: at(2_000), finishedAt: at(8_000), ms: 6_000, usage: { outputTokens: 1_000, cacheMissInputTokens: 3_500 } }, { "response.txt": "x".repeat(33) });
    await step(root, "0003-tool-core.run_node", {
      kind: "tool", toolId: "core.run_node", startedAt: at(9_000), finishedAt: at(12_000), ms: 3_000,
      spans: [
        { name: "look.before", at: 0, ms: 700 }, { name: "send.capture_snapshot", at: 0, ms: 650 }, { name: "page.capture_snapshot", at: 50, ms: 500 },
        { name: "act", at: 800, ms: 600 }, { name: "send.click", at: 800, ms: 600 }, { name: "page.click", at: 900, ms: 400 },
        { name: "look.after", at: 1_400, ms: 1_500 }, { name: "page.capture_snapshot", at: 2_300, ms: 500 }
      ]
    }, { "call.json": JSON.stringify({ input: { node: "web.output.dom-click" } }) });
    await step(root, "0004-tool-core.describe_nodes", { kind: "tool", toolId: "core.describe_nodes", startedAt: at(12_000), finishedAt: at(12_010), ms: 10 }, { "call.json": "{}" });
    await step(root, "0005-judge", { kind: "judge", provider: "anthropic", startedAt: at(13_000), finishedAt: at(20_000), ms: 7_000 });
    await mkdir(path.join(root, "0006-decide"));

    const speed = await attemptSpeed(root);
    assert.equal(speed.wallMs, 20_000);
    assert.deepEqual(speed.decisions, { calls: 1, ms: 6_000, thinkingMs: 5_940, outputMs: 60, uncachedInputTokens: 3_500 });
    assert.deepEqual(speed.browser, { steps: 1, ms: 3_000, actionMs: 400, overheadMs: 2_600, unsplitMs: 0 });
    assert.equal(speed.judgeMs, 7_000);
    assert.equal(speed.interpretationMs, 2_000);
    assert.equal(speed.otherToolMs, 10);
    assert.equal(speed.gapsMs, 20_000 - 18_010);
    assert.deepEqual(speed.nodes.map(({ node, steps, actionMs, overheadMs }) => ({ node, steps, actionMs, overheadMs })), [{ node: "dom-click", steps: 1, actionMs: 400, overheadMs: 2_600 }]);
    assert.equal(speed.nodes[0]!.spans["page.capture_snapshot"], 1_000);

    const lines = attemptSpeedLines(1, speed);
    assert.match(lines[0]!, /^Speed of attempt 1: 20\.0 s wall\. Model decisions 6\.0 s over 1 calls \(thinking about 5\.9 s/u);
    assert.match(lines[0]!, /Browser 3\.0 s over 1 steps \(action 0\.4 s, overhead 2\.6 s\)/u);
    assert.match(lines[1]!, /^ {2}dom-click x1: 3000 ms a step, action 400, overhead 2600 \(mean ms: act 600, look\.after 1500/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("counts a look node's own capture as its action, a node step from before spans whole, and only the steps after `skip`", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "attempt-speed-"));
  try {
    await step(root, "0001-tool-core.run_node", { kind: "tool", toolId: "core.run_node", startedAt: at(0), finishedAt: at(1_000), ms: 1_000 }, { "call.json": JSON.stringify({ input: { node: "web.output.dom-click" } }) });
    await step(root, "0002-tool-core.run_node", {
      kind: "tool", toolId: "core.run_node", startedAt: at(1_000), finishedAt: at(1_800), ms: 800,
      spans: [{ name: "look", at: 0, ms: 790 }, { name: "send.capture_snapshot", at: 0, ms: 700 }, { name: "page.capture_snapshot", at: 10, ms: 600 }]
    }, { "call.json": JSON.stringify({ input: { node: "web.output.capture-snapshot" } }) });
    const all = await attemptSpeed(root);
    assert.deepEqual(all.browser, { steps: 2, ms: 1_800, actionMs: 600, overheadMs: 200, unsplitMs: 1_000 });
    const later = await attemptSpeed(root, 1);
    assert.deepEqual(later.browser, { steps: 1, ms: 800, actionMs: 600, overheadMs: 200, unsplitMs: 0 });
    assert.deepEqual(await attemptSpeed(path.join(root, "no-such-folder")), { ...later, wallMs: 0, browser: { steps: 0, ms: 0, actionMs: 0, overheadMs: 0, unsplitMs: 0 }, nodes: [], gapsMs: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
