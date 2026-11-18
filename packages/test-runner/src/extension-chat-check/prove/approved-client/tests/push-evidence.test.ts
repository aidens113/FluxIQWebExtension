import assert from "node:assert/strict";
import test from "node:test";
import { chatIsQuiet, extensionReadsSince, streamOpenedAfter } from "../push-evidence.js";

const call = (at: number, endpoint: string | null, bearer = true) => ({ at, endpoint, bearer });

test("only the extension's own thread reads count as reads", () => {
  const reads = extensionReadsSince([call(1, "get-conversation"), call(2, "append-turn"), call(3, "list-conversations"), call(4, "get-conversation", false), call(5, null), call(10, "get-conversation")], 2);
  assert.deepEqual(reads, [{ at: 3, endpoint: "list-conversations" }, { at: 10, endpoint: "get-conversation" }]);
});

test("a chat is quiet only after the window passes with no read, and a steady timer never lets it be", () => {
  assert.equal(chatIsQuiet([], 5_000, 8_000, 0), false);
  assert.equal(chatIsQuiet([], 8_000, 8_000, 0), true);
  assert.equal(chatIsQuiet([call(4_000, "get-conversation")], 11_000, 8_000, 0), false);
  assert.equal(chatIsQuiet([call(4_000, "get-conversation")], 12_000, 8_000, 0), true);
  const timer = [1, 2, 3, 4, 5, 6].map((second) => call(second * 5_000, "get-conversation"));
  for (let now = 5_000; now <= 35_000; now += 1_000) assert.equal(chatIsQuiet(timer.filter((read) => read.at <= now), now, 8_000, 0), false);
});

test("a stream counts as reopened only by a 200 after the restart", () => {
  assert.equal(streamOpenedAfter([], 0), false);
  assert.equal(streamOpenedAfter([{ at: 5, status: 200 }], 5), false);
  assert.equal(streamOpenedAfter([{ at: 6, status: 401 }, { at: 7, status: 503 }], 5), false);
  assert.equal(streamOpenedAfter([{ at: 6, status: 401 }, { at: 8, status: 200 }], 5), true);
});
