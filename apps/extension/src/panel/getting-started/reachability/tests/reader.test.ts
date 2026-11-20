// The reachability reader: asks only while disconnected, only the configured address, says what it found, beats,
// and forgets when connected.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith as base } from "../../../tests/status-fixture";
import type { ExtensionStatus } from "../../../../shared/protocol";
import type { DiscoveryAnswer } from "../answer";
import { createReachabilityReader, REACHABILITY_BEAT_MS, type ReachabilityHost } from "../reader";

const SETTINGS = { gatewayUrl: "ws://127.0.0.1:4777/client", coreApiUrl: "http://127.0.0.1:3000", autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true, requestsEnabled: false };
const statusWith = (overrides: Partial<ExtensionStatus> = {}): ExtensionStatus => base({ settings: SETTINGS, ...overrides });
const FOUND: DiscoveryAnswer = { found: true, gatewayUrl: "ws://127.0.0.1:4877/client" };
const MISSING: DiscoveryAnswer = { found: false };

function rig(answers: DiscoveryAnswer[]) {
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
  const probe = async (address: string): Promise<DiscoveryAnswer> => {
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

test("disconnected: asks the configured web address once, says where it found FluxIQ and its connection address, and beats", async () => {
  const { reader, timers, asked, settle, changes } = rig([FOUND]);
  assert.equal(reader.current(), undefined);
  reader.observe(statusWith());
  await settle();
  assert.deepEqual(asked, ["http://127.0.0.1:3000"]);
  assert.deepEqual(reader.current(), { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", found: true, gatewayUrl: "ws://127.0.0.1:4877/client" });
  assert.equal(changes(), 1);
  assert.equal(timers.filter((timer) => timer.live)[0]?.ms, REACHABILITY_BEAT_MS);
  reader.observe(statusWith());
  assert.equal(asked.length, 1, "the same status asks nothing more");
});

test("it asks the address the person configured, never silently the built-in one", async () => {
  const { reader, asked, settle } = rig([FOUND]);
  reader.observe(statusWith({ settings: { ...SETTINGS, coreApiUrl: "http://127.0.0.1:3100" } }));
  await settle();
  assert.deepEqual(asked, ["http://127.0.0.1:3100"]);
  assert.equal(reader.current()?.host, "127.0.0.1:3100");
  reader.observe(statusWith({ settings: { ...SETTINGS, coreApiUrl: "http://127.0.0.1:3200" } }));
  await settle();
  assert.deepEqual(asked, ["http://127.0.0.1:3100", "http://127.0.0.1:3200"], "a changed address is asked at once");
});

test("a saved status with no web address yet asks the built-in first guess, and says so by its address", async () => {
  const { reader, asked, settle } = rig([MISSING]);
  reader.observe(statusWith({ settings: { ...SETTINGS, coreApiUrl: " " } }));
  await settle();
  assert.deepEqual(asked, ["http://127.0.0.1:3000"]);
  assert.equal(reader.current()?.found, false);
  assert.equal(reader.current()?.host, "127.0.0.1:3000");
});

test("an unreachable FluxIQ is not found, then found on the next beat", async () => {
  const { reader, timers, settle, changes } = rig([MISSING, FOUND]);
  reader.observe(statusWith());
  await settle();
  assert.equal(reader.current()?.found, false);
  assert.equal(reader.current()?.gatewayUrl, undefined);
  timers.filter((timer) => timer.live)[0]!.run();
  await settle();
  assert.equal(reader.current()?.found, true);
  assert.equal(changes(), 2);
});

test("a probe that throws reads as not found", async () => {
  const reader = createReachabilityReader(async () => {
    throw new Error("network");
  }, { setTimeout: () => undefined, clearTimeout: () => undefined }, () => undefined);
  reader.observe(statusWith());
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(reader.current()?.found, false);
});

test("connecting forgets the answer and stops the beat", async () => {
  const { reader, timers, settle } = rig([FOUND]);
  reader.observe(statusWith());
  await settle();
  reader.observe(statusWith({ connectionState: "connecting" }));
  assert.equal(reader.current(), undefined);
  assert.equal(timers.filter((timer) => timer.live).length, 0);
});
