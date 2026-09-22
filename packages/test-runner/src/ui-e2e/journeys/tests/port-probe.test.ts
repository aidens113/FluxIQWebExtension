// The restart journey's proof that a stopped Core left nothing listening.

import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { loopbackPortAccepting, waitForPortsClosed } from "../port-probe.js";

test("a listening loopback port accepts, and the same port refuses once its server closes", async () => {
  const server = createServer(socket => socket.destroy());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  assert.equal(await loopbackPortAccepting(address.port), true);
  await new Promise<void>(resolve => server.close(() => resolve()));
  assert.equal(await loopbackPortAccepting(address.port), false);
});

test("ports that close while probed are waited for; one that stays open fails naming it by label", async () => {
  let probes = 0;
  const closing = await waitForPortsClosed([{ label: "web", port: 1 }, { label: "gateway", port: 2 }], 5_000, async port => {
    probes += 1;
    return port === 2 && probes < 4;
  });
  assert.ok(closing.probes >= 2);
  await assert.rejects(
    waitForPortsClosed([{ label: "web", port: 1 }, { label: "gateway", port: 2 }], 300, async port => port === 1),
    (error: unknown) => error instanceof RunnerFailure && error.details?.reasonCode === "restart.port_still_open" && JSON.stringify(error.details?.openPorts) === JSON.stringify(["web"]),
  );
});
