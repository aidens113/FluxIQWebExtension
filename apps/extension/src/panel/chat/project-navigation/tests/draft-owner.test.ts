import assert from "node:assert/strict";
import test from "node:test";
import { createProjectDraftOwner } from "../draft-owner";
import type { ChatOwner } from "../../owner-context";

test("same selected project retains composer owner, switches revoke stale lease, remote validity remains authoritative", async () => {
  let alive = true, calls = 0;
  const remote: ChatOwner = { token: {}, identity: "synthetic-remote", current: () => alive, request: async <T>() => { calls++; return { ok: true, value: {} as T }; } };
  const owners = createProjectDraftOwner();
  assert.equal(owners.capture(remote, undefined), remote);
  assert.equal(owners.capture(remote, "same", "same"), remote);
  const a = owners.capture(remote, "a");
  assert.equal(owners.capture(remote, "a"), a);
  assert.equal(a.current(), true);
  const b = owners.capture(remote, "b");
  assert.notEqual(a.identity, b.identity); assert.equal(a.current(), false);
  assert.equal((await a.request({ type: "fluxiq.getStatus" })).ok, false); assert.equal(calls, 0);
  assert.equal(b.current(), true); alive = false; assert.equal(b.current(), false);
  assert.equal((await b.request({ type: "fluxiq.getStatus" })).ok, false); assert.equal(calls, 0);
});
