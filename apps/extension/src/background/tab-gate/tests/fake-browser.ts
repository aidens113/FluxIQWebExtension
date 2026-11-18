// Test support for the tab gate's coverage: a browser with a few tabs, one of
// them FluxIQ's own panel, that records every call made to it. Calls that
// reach a page or act on a tab are kept apart from reads, so a test can say
// "refused before anything reached the tab" by checking the first list alone.
//
// Written as plain object literals: the structure audit keeps `.tabs` property
// reads out of the extension's source outside the gate, tests included.

import { configureOwnPages } from "../own-pages";

/** The panel and gateway addresses the fake configures as FluxIQ's own pages. */
export const PANEL_ORIGIN = "http://127.0.0.1:3000";
export const GATEWAY_URL = "ws://127.0.0.1:4777/client";

/** The panel's tab, on its keys page, and an ordinary shop tab. */
export const PANEL_TAB = { id: 7, url: `${PANEL_ORIGIN}/security/keys`, title: "Keys - FluxIQ", windowId: 1, active: true, status: "complete" };
export const SHOP_TAB = { id: 41, url: "https://shop.example/catalog", title: "Catalog", windowId: 1, active: false, status: "complete" };

export type FakeTab = { id: number; url?: string; pendingUrl?: string; title?: string; windowId?: number; active?: boolean; status?: string };

/** One call that reached a page or acted on a tab: the API, the tab and what was sent. */
export type ReachingCall = { api: string; tabId: number | undefined; detail?: unknown };

export type FakeBrowser = {
  /** Sends, injections, captures and tab acts, in order. */
  readonly reaching: ReachingCall[];
  /** `tabs.get` and `tabs.query`, in order. */
  readonly reads: string[];
  uninstall(): void;
};

/** What the content script answers: ready to a ping, an ordinary page to a robot-check question, success to anything else. */
function contentReply(message: unknown): unknown {
  const type = (message as { type?: string }).type;
  if (type === "fluxiq.ping") return { ok: true, active: true, version: 2 };
  if (type === "fluxiq.pageChallenge") return { challenge: null };
  if (type === "fluxiq.pageChanges") return { instance: "frame-0", changes: 0 };
  if (type === "fluxiq.evaluateFacts") return { answers: [{ result: "true", capturedAt: 1 }], document: { url: "frame-0", readyState: "complete" } };
  return { commandId: "c-frame", actionType: "web.dom.click", status: "succeeded", message: "Element clicked.", validation: { status: "passed", expected: "x", actual: "x" }, startedAt: 1, finishedAt: 2 };
}

const noEvent = { addListener: () => undefined, removeListener: () => undefined };

/** Installs the fake as `globalThis.chrome`, with the panel and gateway configured as FluxIQ's own pages. */
/**
 * `receive` stands for the document a message lands in, in place of the
 * default content reply; `duringScript` runs while an injection runs, so a test
 * can move the tab under it.
 */
export type FakeBrowserOptions = {
  readonly receive?: (message: unknown, tabId: number, frameId: number | undefined) => Promise<unknown>;
  readonly duringScript?: (move: (tabId: number, url: string) => void) => void;
};

export function installFakeBrowser(tabs: FakeTab[] = [PANEL_TAB, SHOP_TAB], options: FakeBrowserOptions = {}): FakeBrowser {
  configureOwnPages(() => [PANEL_ORIGIN, GATEWAY_URL]);
  const reaching: ReachingCall[] = [];
  const reads: string[] = [];
  const open = new Map(tabs.map((tab) => [tab.id, { ...tab }]));
  const runtime: { lastError?: { message: string } } = {};
  const find = (tabId: number): FakeTab => {
    const tab = open.get(tabId);
    if (tab === undefined) throw new Error(`No tab with id: ${tabId}.`);
    return tab;
  };
  let nextId = 100;
  (globalThis as { chrome?: unknown }).chrome = {
    runtime,
    tabs: {
      get: (tabId: number, callback?: (tab: FakeTab) => void) => {
        reads.push(`get ${tabId}`);
        if (callback) {
          callback(find(tabId));
          return undefined;
        }
        try {
          return Promise.resolve({ ...find(tabId) });
        } catch (error) {
          return Promise.reject(error);
        }
      },
      query: (info: { active?: boolean; windowId?: number }) => {
        reads.push("query");
        return Promise.resolve([...open.values()].filter((tab) => (info.active === undefined || tab.active === info.active) && (info.windowId === undefined || tab.windowId === info.windowId)));
      },
      sendMessage: (tabId: number, message: unknown, third?: unknown, fourth?: unknown) => {
        const callback = (typeof third === "function" ? third : fourth) as (response: unknown) => void;
        reaching.push({ api: "tabs.sendMessage", tabId, detail: message });
        const frameId = typeof third === "object" && third !== null ? (third as { frameId?: number }).frameId : undefined;
        if (options.receive) void options.receive(message, tabId, frameId).then(callback);
        else callback(contentReply(message));
      },
      update: (tabId: number, properties: { url?: string; active?: boolean }) => {
        reaching.push({ api: "tabs.update", tabId, detail: properties });
        const tab = find(tabId);
        if (properties.url !== undefined) tab.url = properties.url;
        if (properties.active === true) for (const other of open.values()) other.active = other.id === tabId;
        return Promise.resolve({ ...tab });
      },
      reload: (tabId: number) => {
        reaching.push({ api: "tabs.reload", tabId });
        return Promise.resolve();
      },
      goBack: (tabId: number) => {
        reaching.push({ api: "tabs.goBack", tabId });
        return Promise.resolve();
      },
      remove: (tabId: number) => {
        reaching.push({ api: "tabs.remove", tabId });
        open.delete(tabId);
        return Promise.resolve();
      },
      create: (properties: { url?: string; active?: boolean }) => {
        const tab: FakeTab = { id: nextId++, windowId: 1, status: "complete", active: properties.active ?? true, ...(properties.url === undefined ? {} : { url: properties.url }) };
        reaching.push({ api: "tabs.create", tabId: tab.id, detail: properties });
        open.set(tab.id, tab);
        return Promise.resolve({ ...tab });
      },
      captureVisibleTab: (windowId: number) => {
        reaching.push({ api: "tabs.captureVisibleTab", tabId: undefined, detail: windowId });
        return Promise.resolve("data:image/png;base64,");
      },
      onUpdated: noEvent,
      onActivated: noEvent,
      onRemoved: noEvent,
      onReplaced: noEvent
    },
    scripting: {
      executeScript: (injection: { target: { tabId: number }; args?: unknown[]; func?: { name?: string } }) => {
        reaching.push({ api: "scripting.executeScript", tabId: injection.target.tabId, detail: injection.target });
        options.duringScript?.((tabId, url) => {
          find(tabId).url = url;
        });
        // The page-work read carries arguments and is told the page is settled; the served-status read is told 200.
        const result = injection.args !== undefined ? true : injection.func?.name === "readServedStatus" ? 200 : null;
        return Promise.resolve([{ frameId: 0, result }]);
      }
    },
    webNavigation: {
      getAllFrames: (details: { tabId: number }, callback: (frames: unknown[]) => void) => {
        const tab = open.get(details.tabId);
        callback(tab === undefined ? [] : [{ frameId: 0, parentFrameId: -1, url: tab.url ?? "", documentId: `doc-${details.tabId}` }]);
      },
      onBeforeNavigate: noEvent,
      onCommitted: noEvent,
      onCompleted: noEvent,
      onErrorOccurred: noEvent,
      onHistoryStateUpdated: noEvent,
      onReferenceFragmentUpdated: noEvent
    }
  };
  return {
    reaching,
    reads,
    uninstall: () => {
      delete (globalThis as { chrome?: unknown }).chrome;
    }
  };
}
