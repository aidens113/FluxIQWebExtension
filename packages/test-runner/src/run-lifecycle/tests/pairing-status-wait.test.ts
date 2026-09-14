import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { awaitPairingStatus, pairingStatusWaitFailureDetails } from "../pairing-status-wait.js";

test("returns the status that satisfies the named pairing stage", async () => {
  const statuses = [{ connectionState: "connecting" }, { connectionState: "pairing", pairingReferenceCode: "not-published" }];
  const status = await awaitPairingStatus(async () => statuses.shift(), value => value.connectionState === "pairing", "pre-approval", { sleep: async () => undefined });
  assert.equal(status.connectionState, "pairing");
});

test("the unchanged 15-second bound reports the stage and only a sanitized last status", async () => {
  const clock = { value: 1_000 };
  const readStatus = async () => ({
    connectionState: "pairing",
    pairingReferenceCode: "secret-reference",
    sessionId: "secret-session",
    queueSize: 3,
    lastMessageAt: 15_500,
    lastError: "page data must not travel",
    activeTabUrl: "https://private.example/path",
  });
  await assert.rejects(
    () => awaitPairingStatus(readStatus, () => false, "post-approval", {
      now: () => clock.value,
      sleep: async ms => { clock.value += ms; },
    }),
    (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "gateway.connection");
      assert.match(error.message, /post-approval/);
      assert.deepEqual(error.details, {
        pairingStage: "post-approval",
        timeoutMs: 15_000,
        waitedMs: 15_000,
        lastStatus: {
          connectionState: "pairing",
          hasPairingReferenceCode: true,
          hasSessionId: true,
          queueSize: 3,
          msSinceLastMessage: 500,
        },
      });
      return true;
    },
  );
});

test("unknown and malformed status fields are closed to safe sentinel values", async () => {
  const clock = { value: 0 };
  await assert.rejects(
    () => awaitPairingStatus(async () => ({ connectionState: "private-state", queueSize: -2, lastMessageAt: "yesterday" }), () => false, "pre-approval", {
      timeoutMs: 100,
      now: () => clock.value,
      sleep: async ms => { clock.value += ms; },
    }),
    (error: unknown) => error instanceof RunnerFailure && JSON.stringify(error.details?.lastStatus) === JSON.stringify({ connectionState: "unreported", hasPairingReferenceCode: false, hasSessionId: false, queueSize: null, msSinceLastMessage: null }),
  );
});

test("only the pairing wait's closed detail shape is selected for publication", () => {
  const safe = new RunnerFailure("gateway.connection", "timed out", { details: {
    pairingStage: "pre-approval", timeoutMs: 15_000, waitedMs: 15_000,
    lastStatus: { connectionState: "connecting", hasPairingReferenceCode: false, hasSessionId: false, queueSize: 0, msSinceLastMessage: null },
  } });
  assert.deepEqual(pairingStatusWaitFailureDetails(safe), safe.details);
  assert.equal(pairingStatusWaitFailureDetails(new RunnerFailure("gateway.connection", "other", { details: { activeTabUrl: "private" } })), undefined);
});

test("a pending status transport is bounded, cleaned, and its late rejection is observed", async () => {
  let rejectStatus!: (error: unknown) => void;
  const status = new Promise<unknown>((_resolve, reject) => { rejectStatus = reject; });
  let clock = 0;
  let timer: { callback: () => void; delayMs: number } | undefined;
  const wait = awaitPairingStatus(() => status, () => false, "post-approval", {
    now: () => clock,
    setTimer: (callback, delayMs) => { timer = { callback, delayMs }; return 1 as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: () => { timer = undefined; },
  });
  await Promise.resolve();
  assert.equal(timer?.delayMs, 15_000);
  clock = 15_000;
  timer?.callback();
  await assert.rejects(wait, (error: unknown) => error instanceof RunnerFailure
    && error.details?.pairingStage === "post-approval"
    && error.details?.waitedMs === 15_000);
  assert.equal(timer, undefined);
  rejectStatus(new Error("private late status text"));
  await new Promise(resolve => setImmediate(resolve));
});

test("a pending sleep is bounded and no later status read starts after expiry", async () => {
  let reads = 0;
  let clock = 0;
  let expire!: () => void;
  const wait = awaitPairingStatus(async () => { reads += 1; return { connectionState: "pairing" }; }, () => false, "post-approval", {
    now: () => clock,
    sleep: () => new Promise<void>(() => undefined),
    setTimer: callback => { expire = callback; return 1 as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: () => undefined,
  });
  await Promise.resolve();
  clock = 15_000;
  expire();
  await assert.rejects(wait, (error: unknown) => error instanceof RunnerFailure && error.details?.waitedMs === 15_000);
  assert.equal(reads, 1);
});

test("a status promise created on the deadline is observed before refusal", async () => {
  let clock = 0;
  let rejectStatus!: (error: unknown) => void;
  const status = new Promise<unknown>((_resolve, reject) => { rejectStatus = reject; });
  const wait = awaitPairingStatus(() => {
    clock = 15_000;
    return status;
  }, () => false, "post-approval", {
    now: () => clock,
    setTimer: () => 1 as unknown as ReturnType<typeof setTimeout>,
    clearTimer: () => undefined,
  });
  await assert.rejects(wait, (error: unknown) => error instanceof RunnerFailure && error.details?.waitedMs === 15_000);
  rejectStatus(new Error("private deadline-edge status text"));
  await new Promise(resolve => setImmediate(resolve));
});
