// Test support for the runner's T1 coverage (`action-runner.test.ts`): the
// chrome API the runner drives, reduced to what one in-page action touches,
// with every call it makes recorded. Split out of that file when it passed its
// line budget (t885), so the cases stay beside their subject and the fake
// browser they all share stays in one place.

import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { runBrowserActionCommand } from "../action-runner";
import { keptLooks } from "../look-reuse";
import type { ListedFrame } from "../frame-address";

export const TAB_ID = 41;

/** What a `fluxiq.ping` must answer before `background/tabs.ts` calls a frame ready. */
const CONTENT_SCRIPT_VERSION = 2;

/** Chrome's own words when a message reaches a frame with no listener. */
export const CONNECTION_ERROR = "Could not establish connection. Receiving end does not exist.";

/** One `chrome.tabs.sendMessage` the runner made: the tab, the body, and the frame it addressed. */
export type SentToTab = { tabId: number; message: Record<string, unknown>; frameId: number | undefined };

/**
 * What the runner did to the browser. Readiness pings are kept apart from
 * actions: every child-frame action now pings the frame first, and a row about
 * where an action was delivered should not have to filter that out.
 */
export type ChromeCalls = { sent: SentToTab[]; pinged: number[]; injected: number[][]; timeline: Array<"wait" | "send">; challenged: number[] };

/** The content script's answer. Returned verbatim, so a test can tell the runner's own result from the frame's. */
export const FRAME_REPLY: BrowserActionResult = {
  commandId: "c-frame",
  actionType: "web.dom.click",
  status: "succeeded",
  message: "Element clicked.",
  validation: { status: "passed", expected: "the click lands on the target", actual: "it did" },
  startedAt: 1,
  finishedAt: 2
};

/**
 * The chrome API the runner drives, reduced to what one in-page action touches,
 * with every call recorded.
 *
 * `tabs.get` answers a tab with no URL, which is a shape the runner already has
 * a rule for: an unreadable URL means "judge the action by its own outcome", so
 * the page guard stands aside. It is also what makes `waitForTabReady` settle
 * at once -- its stability window compares the URL with the last one it saw,
 * and two unknowns are already stable -- so a routing test costs no wall clock.
 *
 * `frames` is what `webNavigation.getAllFrames` reports; `undefined` is the
 * browser declining to answer, which the runner reads as "unknown", not "none".
 *
 * `silent` names the frames with no FluxIQ content script listening -- what an
 * extension reload leaves behind, since the frames survive it and their scripts
 * do not. Injecting into one makes it answer, unless it is also `uninjectable`,
 * which is a frame whose origin the manifest does not cover.
 *
 * `refusals` are the errors successive action sends meet, in order; a send past
 * the list is answered. `timeline` puts each `waitForTabReady` among the sends.
 *
 * `landing` is where an action's send takes the tab: its top frame commits
 * there, served with that status, before the frame replies. Without it nothing
 * navigates, and a click returns once `click-landing.ts`'s start grace ends.
 *
 * `challenges` are what the top frame answers, in turn (the last for ever
 * after), when asked whether its page is a robot check; `challenged` records
 * the frame each such question went to.
 */
export function installChromeStub(
  frames: Array<number | ListedFrame> | undefined,
  silent: number[] = [],
  uninjectable: number[] = [],
  refusals: string[] = [],
  landing?: { status: number; url: string },
  challenges: unknown[] = [{ challenge: null }]
): ChromeCalls {
  // Every stub is a page of its own: no look kept from another test's stands on it.
  keptLooks.forget(undefined);
  const calls: ChromeCalls = { sent: [], pinged: [], injected: [], timeline: [], challenged: [] };
  const injectedInto = new Set<number>();
  const pendingRefusals = [...refusals];
  const runtime: { lastError?: { message: string } } = {};
  type NavigationListener = (details: Record<string, unknown>) => void;
  const navigation = { before: new Set<NavigationListener>(), committed: new Set<NavigationListener>(), error: new Set<NavigationListener>() };
  const navigationEvent = (listeners: Set<NavigationListener>) => ({
    addListener: (listener: NavigationListener) => void listeners.add(listener),
    removeListener: (listener: NavigationListener) => void listeners.delete(listener)
  });
  const stub = {
    runtime,
    tabs: {
      get: (tabId: number) => Promise.resolve({ id: tabId, status: "complete" }),
      onUpdated: { addListener: () => void calls.timeline.push("wait"), removeListener: () => undefined },
      sendMessage: (tabId: number, message: unknown, third?: unknown, fourth?: unknown) => {
        const options = typeof third === "object" && third !== null ? third as { frameId?: number } : undefined;
        const callback = (typeof third === "function" ? third : fourth) as ((response: unknown) => void) | undefined;
        const frameId = options?.frameId;
        if ((message as { type?: string }).type === "fluxiq.ping") {
          const target = frameId ?? 0;
          calls.pinged.push(target);
          if (silent.includes(target) && !injectedInto.has(target)) {
            runtime.lastError = { message: CONNECTION_ERROR };
            callback?.(undefined);
            delete runtime.lastError;
            return;
          }
          callback?.({ ok: true, active: true, version: CONTENT_SCRIPT_VERSION });
          return;
        }
        // A click's landing, and a look that carries the check allowance, ask
        // whether the page is a robot check (`click-landing.ts`, `look-check/`);
        // unless a row says otherwise, the page here is an ordinary one.
        if ((message as { type?: string }).type === "fluxiq.pageChallenge") {
          calls.challenged.push(frameId ?? 0);
          callback?.(challenges[Math.min(calls.challenged.length - 1, challenges.length - 1)]);
          return;
        }
        // A look first asks each frame whether the page moved since the last
        // one (`look-reuse/`): answered here, and not an action the page was sent.
        if ((message as { type?: string }).type === "fluxiq.pageChanges") {
          callback?.({ instance: `frame-${frameId ?? 0}`, changes: 0 });
          return;
        }
        calls.sent.push({ tabId, message: message as Record<string, unknown>, frameId });
        calls.timeline.push("send");
        if (landing !== undefined) {
          for (const listener of navigation.before) listener({ tabId, frameId: 0, url: landing.url });
          for (const listener of navigation.committed) listener({ tabId, frameId: 0, url: landing.url, documentId: "doc-landed" });
        }
        const refusal = pendingRefusals.shift();
        if (refusal !== undefined) {
          runtime.lastError = { message: refusal };
          callback?.(undefined);
          delete runtime.lastError;
          return;
        }
        callback?.(FRAME_REPLY);
      }
    },
    scripting: {
      executeScript: (details: { target: { tabId: number; frameIds?: number[] }; files?: string[]; func?: () => unknown }) => {
        // A `func` injection is click-landing reading the landed document's status.
        if (details.func !== undefined) return Promise.resolve([{ frameId: 0, result: landing?.status }]);
        const frameIds = details.target.frameIds ?? [];
        calls.injected.push([...frameIds]);
        if (frameIds.some((frameId) => uninjectable.includes(frameId))) {
          return Promise.reject(new Error("Cannot access contents of the page."));
        }
        for (const frameId of frameIds) injectedInto.add(frameId);
        return Promise.resolve([]);
      }
    },
    webNavigation: {
      // A bare number is a frame whose URL the row does not care about.
      getAllFrames: (_details: { tabId: number }, callback: (found: ListedFrame[] | undefined) => void) => {
        callback(frames?.map((frame) => (typeof frame === "number" ? { frameId: frame } : frame)));
      },
      onBeforeNavigate: navigationEvent(navigation.before),
      onCommitted: navigationEvent(navigation.committed),
      onErrorOccurred: navigationEvent(navigation.error)
    }
  };
  (globalThis as { chrome?: unknown }).chrome = stub;
  return calls;
}

/** Runs one in-page action against the stub and hands back the result and every browser call it made. */
export async function runAgainstStub(
  action: BrowserActionCommand,
  frames: Array<number | ListedFrame> | undefined,
  silent: number[] = [],
  uninjectable: number[] = []
): Promise<ChromeCalls & { run: Awaited<ReturnType<typeof runBrowserActionCommand>> }> {
  const calls = installChromeStub(frames, silent, uninjectable);
  try {
    const run = await runBrowserActionCommand({ action, attachTabForRecording: () => Promise.resolve() });
    return { run, ...calls };
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}
