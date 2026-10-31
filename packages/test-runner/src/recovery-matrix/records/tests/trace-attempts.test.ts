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

test("identity recovery has no fabricated source or returned flag and never copies parameters, page evidence or patches", () => {
  const [attempt] = matrixTraceAttempts({ trace: { attempts: [{ nodeId: LIKE, status: "succeeded", reacquire: { kind: "identity", outcome: "found", at: 1_000, parameters: { selector: "private-selector" }, fingerprint: { accessibleName: "private-name" }, page: "private-page", patches: [{ value: "private-patch" }] } }] } });
  assert.deepEqual(attempt!.reacquire, { kind: "identity", outcome: "found", reason: null });
  assert.equal(Object.hasOwn(attempt!.reacquire!, "sourceNodeId"), false);
  assert.equal(Object.hasOwn(attempt!.reacquire!, "returned"), false);
  assert.equal(JSON.stringify(attempt).includes("private-"), false);
});

test("identity diagnostics are closed and source-shaped or malformed identity records are rejected", () => {
  const attempts = matrixTraceAttempts({ trace: { attempts: [
    { reacquire: { kind: "identity", outcome: "unavailable", reason: "place_unproved" } },
    { reacquire: { kind: "identity", outcome: "unmatched", reason: "private_page_text" } },
    { reacquire: { kind: "identity", outcome: "found", sourceNodeId: POSTS } },
    { reacquire: { kind: "identity", outcome: "found", returned: false } },
    { reacquire: { kind: "identity", outcome: "invented" } }
  ] } });
  assert.deepEqual(attempts[0]!.reacquire, { kind: "identity", outcome: "unavailable", reason: "place_unproved" });
  assert.deepEqual(attempts[1]!.reacquire, { kind: "identity", outcome: "unmatched", reason: null });
  assert.deepEqual(attempts.slice(2).map((attempt) => attempt.reacquire), [null, null, null]);
});
