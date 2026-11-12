// The thread the chat last showed in this browser window, kept in
// `chrome.storage.session`: forgotten when the browser closes, and readable only
// by the extension's own pages, never by a page under test. One entry per
// window, because each window has its own side panel. A browser without session
// storage or windows (Firefox before 115) keeps nothing, and the chat opens as
// it would without a memory.

/** A thread the chat showed: Core's ids for it. */
export type RememberedThread = { readonly conversationId: string; readonly projectId: string };

/** This window's remembered thread. */
export type ThreadMemory = {
  /** The thread this window last showed, if any. Rejects when the browser cannot say. */
  recall(): Promise<RememberedThread | undefined>;
  /** Keeps `thread` as the one this window shows. Losing it only means the chat opens on its usual thread next time. */
  keep(thread: RememberedThread): void;
};

const KEY_PREFIX = "fluxiq.chatThread.";

type SessionBrowser = {
  storage?: { session?: chrome.storage.StorageArea };
  windows?: { getCurrent(): Promise<{ id?: number }> };
};

/** This window's memory in the browser's session storage. */
export function sessionThreadMemory(): ThreadMemory {
  const browser = (globalThis as { chrome?: SessionBrowser }).chrome;
  const area = browser?.storage?.session;
  const windows = browser?.windows;
  if (area === undefined || windows === undefined) {
    return { recall: async () => undefined, keep: () => undefined };
  }
  let key: Promise<string> | undefined;
  const keyOf = (): Promise<string> => {
    key ??= windows.getCurrent().then((window) => {
      if (typeof window.id !== "number") throw new Error("The browser did not say which window this panel is in.");
      return `${KEY_PREFIX}${window.id}`;
    });
    return key;
  };
  return {
    async recall() {
      const name = await keyOf();
      return rememberedThread((await area.get(name))[name]);
    },
    keep(thread) {
      void keyOf()
        .then((name) => area.set({ [name]: { conversationId: thread.conversationId, projectId: thread.projectId } }))
        .catch(/* best-effort: a lost memory only reopens the usual thread */ () => undefined);
    }
  };
}

function rememberedThread(value: unknown): RememberedThread | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const { conversationId, projectId } = value as { conversationId?: unknown; projectId?: unknown };
  if (typeof conversationId !== "string" || conversationId === "" || typeof projectId !== "string" || projectId === "") return undefined;
  return { conversationId, projectId };
}
