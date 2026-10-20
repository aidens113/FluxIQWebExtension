// The browser's host-lease ledger over session storage: each resource's highest
// lease is kept under the key earlier builds used, and a restarted worker over
// the same storage judges against it. Core's own tests cover the judgement.

import assert from "node:assert/strict";
import test from "node:test";
import { clientGatewayMemoryArea, type ClientGatewayHostLease } from "@fluxiq/client-gateway-websocket";
import { sessionHostLeaseLedger } from "..";

const lease = (epoch: number, briefId = "brief-1"): ClientGatewayHostLease => ({ resourceKey: "web.automation:client-a", epoch, holder: { role: "builder", briefId } });

test("a lease is kept under the key earlier builds used, and a restarted worker judges against it", async () => {
  const area = clientGatewayMemoryArea();
  assert.equal((await sessionHostLeaseLedger(area).admit(lease(7))).judgement, "adopt");
  assert.deepEqual((await area.get(null))["fluxiq.hostLease.web.automation:client-a"], lease(7));
  const restarted = sessionHostLeaseLedger(area);
  assert.deepEqual(await restarted.admit(lease(6, "brief-0")), { judgement: "stale", seen: lease(7) });
});
