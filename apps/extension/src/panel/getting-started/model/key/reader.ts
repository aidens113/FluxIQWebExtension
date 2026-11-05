// Keeps the model key reading fresh while the browser is connected. It reads once
// when the connection comes up, again on a short beat while the key is missing or
// locked (the person is adding or unlocking it in another tab), and again whenever
// the panel regains focus (`refresh`), and it stops beating the moment the key is ready. A
// failed read is `unknown` and is not retried on a beat: it says nothing, so
// nothing waits on it. A late answer from an earlier read never overwrites a newer
// one. Nothing here blocks anything: the reading only decides what is shown.

import type { ModelKeyReading } from "./reading";
import type { SetupPort } from "../../setup-port";

/** How often a missing or locked key is read again. */
export const KEY_BEAT_MS = 4000;

/** The page's timers, so a test drives them without a browser. */
export type KeyReaderHost = {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** The running reader. */
export type ModelKeyReader = {
  current(): ModelKeyReading;
  /** Tells it whether the browser is connected now; call on every status. */
  observe(connected: boolean): void;
  /** Reads again now (the panel regained focus); nothing while not connected. */
  refresh(): void;
};

/** `changed` is called after the reading changes. */
export function createModelKeyReader(port: SetupPort, host: KeyReaderHost, changed: () => void): ModelKeyReader {
  let reading: ModelKeyReading = "unknown";
  let connected = false;
  let timer: unknown;
  let sequence = 0;

  function schedule(): void {
    host.clearTimeout(timer);
    timer = undefined;
    if (!connected || (reading !== "missing" && reading !== "locked")) return;
    timer = host.setTimeout(() => {
      timer = undefined;
      void read();
    }, KEY_BEAT_MS);
  }

  async function read(): Promise<void> {
    if (!connected) return;
    const mine = ++sequence;
    let next: ModelKeyReading;
    try {
      next = await port.readModelKey();
    } catch {
      next = "unknown";
    }
    if (mine !== sequence || !connected) return;
    const moved = next !== reading;
    reading = next;
    schedule();
    if (moved) changed();
  }

  return {
    current: () => reading,
    refresh: () => void read(),
    observe(now) {
      if (now === connected) return;
      connected = now;
      sequence += 1;
      host.clearTimeout(timer);
      timer = undefined;
      if (now) {
        void read();
        return;
      }
      if (reading !== "unknown") {
        reading = "unknown";
        changed();
      }
    }
  };
}
