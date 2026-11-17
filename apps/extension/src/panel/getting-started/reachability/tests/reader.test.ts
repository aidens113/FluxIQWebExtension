// The reachability reader: asks only while disconnected, answers, beats, and forgets when connected.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith as base } from "../../../tests/status-fixture";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { createReachabilityReader, REACHABILITY_BEAT_MS, type ReachabilityHost } from "../reader";

const statusWith = (overrides: Partial<ExtensionStatus> = {}): ExtensionStatus => base({ settings: { gatewayUrl: "ws://127.0.0.1:4777/client", coreApiUrl: "http://127.0.0.1:3000", autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true, requestsEnabled: false }, ...overrides });

function rig(answers: boolean[]) {
  const timers: Array<{ run: () => void; ms: number; live: boolean }> = [];
  const asked: string[] = [];
  let changes = 0;
  const host: ReachabilityHost = {
    setTimeout: (run, ms) => {
      const timer = {
        run: () => {
          timer.live = false;
          run();
        },
        ms,
        live: true
      };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      if (handle) (handle as { live: boolean }).live = false;
    }
  };
  const probe = async (address: string): Promise<boolean> => {
    asked.push(address);
    return answers[Math.min(asked.length - 1, answers.length - 1)]!;
  };
  const reader = createReachabilityReader(probe, host, () => {
    changes += 1;
  });
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  return { reader, timers, asked, settle, changes: () => changes };
}

test("disconnected: asks the web address once, answers true, and beats", async () => {
  const { reader, timers, asked, settle, changes } = rig([true]);
  assert.equal(reader.current(), undefined);
  reader.observe(statusWith());
  await settle();
  assert.equal(asked.length, 1);
  assert.equal(reader.current(), true);
  assert.equal(changes(), 1);
  assert.equal(timers.filter((timer) => timer.live)[0]?.ms, REACHABILITY_BEAT_MS);
  reader.observe(statusWith());
  assert.equal(asked.length, 1, "the same status asks nothing more");
});

test("an unreachable FluxIQ answers false, then true on the next beat", async () => {
  const { reader, timers, settle, changes } = rig([false, true]);
  reader.observe(statusWith());
  await settle();
  assert.equal(reader.current(), false);
  timers.filter((timer) => timer.live)[0]!.run();
  await settle();
  assert.equal(reader.current(), true);
  assert.equal(changes(), 2);
});

test("connecting forgets the answer and stops the beat", async () => {
  const { reader, timers, settle } = rig([true]);
  reader.observe(statusWith());
  await settle();
  reader.observe(statusWith({ connectionState: "connecting" }));
  assert.equal(reader.current(), undefined);
  assert.equal(timers.filter((timer) => timer.live).length, 0);
});
