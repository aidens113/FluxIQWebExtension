import { RunnerFailure } from "../failure.js";
import { awaitPairingStatus } from "./pairing-status-wait.js";

type PairingStatus = Record<string, unknown> & {
  connectionState?: string;
  pairingReferenceCode?: string;
  sessionId?: string;
  queueSize?: number;
  lastMessageAt?: number;
};
type ConnectedStatus = PairingStatus & { connectionState: "connected"; sessionId: string };
type PairExtensionDependencies = {
  connect(): Promise<unknown>;
  readStatus(): Promise<unknown>;
  approvePairing(referenceCode: string): Promise<unknown>;
};
type Timer = ReturnType<typeof setTimeout>;
type PairExtensionOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  coldReconnectLimit?: number;
  coldReconnectBackoffMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  setTimer?: (callback: () => void, delayMs: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

const PAIRING_TIMEOUT_MS = 15_000;
const PAIRING_INTERVAL_MS = 100;
const COLD_RECONNECT_LIMIT = 2;
const COLD_RECONNECT_BACKOFF_MS = 100;
const PAIRING_REFERENCE_CODE = /^\d{6}$/u;
const CONNECTION_STATES = new Set(["disconnected", "connecting", "pairing", "connected", "reconnecting", "error"]);

/** Pairs one extension, recovering only when a status proves its in-memory gateway epoch is cold. */
export async function pairExtensionWithColdEpochRecovery(
  dependencies: PairExtensionDependencies,
  options: PairExtensionOptions = {},
): Promise<ConnectedStatus> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const timeoutMs = options.timeoutMs ?? PAIRING_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? PAIRING_INTERVAL_MS;
  const reconnectLimit = options.coldReconnectLimit ?? COLD_RECONNECT_LIMIT;
  const reconnectBackoffMs = options.coldReconnectBackoffMs ?? COLD_RECONNECT_BACKOFF_MS;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let lastStatus: PairingStatus | undefined;
  let reconnectAttempts = 0;

  try {
    // The connect acknowledgement is observation zero; do not create a gap by
    // discarding it and asking a potentially new service-worker epoch again.
    lastStatus = record(await beforeDeadline(safeTransport(dependencies.connect, "pre-approval"), deadline, now, setTimer, clearTimer));
    while (!readyForApproval(lastStatus)) {
      if (exactColdStatus(lastStatus) && reconnectAttempts < reconnectLimit) {
        const backoff = reconnectBackoffMs * 2 ** reconnectAttempts;
        reconnectAttempts += 1;
        await beforeDeadline(sleep(backoff), deadline, now, setTimer, clearTimer);
        lastStatus = record(await beforeDeadline(safeTransport(dependencies.connect, "pre-approval"), deadline, now, setTimer, clearTimer));
        continue;
      }
      await beforeDeadline(sleep(intervalMs), deadline, now, setTimer, clearTimer);
      lastStatus = record(await beforeDeadline(safeTransport(dependencies.readStatus, "pre-approval"), deadline, now, setTimer, clearTimer));
    }
  } catch (error) {
    if (error instanceof PairingDeadlineExpired) throw timeoutFailure(startedAt, timeoutMs, lastStatus, now());
    throw error;
  }

  if (connectedStatus(lastStatus)) return lastStatus;
  const referenceCode = lastStatus?.pairingReferenceCode;
  if (!validReferenceCode(referenceCode)) throw new RunnerFailure("gateway.connection", "Extension pairing became ready without a valid reference code");
  await dependencies.approvePairing(referenceCode);
  const approved = await awaitPairingStatus(
    () => safeTransport(dependencies.readStatus, "post-approval"),
    connectedStatus,
    "post-approval",
    { timeoutMs, intervalMs, now, sleep, setTimer, clearTimer },
  );
  if (!connectedStatus(approved)) throw new RunnerFailure("gateway.connection", "Extension pairing wait returned without a connected session");
  return approved;
}

function readyForApproval(status: PairingStatus | undefined): boolean {
  return connectedStatus(status)
    || (status?.connectionState === "pairing" && validReferenceCode(status.pairingReferenceCode));
}

function validReferenceCode(value: unknown): value is string {
  return typeof value === "string" && PAIRING_REFERENCE_CODE.test(value);
}

async function safeTransport(operation: () => Promise<unknown>, stage: "pre-approval" | "post-approval"): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RunnerFailure && error.category !== "extension.worker") throw error;
    throw new RunnerFailure("gateway.connection", `Extension pairing status transport failed during ${stage}`);
  }
}

function connectedStatus(status: PairingStatus | undefined): status is ConnectedStatus {
  return status?.connectionState === "connected" && typeof status.sessionId === "string";
}

function exactColdStatus(status: PairingStatus | undefined): boolean {
  return status?.connectionState === "disconnected"
    && status.pairingReferenceCode === undefined
    && status.sessionId === undefined
    && status.lastMessageAt === undefined
    && status.queueSize === 0
    && status.lastError === undefined;
}

async function beforeDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  now: () => number,
  setTimer: (callback: () => void, delayMs: number) => Timer,
  clearTimer: (timer: Timer) => void,
): Promise<T> {
  void promise.catch(() => undefined);
  const remaining = deadline - now();
  if (remaining <= 0) throw new PairingDeadlineExpired();
  let timer: Timer | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimer(() => reject(new PairingDeadlineExpired()), remaining);
  });
  try {
    const value = await Promise.race([promise, timeout]);
    if (now() >= deadline) throw new PairingDeadlineExpired();
    return value;
  } finally {
    if (timer !== undefined) clearTimer(timer);
  }
}

function timeoutFailure(startedAt: number, timeoutMs: number, status: PairingStatus | undefined, finishedAt: number): RunnerFailure {
  return new RunnerFailure("gateway.connection", "Timed out waiting for extension pairing state during pre-approval", {
    details: {
      pairingStage: "pre-approval",
      timeoutMs,
      waitedMs: finishedAt - startedAt,
      lastStatus: safeStatus(status, finishedAt),
    },
  });
}

function safeStatus(status: PairingStatus | undefined, now: number): Readonly<Record<string, unknown>> {
  const connectionState = typeof status?.connectionState === "string" && CONNECTION_STATES.has(status.connectionState)
    ? status.connectionState
    : "unreported";
  const queueSize = finiteNonNegativeInteger(status?.queueSize) ? status.queueSize : null;
  const lastMessageAt = finiteNumber(status?.lastMessageAt) ? status.lastMessageAt : undefined;
  return {
    connectionState,
    hasPairingReferenceCode: typeof status?.pairingReferenceCode === "string",
    hasSessionId: typeof status?.sessionId === "string",
    queueSize,
    msSinceLastMessage: lastMessageAt === undefined ? null : Math.max(0, now - lastMessageAt),
  };
}

function record(value: unknown): PairingStatus | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as PairingStatus : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteNonNegativeInteger(value: unknown): value is number {
  return finiteNumber(value) && Number.isInteger(value) && value >= 0;
}

class PairingDeadlineExpired extends Error {}
