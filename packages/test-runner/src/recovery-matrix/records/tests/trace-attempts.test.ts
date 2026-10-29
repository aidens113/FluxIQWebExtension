import assert from "node:assert/strict";
import test from "node:test";
import { matrixTraceAttempts } from "../trace-attempts.js";

const LIKE = "node.bootstrap.0123456789abcdef.main.like";
const POSTS = "node.bootstrap.0123456789abcdef.main.posts";
const NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", message: "No element matched the post's words" };

test("the trace's attempts are read in order, with a retry's number and the re-acquire record in closed words", () => {
  const attempts = matrixTraceAttempts({
    trace: {
      attempts: [
        { nodeId: LIKE, status: "failed", failure: NOT_FOUND },
        { nodeId: LIKE, status: "failed", failure: NOT_FOUND, retry: { attemptNumber: 2, maxAttempts: 4, backoffMs: 250 } },
        { nodeId: LIKE, status: "succeeded", retry: { attemptNumber: 4, maxAttempts: 4, backoffMs: 2000 }, reacquire: { sourceNodeId: POSTS, kind: "row", outcome: "found", returned: true, at: 1_000 } },
      ],
    },
  });
  assert.deepEqual(attempts.map(attempt => [attempt.index, attempt.status, attempt.retryNumber]), [[0, "failed", null], [1, "failed", 2], [2, "succeeded", 4]]);
  assert.deepEqual(attempts[0]!.failure, { category: "target_not_found", code: "web.target.not_found" });
  assert.deepEqual(attempts[2]!.reacquire, { sourceNodeId: POSTS, kind: "row", outcome: "found", reason: null, returned: true });
  assert.equal(attempts[0]!.reacquire, null);
});

test("an outcome, kind or reason Core never writes is not read, and a session with no trace has no attempts", () => {
  const [unknown, odd] = matrixTraceAttempts({
    trace: {
      attempts: [
        { nodeId: LIKE, status: "failed", reacquire: { sourceNodeId: POSTS, kind: "row", outcome: "maybe" } },
        { nodeId: LIKE, status: "done", reacquire: { sourceNodeId: "has a space", kind: "table", outcome: "unmatched", reason: "Two Posts Look Alike" } },
      ],
    },
  });
  assert.equal(unknown!.reacquire, null);
  assert.equal(odd!.status, "unknown");
  assert.deepEqual(odd!.reacquire, { sourceNodeId: null, kind: null, outcome: "unmatched", reason: null, returned: false });
  assert.deepEqual(matrixTraceAttempts({}), []);
  assert.deepEqual(matrixTraceAttempts(undefined), []);
});
