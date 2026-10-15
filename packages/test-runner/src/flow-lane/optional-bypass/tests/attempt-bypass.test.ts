import assert from "node:assert/strict";
import test from "node:test";
import { bypassedByNode, optionalBypassesOf } from "../index.js";

const WAY_ON = { kind: "deterministic_path", label: "Go on past the optional step", optionalStepWayOn: true, targetNodeId: "merge" };
const attempt = (nodeId: string, overrides: Record<string, unknown> = {}) => ({ attemptId: `a.${nodeId}`, nodeId, status: "succeeded", ...overrides });
const failed = (nodeId: string, recoverySelected?: Record<string, unknown>) => attempt(nodeId, { status: "failed", ...(recoverySelected ? { metadata: { recoverySelected } } : {}) });

test("a failed attempt is a bypass only when Core selected the optional way-on and the run went on at its target", () => {
  assert.deepEqual(optionalBypassesOf([failed("s2", WAY_ON), attempt("merge")]), [{ toNodeId: "merge" }, undefined]);
  assert.deepEqual(optionalBypassesOf([failed("s2", WAY_ON), attempt("s9")]), [undefined, undefined], "the run went elsewhere");
  assert.deepEqual(optionalBypassesOf([failed("s2", WAY_ON)]), [undefined], "the run went nowhere");
  assert.deepEqual(optionalBypassesOf([failed("s2", { kind: "deterministic_path", label: "Follow failed route", targetNodeId: "merge" }), attempt("merge")]), [undefined, undefined], "a plain failed route is not the optional rule");
  assert.deepEqual(optionalBypassesOf([failed("s2", { kind: "reroute", label: "Reroute to recovery node", targetNodeId: "merge" }), attempt("merge")]), [undefined, undefined]);
  assert.deepEqual(optionalBypassesOf([attempt("s2", { metadata: { recoverySelected: WAY_ON } }), attempt("merge")]), [undefined, undefined], "only a failed attempt is bypassed");
  assert.deepEqual(optionalBypassesOf([failed("s2", { ...WAY_ON, targetNodeId: "not a node id" }), attempt("not a node id")]), [undefined, undefined], "a target that is not node-shaped is not read");
});

test("a refuted result's attempt between the step and its target is passed over", () => {
  const verification = { attemptId: "result-verification.run", nodeId: "s5", status: "failed" };
  assert.deepEqual(optionalBypassesOf([failed("s2", WAY_ON), verification, attempt("merge")])[0], { toNodeId: "merge" });
});

test("every attempt of a node whose last attempt was bypassed is marked, and no other", () => {
  const bypass = { toNodeId: "merge" };
  assert.deepEqual(bypassedByNode([{ nodeId: "s2" }, { nodeId: "s2", optionalBypass: bypass }, { nodeId: "merge" }]), [true, true, false]);
  assert.deepEqual(bypassedByNode([{ nodeId: "s2", optionalBypass: bypass }, { nodeId: "s2" }]), [false, false], "a node that ran again after its bypass ended on that later attempt");
  assert.deepEqual(bypassedByNode([{ nodeId: null, optionalBypass: bypass }, { nodeId: null }]), [true, false], "an unnamed attempt is its own group");
});
