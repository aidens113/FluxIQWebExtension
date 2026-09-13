import { RunnerFailure } from "../failure.js";

type PairingStage = "pre-approval" | "post-approval";
type Status = Record<string, unknown> & {
  connectionState?: string;
  pairingReferenceCode?: string;
  sessionId?: string;
  queueSize?: number;
  lastMessageAt?: number;
};
type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const PAIRING_STATUS_TIMEOUT_MS = 15_000;
const PAIRING_STATUS_INTERVAL_MS = 100;
const CONNECTION_STATES = new Set(["disconnected", "connecting", "pairing", "connected", "reconnecting", "error"]);

/** Waits for one pairing stage and retains only a closed, secret-safe status projection on timeout. */
export async function awaitPairingStatus(
  readStatus: () => Promise<unknown>,
  predicate: (status: Status) => boolean,
  stage: PairingStage,
  options: WaitOptions = {},
): Promise<Status> {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const timeoutMs = options.timeoutMs ?? PAIRING_STATUS_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? PAIRING_STATUS_INTERVAL_MS;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let lastStatus: Status | undefined;
  while (now() < deadline) {
    const candidate = await readStatus();
    lastStatus = record(candidate);
    if (lastStatus && predicate(lastStatus)) return lastStatus;
    await sleep(intervalMs);
  }
  throw new RunnerFailure("gateway.connection", `Timed out waiting for extension pairing state during ${stage}`, {
    details: {
      pairingStage: stage,
      timeoutMs,
      waitedMs: now() - startedAt,
      lastStatus: safeStatus(lastStatus, now()),
    },
  });
}

/** Selects only the pairing wait's closed diagnostic projection for a run-bundle event. */
export function pairingStatusWaitFailureDetails(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!(error instanceof RunnerFailure) || error.category !== "gateway.connection") return undefined;
  const details = error.details;
  if (
    (details?.pairingStage !== "pre-approval" && details?.pairingStage !== "post-approval")
    || !finiteNumber(details.timeoutMs)
    || !finiteNumber(details.waitedMs)
    || !safeStatusShape(details.lastStatus)
  ) return undefined;
  return {
    pairingStage: details.pairingStage,
    timeoutMs: details.timeoutMs,
    waitedMs: details.waitedMs,
    lastStatus: details.lastStatus,
  };
}

function safeStatus(status: Status | undefined, now: number): Readonly<Record<string, unknown>> {
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

function record(value: unknown): Status | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Status : undefined;
}

function safeStatusShape(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  return Object.keys(status).length === 5
    && typeof status.connectionState === "string"
    && (status.connectionState === "unreported" || CONNECTION_STATES.has(status.connectionState))
    && typeof status.hasPairingReferenceCode === "boolean"
    && typeof status.hasSessionId === "boolean"
    && (status.queueSize === null || finiteNonNegativeInteger(status.queueSize))
    && (status.msSinceLastMessage === null || (finiteNumber(status.msSinceLastMessage) && status.msSinceLastMessage >= 0));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteNonNegativeInteger(value: unknown): value is number {
  return finiteNumber(value) && Number.isInteger(value) && value >= 0;
}
