// What the panel remembers about a recording it started, so the recording can be
// attached to the next message once it has ended, even when the panel closed in
// between (Firefox closes its popup on every click in the page, and a recording
// carries on without it). Kept per viewer in `chrome.storage.local`; a viewer
// convenience only: every read and write is wrapped, and a panel whose storage
// fails simply attaches nothing by itself, the + beside the box still works.

/** The words the person gave, the recordings that existed before, and when it began. */
export type PendingRecording = { readonly description: string; readonly known: readonly string[]; readonly at: number };

export const PENDING_RECORDING_KEY = "fluxiq.ui.pendingRecording";

/** A remembered recording older than this is no longer waited for. */
export const PENDING_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** A stored value that is a whole pending recording, or undefined. */
export function parsePendingRecording(value: unknown, now: number): PendingRecording | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.description !== "string" || record.description === "" || typeof record.at !== "number") return undefined;
  if (!Array.isArray(record.known) || !record.known.every((id) => typeof id === "string")) return undefined;
  if (now - record.at > PENDING_MAX_AGE_MS || record.at > now + 60_000) return undefined;
  return { description: record.description, known: record.known as string[], at: record.at };
}

/** The pending recording's storage. Nothing here throws or rejects. */
export type PendingRecordingStore = {
  read(): Promise<PendingRecording | undefined>;
  write(pending: PendingRecording): Promise<void>;
  clear(): Promise<void>;
};

/** The store over `chrome.storage.local`; `now` is the clock. */
export function createPendingRecordingStore(now: () => number = Date.now): PendingRecordingStore {
  const settled = (run: (done: () => void) => void): Promise<void> => new Promise((resolve) => {
    try {
      run(() => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
  return {
    read: () => new Promise((resolve) => {
      try {
        chrome.storage.local.get([PENDING_RECORDING_KEY], (items) => {
          resolve(chrome.runtime.lastError ? undefined : parsePendingRecording(items?.[PENDING_RECORDING_KEY], now()));
        });
      } catch {
        resolve(undefined);
      }
    }),
    write: (pending) => settled((done) => chrome.storage.local.set({ [PENDING_RECORDING_KEY]: pending }, done)),
    clear: () => settled((done) => chrome.storage.local.remove(PENDING_RECORDING_KEY, done))
  };
}
