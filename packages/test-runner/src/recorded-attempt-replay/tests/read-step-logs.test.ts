import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readRecordedStepLogs } from "../index.js";

test("actual writer format preserves malformed schema replies and derives only evidenced media types", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "recorded-steps-"));
  try {
    const first = path.join(directory, "0001-chat");
    const second = path.join(directory, "0002-chat");
    await Promise.all([mkdir(first), mkdir(second)]);
    for (const folder of [first, second]) {
      await writeFile(path.join(folder, "request.json"), '{"model":"haiku"}');
      await writeFile(path.join(folder, "meta.json"), JSON.stringify({ provider: "anthropic", model: "haiku", httpStatus: 200, costUsd: 0.012 }));
    }
    const raw = 'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":8},"content":[{"text":"{broken schema"}]}}\n\n';
    await writeFile(path.join(first, "response.json"), raw);
    const read = await readRecordedStepLogs({ stepsDirectory: directory, streams: { "0001-chat": "chat", "0002-chat": "chat" } });
    assert.equal(Buffer.from(read.exchanges[0]!.response!).toString(), raw);
    assert.equal(read.exchanges[0]!.status, 200);
    assert.equal(read.exchanges[0]!.historicalUsd, 0.012);
    assert.equal(read.exchanges[0]!.contentType, "text/event-stream");
    assert.equal(read.exchanges[1]!.response, null);
    assert.deepEqual(read.gaps, ["missing_response:0002-chat"]);
    assert.deepEqual(read.inferredMediaTypes, ["0001-chat"]);
    await rm(path.join(second, "meta.json"));
    const interrupted = await readRecordedStepLogs({ stepsDirectory: directory, streams: { "0001-chat": "chat", "0002-chat": "chat" } });
    assert.equal(interrupted.requests, 2);
    assert.equal(interrupted.exchanges.length, 2, "an unfinished request is not silently truncated");
    assert.deepEqual(interrupted.unmatchedRequests, ["0002-chat"]);
    assert.equal(interrupted.exchanges[1]!.status, null);
    assert.ok(interrupted.gaps.includes("unmatched_request:0002-chat"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
