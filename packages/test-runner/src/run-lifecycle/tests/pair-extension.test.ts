import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { pairExtensionWithColdEpochRecovery } from "../pair-extension.js";

type Status = Record<string, unknown>;
type Fixture = {
  connect?: Array<Status | Promise<Status>>;
  statuses?: Array<Status | Promise<Status>>;
  approvalError?: unknown;
  connectElapsedMs?: number;
};

const pairing = { connectionState: "pairing", pairingReferenceCode: "123456", queueSize: 0 };
const connected = { connectionState: "connected", sessionId: "session-id", queueSize: 0 };
const cold = { connectionState: "disconnected", queueSize: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(fixture: Fixture = {}) {
  const calls: Array<{ kind: "connect" | "status" | "approve" | "sleep"; value?: unknown }> = [];
  const connect = [...(fixture.connect ?? [pairing])];
  const statuses = [...(fixture.statuses ?? [connected])];
  let clock = 1_000;
  let nextTimer = 1;
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  const operation = pairExtensionWithColdEpochRecovery({
    connect: async () => {
      calls.push({ kind: "connect" });
      clock += fixture.connectElapsedMs ?? 0;
      const response = connect.shift();
      return await (response ?? cold);
    },
    readStatus: async () => {
      calls.push({ kind: "status" });
      const response = statuses.shift();
      return await (response ?? cold);
    },
    approvePairing: async referenceCode => {
      calls.push({ kind: "approve", value: referenceCode });
      if (fixture.approvalError !== undefined) throw fixture.approvalError;
    },
  }, {
    now: () => clock,
    sleep: async ms => { calls.push({ kind: "sleep", value: ms }); clock += ms; },
    setTimer: (callback, delayMs) => {
      const id = nextTimer++;
      timers.set(id, { callback, delayMs });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: timer => { timers.delete(timer as unknown as number); },
  });
  return {
    calls,
    operation,
    timers,
    expire: () => {
      const timer = timers.values().next().value as { callback: () => void; delayMs: number } | undefined;
      assert.ok(timer);
      clock += timer.delayMs;
      timer.callback();
    },
  };
}

test("uses the connect response as observation zero and approves without a status gap", async () => {
  const h = harness();
  assert.deepEqual(await h.operation, connected);
  assert.deepEqual(h.calls, [
    { kind: "connect" },
    { kind: "approve", value: "123456" },
    { kind: "status" },
  ]);
  assert.equal(h.timers.size, 0);
});

test("an already connected initial response needs neither approval nor a status poll", async () => {
  const h = harness({ connect: [connected] });
  assert.deepEqual(await h.operation, connected);
  assert.deepEqual(h.calls, [{ kind: "connect" }]);
});

test("reconnects an exact cold epoch and inspects the reconnect response immediately", async () => {
  const h = harness({ connect: [cold, pairing] });
  assert.deepEqual(await h.operation, connected);
  assert.deepEqual(h.calls, [
    { kind: "connect" },
    { kind: "sleep", value: 100 },
    { kind: "connect" },
    { kind: "approve", value: "123456" },
    { kind: "status" },
  ]);
});

test("cold reconnects are capped and exponentially backed off", async () => {
  const h = harness({ connect: [cold, cold, cold], statuses: [pairing, connected] });
  await h.operation;
  assert.deepEqual(h.calls.filter(call => call.kind === "connect").length, 3);
  assert.deepEqual(h.calls.filter(call => call.kind === "sleep").map(call => call.value), [100, 200, 100]);
  assert.deepEqual(h.calls.filter(call => call.kind === "approve").length, 1);
});

test("never reconnects a non-cold, message-, code-, session-, queue-, or error-bearing state", async () => {
  const refused: Status[] = [
    { connectionState: "error", queueSize: 0 },
    { connectionState: "reconnecting", queueSize: 0 },
    { connectionState: "disconnected", queueSize: 0, lastMessageAt: 900 },
    { connectionState: "disconnected", queueSize: 0, pairingReferenceCode: "existing" },
    { connectionState: "disconnected", queueSize: 0, sessionId: "existing" },
    { connectionState: "disconnected", queueSize: 1 },
    { connectionState: "disconnected", queueSize: 0, lastError: "not published" },
    { connectionState: "pairing", queueSize: 0 },
    { connectionState: "unknown", queueSize: 0 },
  ];
  for (const initial of refused) {
    const h = harness({ connect: [initial], statuses: [pairing, connected] });
    await h.operation;
    assert.equal(h.calls.filter(call => call.kind === "connect").length, 1);
  }
});

test("empty, whitespace, non-string, and over-limit references never reach approval", async () => {
  for (const supplied of ["", "   ", 123456, "1234567"]) {
    const invalid = { connectionState: "pairing", pairingReferenceCode: supplied, queueSize: 0 };
    const h = harness({ connect: [invalid], statuses: Array.from({ length: 200 }, () => invalid) });
    await assert.rejects(h.operation, (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "gateway.connection");
      assert.equal(error.message.includes("reference"), false);
      if (String(supplied).length > 0) assert.equal(JSON.stringify(error.details).includes(String(supplied)), false);
      return true;
    });
    assert.equal(h.calls.some(call => call.kind === "approve"), false);
    assert.equal(h.calls.filter(call => call.kind === "connect").length, 1);
  }
});

test("immediate connect and polled-status transport text is replaced by a fixed gateway failure", async () => {
  for (const createFixture of [
    () => ({ connect: [Promise.reject(new Error("private connect transport text"))] }),
    () => ({ connect: [{ connectionState: "connecting", queueSize: 0 }], statuses: [Promise.reject(new Error("private status transport text"))] }),
  ]) {
    const h = harness(createFixture());
    await assert.rejects(h.operation, (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "gateway.connection");
      assert.equal(error.message, "Extension pairing status transport failed during pre-approval");
      assert.equal(JSON.stringify(error).includes("private"), false);
      return true;
    });
    assert.equal(h.timers.size, 0);
  }
});

test("a categorized non-worker transport failure keeps precedence", async () => {
  const primary = new RunnerFailure("fixture.invalid", "fixed categorized failure");
  const h = harness({ connect: [Promise.reject(primary)] });
  await assert.rejects(h.operation, error => error === primary);
  assert.equal(h.timers.size, 0);
});

test("the initial transport and backoff consume one absolute pre-approval deadline", async () => {
  const h = harness({ connect: [{ connectionState: "connecting", queueSize: 0 }], connectElapsedMs: 14_950 });
  await assert.rejects(h.operation, timeout("pre-approval", 15_050, "connecting"));
  assert.equal(h.calls.filter(call => call.kind === "status").length, 0, "no status transport starts after expiry");
  assert.equal(h.calls.filter(call => call.kind === "approve").length, 0);
  assert.equal(h.timers.size, 0);
});

test("a backoff that reaches the deadline starts no reconnect transport", async () => {
  const h = harness({ connect: [cold], connectElapsedMs: 14_950 });
  await assert.rejects(h.operation, timeout("pre-approval", 15_050, "disconnected"));
  assert.equal(h.calls.filter(call => call.kind === "connect").length, 1);
  assert.equal(h.calls.filter(call => call.kind === "approve").length, 0);
});

test("a hanging transport is bounded, its timer is cleaned, and a late rejection is observed", async () => {
  const pending = deferred<Status>();
  const h = harness({ connect: [pending.promise] });
  await Promise.resolve();
  assert.deepEqual([...h.timers.values()].map(timer => timer.delayMs), [15_000]);
  h.expire();
  await assert.rejects(h.operation, timeout("pre-approval", 15_000, "unreported"));
  assert.equal(h.timers.size, 0);
  pending.reject(new Error("private late transport text"));
  await new Promise(resolve => setImmediate(resolve));
});

test("approval failures keep precedence and do not enter the post-approval wait", async () => {
  const primary = new RunnerFailure("gateway.pairing", "fixed approval failure");
  const h = harness({ approvalError: primary });
  await assert.rejects(h.operation, error => error === primary);
  assert.equal(h.calls.filter(call => call.kind === "status").length, 0);
  assert.equal(h.timers.size, 0);
});

test("post-approval retains its own stage and fixed safe timeout projection", async () => {
  const h = harness({ statuses: [{ connectionState: "pairing", pairingReferenceCode: "private", sessionId: "private", queueSize: 2, lastMessageAt: 900 }] });
  await assert.rejects(h.operation, (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "gateway.connection");
    assert.equal(error.message.includes("private"), false);
    assert.deepEqual(error.details, {
      pairingStage: "post-approval",
      timeoutMs: 15_000,
      waitedMs: 15_000,
      lastStatus: {
        connectionState: "disconnected",
        hasPairingReferenceCode: false,
        hasSessionId: false,
        queueSize: 0,
        msSinceLastMessage: null,
      },
    });
    return true;
  });
});

test("a hanging post-approval status is bounded, cleaned, and observed when it rejects late", async () => {
  const pending = deferred<Status>();
  const h = harness({ statuses: [pending.promise] });
  await until(() => h.calls.some(call => call.kind === "status"));
  assert.deepEqual([...h.timers.values()].map(timer => timer.delayMs), [15_000]);
  h.expire();
  await assert.rejects(h.operation, timeout("post-approval", 15_000, "unreported"));
  assert.equal(h.timers.size, 0);
  pending.reject(new Error("private late post-status text"));
  await new Promise(resolve => setImmediate(resolve));
});

test("an immediate post-approval status rejection is fixed and secret-safe", async () => {
  const h = harness({ statuses: [Promise.reject(new Error("private post-status transport text"))] });
  await assert.rejects(h.operation, (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "gateway.connection");
    assert.equal(error.message, "Extension pairing status transport failed during post-approval");
    assert.equal(JSON.stringify(error).includes("private"), false);
    return true;
  });
  assert.equal(h.timers.size, 0);
});

function timeout(stage: string, waitedMs: number, state: string) {
  return (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "gateway.connection");
    assert.equal(error.message.includes(stage), true);
    assert.equal(error.details?.pairingStage, stage);
    assert.equal(error.details?.timeoutMs, 15_000);
    assert.equal(error.details?.waitedMs, waitedMs);
    assert.equal((error.details?.lastStatus as Record<string, unknown>)?.connectionState, state);
    return true;
  };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) { if (predicate()) return; await Promise.resolve(); }
  assert.fail("condition did not become true");
}
