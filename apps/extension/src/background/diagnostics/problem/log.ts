// The recent failures a problem report attaches.
//
// Kept in the extension's local storage rather than in the worker, because the
// report people most need is the one after something went wrong enough to
// restart the worker or the browser. Bounded to the last
// `MAXIMUM_PROBLEM_LOG_ENTRIES`, and each message is redacted as it is written
// (`redactDiagnosticText`), so nothing unredacted is ever stored to be leaked by
// a later reader. A repeat of the entry just before it is not stored again: a
// socket that fails every thirty seconds would otherwise push every other
// failure out.

import type { ProblemLogEntry } from "../../../shared/protocol";
import { redactDiagnosticText } from "../diagnostic-redaction";

export const MAXIMUM_PROBLEM_LOG_ENTRIES = 30;
export const PROBLEM_LOG_STORAGE_KEY = "fluxiq.problemLog";

/** Where the log is kept. Local storage in the extension; a fake in tests. */
export type ProblemLogStore = {
  readonly read: () => Promise<unknown>;
  readonly write: (entries: ProblemLogEntry[]) => Promise<void>;
};

export type ProblemLogInput = {
  source: ProblemLogEntry["source"];
  message: string;
  commandId?: string | undefined;
  runId?: string | undefined;
};

export class ProblemLog {
  // Writes are chained so two failures noted at once do not both read the old
  // list and the second write lose the first entry.
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ProblemLogStore = localProblemLogStore(),
    private readonly literals: () => readonly (string | undefined)[] = () => [],
    private readonly now: () => number = Date.now
  ) {}

  /** Notes one failure. Never throws: a log that cannot be written must not become a second failure. */
  note(input: ProblemLogInput): Promise<void> {
    const entry: ProblemLogEntry = { at: this.now(), source: input.source, message: redactDiagnosticText(input.message, this.literals()) };
    if (input.commandId) entry.commandId = input.commandId;
    if (input.runId) entry.runId = input.runId;
    this.pending = this.pending
      .then(async () => {
        const entries = await this.recent();
        const last = entries.at(-1);
        if (last && last.source === entry.source && last.message === entry.message && last.commandId === entry.commandId) return;
        await this.store.write([...entries, entry].slice(-MAXIMUM_PROBLEM_LOG_ENTRIES));
      })
      .catch(/* best-effort: a failed log write must not fail the operation that noted it */ () => undefined);
    return this.pending;
  }

  /** The stored entries, oldest first. Anything stored that is not a well-formed entry is dropped; a failed read throws. */
  async recent(): Promise<ProblemLogEntry[]> {
    const stored = await this.store.read();
    return Array.isArray(stored) ? stored.filter(isProblemLogEntry).slice(-MAXIMUM_PROBLEM_LOG_ENTRIES) : [];
  }
}

export function localProblemLogStore(): ProblemLogStore {
  return {
    read: async () => (await chrome.storage.local.get(PROBLEM_LOG_STORAGE_KEY))[PROBLEM_LOG_STORAGE_KEY],
    write: async (entries) => {
      await chrome.storage.local.set({ [PROBLEM_LOG_STORAGE_KEY]: entries });
    }
  };
}

const SOURCES: ReadonlySet<string> = new Set<ProblemLogEntry["source"]>(["connection", "action", "saved-state", "message", "reconnect"]);

function isProblemLogEntry(value: unknown): value is ProblemLogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.at === "number"
    && typeof entry.source === "string" && SOURCES.has(entry.source)
    && typeof entry.message === "string"
    && (entry.commandId === undefined || typeof entry.commandId === "string")
    && (entry.runId === undefined || typeof entry.runId === "string");
}
