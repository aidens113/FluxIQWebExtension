import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AttemptCostProgress, AttemptCostReporter, formatAttemptCostProgress } from "../index.js";

async function fixture(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "attempt-cost-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    async step(name: string, meta?: unknown) {
      const folder = path.join(root, name);
      await mkdir(folder, { recursive: true });
      // Invalid request JSON is deliberate: the observer must never parse it.
      await writeFile(path.join(folder, "request.json"), "PRIVATE_BODY_NOT_JSON");
      if (meta !== undefined) await writeFile(path.join(folder, "meta.json"), JSON.stringify(meta));
      return folder;
    }
  };
}

function paid(costUsd: unknown, taskKind = "evidence_tool_decision", phase = "explore") {
  return { provider: "unit-provider", model: "unit-model", taskKind, phase, requestId: "same-logical-request", finishedAt: "2026-11-22T00:00:00.000Z", costUsd, status: "ok", summary: "PRIVATE_SUMMARY", url: "PRIVATE_URL" };
}

test("pending and late settled receipts keep their original attempt and each physical call counts once", async (context) => {
  const world = await fixture(context);
  await world.step("0001-decide", paid(0.01));
  const pending = await world.step("0002-judge");
  const reader = new AttemptCostProgress(world.root);
  const first = await reader.read(1);
  assert.equal(first.attempts[0]?.settled.knownUsd, 0.01);
  assert.equal(first.attempts[0]?.pendingCalls, 1);
  assert.match(formatAttemptCostProgress(first)[0]!, /total incomplete/u);
  await writeFile(path.join(pending, "meta.json"), JSON.stringify(paid(0.02, "loop_verification")));
  await world.step("0003-repair", paid(0.03, "runtime_patch", "repair"));
  const second = await reader.read(2);
  assert.deepEqual(second.attempts.map((attempt) => [attempt.ordinal, attempt.settled.calls, attempt.settled.knownUsd]), [[1, 2, 0.03], [2, 1, 0.03]]);
  assert.equal(second.attempts[0]?.stages.judge.knownUsd, 0.02);
  assert.equal(second.attempts[1]?.stages.repairs.knownUsd, 0.03);
  assert.deepEqual(await reader.read(2), second);
});

test("failed paid responses count, missing or invalid prices remain unknown, and labels contain no payload", async (context) => {
  const world = await fixture(context);
  const failed = paid(0.04, "loop_verification");
  failed.status = "error";
  await world.step("0001-judge", failed);
  await world.step("0002-decide", paid(null));
  await world.step("0003-decide", paid(-1));
  const chat = paid(0.01, "conversation");
  await world.step("0004-chat", { ...chat, kind: "chat", role: "PRIVATE_ROLE" });
  const snapshot = await new AttemptCostProgress(world.root).read(1);
  assert.equal(snapshot.attempts[0]?.settled.calls, 4);
  assert.equal(snapshot.attempts[0]?.settled.unknownCosts, 2);
  assert.equal(snapshot.attempts[0]?.settled.knownUsd, 0.05);
  assert.equal(snapshot.attempts[0]?.stages.chat.knownUsd, 0.01);
  const output = formatAttemptCostProgress(snapshot).join("\n");
  assert.match(output, /judge \$0\.040000/u);
  assert.match(output, /2 unpriced.*total incomplete/u);
  assert.doesNotMatch(output, /PRIVATE_|unit-model|unit-provider/u);
});

test("partial metadata is retried and an unreadable source never reports a zero total", async (context) => {
  const world = await fixture(context);
  const folder = await world.step("0001-decide");
  await writeFile(path.join(folder, "meta.json"), "{");
  const reader = new AttemptCostProgress(world.root);
  assert.equal((await reader.read(1)).attempts[0]?.unreadableRecords, 1);
  await writeFile(path.join(folder, "meta.json"), JSON.stringify(paid(0.001)));
  assert.equal((await reader.read(1)).attempts[0]?.settled.knownUsd, 0.001);
  const unavailable = await new AttemptCostProgress(path.join(world.root, "absent")).read(1);
  assert.deepEqual(formatAttemptCostProgress(unavailable), ["[cost] step accounting unavailable; current cost unknown"]);
});

test("reporter flushes the last call, avoids duplicate output and does not invent a later attempt", async (context) => {
  const world = await fixture(context);
  const lines: string[] = [];
  const reporter = new AttemptCostReporter(world.root, (line) => lines.push(line));
  await world.step("0001-decide", paid(0.015));
  await reporter.poll();
  await reporter.poll();
  assert.equal(lines.length, 1);
  await world.step("0002-judge", paid(0.025, "loop_verification"));
  await reporter.finish(1);
  assert.equal(lines.length, 2);
  assert.match(lines[1]!, /attempt 1:.*\$0\.040000/u);
  await reporter.finish(1);
  await reporter.poll();
  assert.equal(lines.length, 2);
  await reporter.finish(2);
  assert.match(lines[2]!, /attempt 2:.*\$0\.000000 \(0 calls/u);
});

test("only completed metadata is cached; source step folders need no contiguous ordinal", async (context) => {
  const world = await fixture(context);
  const tool = await world.step("0002-tool-read", { kind: "tool", finishedAt: "2026-11-22T00:00:00Z" });
  await rm(path.join(tool, "request.json"));
  const model = await world.step("0010-decide", paid(0.00000001));
  const reader = new AttemptCostProgress(world.root);
  const first = await reader.read(1);
  assert.equal(first.attempts[0]?.settled.calls, 1);
  assert.match(formatAttemptCostProgress(first)[0]!, /<\$0\.000001/u);
  await rm(path.join(tool, "meta.json"));
  await rm(path.join(model, "meta.json"));
  assert.deepEqual(await reader.read(1), first);
});


test("model request beside identifierless metadata remains unknown and can settle later", async (context) => {
  const world = await fixture(context);
  const folder = await world.step("0001-decide", { finishedAt: "2026-11-22T00:00:00Z" });
  const reader = new AttemptCostProgress(world.root);
  const first = await reader.read(1);
  assert.equal(first.attempts[0]?.unreadableRecords, 1);
  assert.equal(first.attempts[0]?.settled.calls, 0);
  assert.match(formatAttemptCostProgress(first)[0]!, /total incomplete/u);
  await writeFile(path.join(folder, "meta.json"), JSON.stringify(paid(0.02)));
  const settled = await reader.read(2);
  assert.equal(settled.attempts[0]?.ordinal, 1);
  assert.equal(settled.attempts[0]?.settled.knownUsd, 0.02);
  assert.equal(settled.attempts[0]?.unreadableRecords, 0);
});
