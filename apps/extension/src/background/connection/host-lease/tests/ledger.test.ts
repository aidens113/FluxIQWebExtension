// The highest host lease seen per resource (automation-project-agents plan):
// what it adopts, what it refuses, that a restarted worker still knows it, and
// that two judgements at once cannot leave the lower epoch kept.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationHostLease } from "@fluxiq-web-extension/domain/client";
import { workerMemoryRecordArea, type InFlightRecordArea } from "../../in-flight/index";
import { HostLeaseLedger } from "..";

const lease = (epoch: number, briefId = "brief-1", resourceKey = "web.automation:client-a"): WebAutomationHostLease => ({ resourceKey, epoch, holder: { role: "builder", briefId } });

test("a first lease is adopted; the same one is current; a lower epoch is stale; another holder on the same epoch is a mismatch", async () => {
  const ledger = new HostLeaseLedger(workerMemoryRecordArea());
  assert.deepEqual(await ledger.admit(lease(4)), { judgement: "adopt", seen: undefined });
  assert.deepEqual(await ledger.admit(lease(4)), { judgement: "current", seen: lease(4) });
  assert.deepEqual(await ledger.admit(lease(3, "brief-0")), { judgement: "stale", seen: lease(4) });
  assert.deepEqual(await ledger.admit(lease(4, "brief-2")), { judgement: "holder_mismatch", seen: lease(4) });
  assert.deepEqual(await ledger.admit(lease(5, "brief-2")), { judgement: "adopt", seen: lease(4) });
  assert.equal((await ledger.admit(lease(4))).judgement, "stale", "the higher epoch is the one kept");
});

test("each resource key keeps its own highest lease", async () => {
  const ledger = new HostLeaseLedger(workerMemoryRecordArea());
  await ledger.admit(lease(9));
  assert.equal((await ledger.admit(lease(2, "brief-1", "web.automation:client-b"))).judgement, "adopt");
});

test("a restarted worker judges against what the one before it kept", async () => {
  const area = workerMemoryRecordArea();
  await new HostLeaseLedger(area).admit(lease(7));
  const restarted = new HostLeaseLedger(area);
  assert.deepEqual(await restarted.admit(lease(6, "brief-0")), { judgement: "stale", seen: lease(7) });
  assert.equal((await restarted.admit(lease(7))).judgement, "current");
});

test("two leases judged at once are judged in turn, so the lower epoch is never the one kept", async () => {
  const area = workerMemoryRecordArea();
  const slow: InFlightRecordArea = {
    get: async (keys) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return await area.get(keys);
    },
    set: area.set,
    remove: area.remove
  };
  const ledger = new HostLeaseLedger(slow);
  const [higher, lower] = await Promise.all([ledger.admit(lease(6, "brief-2")), ledger.admit(lease(5))]);
  assert.equal(higher.judgement, "adopt");
  assert.equal(lower.judgement, "stale");
  assert.equal((await new HostLeaseLedger(area).admit(lease(5))).judgement, "stale", "storage holds epoch 6");
});

test("a storage fault is handed back, and the lease this worker already judged still counts", async () => {
  const area = workerMemoryRecordArea();
  let failing = false;
  const flaky: InFlightRecordArea = {
    get: async (keys) => {
      if (failing) throw new Error("storage unavailable");
      return await area.get(keys);
    },
    set: async (items) => {
      if (failing) throw new Error("storage unavailable");
      await area.set(items);
    },
    remove: area.remove
  };
  const ledger = new HostLeaseLedger(flaky);
  await ledger.admit(lease(4));
  failing = true;
  assert.deepEqual(await ledger.admit(lease(3)), { judgement: "stale", seen: lease(4) }, "memory answers without storage");
  const adopted = await ledger.admit(lease(5));
  assert.equal(adopted.judgement, "adopt");
  assert.match(String(adopted.fault), /storage unavailable/u);
  assert.equal((await ledger.admit(lease(4))).judgement, "stale", "the adopted lease is kept in memory");
});
