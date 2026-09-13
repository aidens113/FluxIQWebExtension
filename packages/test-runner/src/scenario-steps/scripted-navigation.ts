import type { Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const CLEANUP_TIMEOUT_MS = 5_000;
const MAX_URL_LENGTH = 2_048;
const MAX_PATH_LENGTH = 1_024;
const INTENT_ID = /^[A-Za-z0-9._-]{1,128}$/u;
const FAILURE_CODES = new Set([
  "invalid_request", "forbidden", "not_recording", "no_automation_tab", "busy",
  "expired", "cancelled", "recording_stopped", "tab_closed",
  "destination_mismatch", "send_failed", "unknown_intent",
]);

type Timer = ReturnType<typeof setTimeout>;
type SetTimer = (callback: () => void, delayMs: number) => Timer;
type ClearTimer = (timer: Timer) => void;
type DriverDependencies = { now?: () => number; setTimer?: SetTimer; clearTimer?: ClearTimer; cleanupTimeoutMs?: number };
type RuntimeMessage = { type: string; url?: string; intentId?: string };

/** Creates a scripted-navigation driver bound to the trusted extension control page. */
export function createScriptedNavigationDriver(extensionControlPage: Page, dependencies: DriverDependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  const cleanupTimeoutMs = dependencies.cleanupTimeoutMs ?? CLEANUP_TIMEOUT_MS;

  return async (scenarioPage: Page, requestedUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> => {
    const url = safeNavigationUrl(requestedUrl);
    const deadline = now() + timeoutMs;
    let intentId: string | undefined;
    let primaryFailure: unknown;
    try {
      const armPromise = send(extensionControlPage, { type: "fluxiq.test.armScriptedNavigation", url });
      let armResponse: unknown;
      try {
        armResponse = await beforeDeadline(armPromise, deadline, now, setTimer, clearTimer, "The extension did not arm scripted navigation in time");
      } catch (error) {
        if (isDeadlineFailure(error)) void cancelLateArm(armPromise, extensionControlPage, cleanupTimeoutMs, setTimer, clearTimer);
        throw asArmFailure(error);
      }
      intentId = requireArmResponse(armResponse);

      const remaining = remainingMs(deadline, now, "The fixture page did not complete scripted navigation in time", "runtime.behavior");
      try { await scenarioPage.goto(url, { waitUntil: "load", timeout: remaining }); }
      catch { throw new RunnerFailure("runtime.behavior", "The fixture page did not complete scripted navigation"); }

      let acknowledgement: unknown;
      try {
        acknowledgement = await beforeDeadline(
          send(extensionControlPage, { type: "fluxiq.test.awaitScriptedNavigation", intentId }),
          deadline, now, setTimer, clearTimer,
          "The extension did not acknowledge scripted navigation recording in time",
        );
      } catch (error) {
        if (isDeadlineFailure(error)) throw new RunnerFailure("recording.persistence", error.message);
        throw new RunnerFailure("extension.worker", "The extension could not acknowledge scripted navigation recording");
      }
      requireAcknowledgement(acknowledgement, intentId);
    } catch (error) {
      primaryFailure = error;
    } finally {
      if (intentId) {
        try { await cancel(extensionControlPage, intentId, cleanupTimeoutMs, setTimer, clearTimer); }
        catch { if (primaryFailure === undefined) primaryFailure = new RunnerFailure("extension.worker", "The extension did not confirm scripted navigation cleanup"); }
      }
    }
    if (primaryFailure !== undefined) throw primaryFailure;
  };
}

function safeNavigationUrl(value: string): string {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) throw invalidDestination();
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw invalidDestination(); }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || !["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname)
    || parsed.username || parsed.password || parsed.search || parsed.hash
    || parsed.pathname.length > MAX_PATH_LENGTH) throw invalidDestination();
  return `${parsed.origin}${parsed.pathname}`;
}

function invalidDestination(): RunnerFailure {
  return new RunnerFailure("fixture.invalid", "Scripted navigation requires a safe loopback destination");
}

async function send(page: Page, message: RuntimeMessage): Promise<unknown> {
  return page.evaluate(async (request) => {
    const extensionGlobal = globalThis as typeof globalThis & { chrome: { runtime: { sendMessage(value: RuntimeMessage): Promise<unknown> } } };
    return extensionGlobal.chrome.runtime.sendMessage(request);
  }, message);
}

function requireArmResponse(response: unknown): string {
  if (isFailureResponse(response)) throw new RunnerFailure("extension.worker", "The extension refused to arm scripted navigation", { details: { reasonCode: response.code } });
  if (!isRecord(response) || !hasExactOwnKeys(response, ["ok", "intentId"])
    || response.ok !== true || typeof response.intentId !== "string" || !INTENT_ID.test(response.intentId)) {
    throw new RunnerFailure("extension.worker", "The extension returned an invalid scripted navigation arm response");
  }
  return response.intentId;
}

function requireAcknowledgement(response: unknown, intentId: string): void {
  if (isFailureResponse(response)) throw new RunnerFailure("recording.persistence", "The extension did not record scripted navigation", { details: { reasonCode: response.code } });
  if (!isRecord(response) || !hasExactOwnKeys(response, ["ok", "intentId"])
    || response.ok !== true || response.intentId !== intentId) {
    throw new RunnerFailure("extension.worker", "The extension returned an invalid scripted navigation acknowledgement");
  }
}

async function cancel(page: Page, intentId: string, timeoutMs: number, setTimer: SetTimer, clearTimer: ClearTimer): Promise<void> {
  const response = await within(send(page, { type: "fluxiq.test.cancelScriptedNavigation", intentId }), timeoutMs, setTimer, clearTimer);
  if (!isRecord(response) || !hasExactOwnKeys(response, ["ok", "cancelled"])
    || response.ok !== true || typeof response.cancelled !== "boolean") throw new Error("cleanup response invalid");
}

async function cancelLateArm(arm: Promise<unknown>, page: Page, timeoutMs: number, setTimer: SetTimer, clearTimer: ClearTimer): Promise<void> {
  try {
    const response = await arm;
    if (isRecord(response) && response.ok === true && typeof response.intentId === "string" && INTENT_ID.test(response.intentId)) {
      await cancel(page, response.intentId, timeoutMs, setTimer, clearTimer);
    }
  } catch { /* The original arm timeout remains authoritative. */ }
}

async function beforeDeadline<T>(promise: Promise<T>, deadline: number, now: () => number, setTimer: SetTimer, clearTimer: ClearTimer, message: string): Promise<T> {
  void promise.catch(() => undefined);
  const remaining = deadline - now();
  if (remaining <= 0) throw new DeadlineFailure(message);
  return within(promise, remaining, setTimer, clearTimer, message);
}

async function within<T>(promise: Promise<T>, timeoutMs: number, setTimer: SetTimer, clearTimer: ClearTimer, message = "Operation did not finish in time"): Promise<T> {
  let timer: Timer | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimer(() => reject(new DeadlineFailure(message)), timeoutMs); });
  promise.catch(() => undefined);
  try { return await Promise.race([promise, timeout]); }
  finally { if (timer !== undefined) clearTimer(timer); }
}

function remainingMs(deadline: number, now: () => number, message: string, category: "extension.worker" | "runtime.behavior"): number {
  const remaining = deadline - now();
  if (remaining <= 0) throw new RunnerFailure(category, message);
  return remaining;
}

class DeadlineFailure extends Error {}
function isDeadlineFailure(error: unknown): error is DeadlineFailure { return error instanceof DeadlineFailure; }
function asArmFailure(error: unknown): RunnerFailure {
  return isDeadlineFailure(error) ? new RunnerFailure("extension.worker", error.message) : new RunnerFailure("extension.worker", "The extension could not arm scripted navigation");
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isFailureResponse(value: unknown): value is { ok: false; code: string } {
  return isRecord(value) && hasExactOwnKeys(value, ["ok", "code"])
    && value.ok === false && typeof value.code === "string" && FAILURE_CODES.has(value.code);
}
function hasExactOwnKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
