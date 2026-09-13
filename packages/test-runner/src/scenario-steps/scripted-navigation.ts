import type { BrowserContext, CDPSession, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DETACH_TIMEOUT_MS = 5_000;

type TimerHandle = ReturnType<typeof setTimeout>;
type ScriptedNavigationOptions = {
  timeoutMs?: number;
  setTimer?: (callback: () => void, timeoutMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};
type NavigationPhase = "session" | "setup" | "command" | "load";
type LifecycleEvent = { frameId: string; loaderId: string; name: string };

/**
 * Navigates a Chromium scenario tab as an address-bar (`typed`) transition and
 * waits for the new main-frame document identified by the CDP command.
 */
export async function runScriptedNavigation(
  context: BrowserContext,
  page: Page,
  url: string,
  options: ScriptedNavigationOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let phase: NavigationPhase = "session";
  let deadlineFailure: RunnerFailure | undefined;
  let rejectDeadline!: (error: RunnerFailure) => void;
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  const timer = setTimer(() => {
    deadlineFailure = timeoutFailure(phase, timeoutMs);
    rejectDeadline(deadlineFailure);
  }, timeoutMs);

  let acquisition: Promise<CDPSession>;
  try {
    acquisition = context.newCDPSession(page);
  } catch (cause) {
    clearTimer(timer);
    throw new RunnerFailure("environment.missing", "Scripted navigation requires a Chromium CDP session", { cause });
  }
  void acquisition.catch(() => undefined);

  let session: CDPSession;
  try {
    session = await Promise.race([acquisition, deadline]);
  } catch (cause) {
    clearTimer(timer);
    if (cause === deadlineFailure) {
      void acquisition
        .then(late => detachWithinBound(late, setTimer, clearTimer))
        .catch(() => undefined);
      throw cause;
    }
    throw new RunnerFailure("environment.missing", "Scripted navigation requires a Chromium CDP session", { cause });
  }

  phase = "setup";
  let expected: { frameId: string; loaderId: string } | undefined;
  const loadedDocuments = new Set<string>();
  let resolveLoad!: () => void;
  const loaded = new Promise<void>((resolve) => { resolveLoad = resolve; });
  const lifecycle = (event: LifecycleEvent): void => {
    if (event.name !== "load") return;
    loadedDocuments.add(documentKey(event.frameId, event.loaderId));
    if (expected && matchesDocument(event, expected)) resolveLoad();
  };
  session.on("Page.lifecycleEvent", lifecycle);

  let failed = false;
  const operation = (async () => {
    try {
      await session.send("Page.enable");
      await session.send("Page.setLifecycleEventsEnabled", { enabled: true });
    } catch (cause) {
      throw new RunnerFailure("runtime.behavior", "Chromium rejected scripted navigation setup", { cause });
    }

    phase = "command";
    let result: { frameId: string; loaderId?: string; errorText?: string };
    try {
      result = await session.send("Page.navigate", { url, transitionType: "typed" });
    } catch (cause) {
      throw new RunnerFailure("runtime.behavior", "Chromium rejected the scripted navigation command", { cause });
    }
    if (typeof result.errorText === "string" && result.errorText.length > 0) {
      throw new RunnerFailure("runtime.behavior", "Chromium could not navigate the scripted scenario page", {
        details: { reasonCode: "scripted_navigation.rejected" },
      });
    }
    if (!result.loaderId) {
      throw new RunnerFailure("runtime.behavior", "Scripted navigation did not create a new document", {
        details: { reasonCode: "scripted_navigation.no_new_document" },
      });
    }

    expected = { frameId: result.frameId, loaderId: result.loaderId };
    if (loadedDocuments.has(documentKey(expected.frameId, expected.loaderId))) resolveLoad();
    phase = "load";
    await loaded;
  })();
  // A timeout can win while a CDP command remains pending. Detaching the
  // session then rejects that command; observe it without replacing timeout.
  void operation.catch(() => undefined);

  try {
    await Promise.race([operation, deadline]);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    clearTimer(timer);
    session.off("Page.lifecycleEvent", lifecycle);
    try {
      await detachWithinBound(session, setTimer, clearTimer);
    } catch (cause) {
      if (!failed) throw cause;
    }
  }
}

async function detachWithinBound(
  session: CDPSession,
  setTimer: (callback: () => void, timeoutMs: number) => TimerHandle,
  clearTimer: (handle: TimerHandle) => void,
): Promise<void> {
  let cleanupFailure: RunnerFailure | undefined;
  let rejectDeadline!: (error: RunnerFailure) => void;
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  const timer = setTimer(() => {
    cleanupFailure = new RunnerFailure("environment.missing", "Chromium CDP session cleanup did not finish in time", {
      details: { timeoutMs: DETACH_TIMEOUT_MS },
    });
    rejectDeadline(cleanupFailure);
  }, DETACH_TIMEOUT_MS);
  let detach: Promise<void>;
  try {
    detach = session.detach();
  } catch (cause) {
    clearTimer(timer);
    throw new RunnerFailure("environment.missing", "Chromium CDP session cleanup failed", { cause });
  }
  void detach.catch(() => undefined);
  try {
    await Promise.race([detach, deadline]);
  } catch (cause) {
    if (cause === cleanupFailure) throw cause;
    throw new RunnerFailure("environment.missing", "Chromium CDP session cleanup failed", { cause });
  } finally {
    clearTimer(timer);
  }
}

function documentKey(frameId: string, loaderId: string): string {
  return `${frameId}\u0000${loaderId}`;
}

function matchesDocument(event: LifecycleEvent, expected: { frameId: string; loaderId: string }): boolean {
  return event.frameId === expected.frameId && event.loaderId === expected.loaderId;
}

function timeoutFailure(phase: NavigationPhase, timeoutMs: number): RunnerFailure {
  const message = phase === "load"
    ? "The scripted scenario page did not finish loading"
    : phase === "command"
      ? "Chromium scripted navigation command did not finish in time"
      : phase === "setup"
        ? "Chromium scripted navigation setup did not finish in time"
        : "Chromium CDP session acquisition did not finish in time";
  return new RunnerFailure("runtime.behavior", message, { details: { timeoutMs } });
}
