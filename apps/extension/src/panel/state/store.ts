// The panel's one source of status.
//
// On creation the store asks the background once for its status and listens
// for every `statusChanged` push after that. A request whose reply carries a
// status (every connection and recording command answers with one) publishes
// that status too, so a view that sends Start recording sees the result without
// asking again.
// Status reads only publish while still current: a later read, push or command
// acknowledgement supersedes a delayed getStatus reply.
//
// While the status says the background is working on a connection
// (connecting, pairing, reconnecting), the store asks again every few seconds
// (`status-probe-ms.ts`). A Manifest V3 worker stopped mid-wait sends no push
// when it goes, so without asking the panel kept a dead approval code on screen
// for minutes (t707 P1). The ask itself starts a fresh worker, and its answer,
// or the lack of one, tells the store the wait was lost (`background-loss.ts`):
// `lost()` says so until the background is working on a connection again.
//
// Failures never touch the status. They come back to the view that made the
// request, as a sentence, and that view keeps showing it: a status render does
// not wipe it (audit defect F1, where a refused command flashed and vanished
// because the status re-render hid the error line in the same tick). A probe
// that gets no answer leaves the status too, and only marks the wait lost.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ConnectionState, ExtensionStatus } from "../../shared/protocol";
import { backgroundLoss, type BackgroundLoss } from "./background-loss";
import { panelRequest, type PanelMessage } from "./request";
import type { PanelResult } from "./result";
import { PANEL_STATUS_PROBE_MS } from "./status-probe-ms";

/** The panel's status, its changes, and its one way to send a message (pinned by the UI audit, section 5). */
export type PanelStore = {
  current(): ExtensionStatus | undefined;
  /** Calls `listener` with every status from now on, and at once when one is already known. Returns an unsubscribe. */
  subscribe(listener: (status: ExtensionStatus) => void): () => void;
  /** Sends `message`; never throws. A reply carrying a status also publishes it. */
  request<T>(message: PanelMessage): Promise<PanelResult<T>>;
};

/** What the store that `createPanelStore` makes adds for the shell, which created it. */
export type PanelStoreLoss = {
  /** The wait the background lost (its worker stopped mid-pairing or mid-connect), until it works on a connection again. */
  lost(): BackgroundLoss | undefined;
};

/** What a test replaces: the timer the status probe waits on. */
export type PanelStoreOptions = {
  readonly schedule?: (run: () => void, ms: number) => void;
};

/** States in which the background is working on a connection, so the panel keeps asking. */
const WAITING: ReadonlySet<ConnectionState> = new Set(["connecting", "pairing", "reconnecting"]);
const DOWN: ReadonlySet<ConnectionState> = new Set(["disconnected", "error"]);

/** Creates the store, asks for the current status, and starts listening for pushes. */
export function createPanelStore(options: PanelStoreOptions = {}): PanelStore & PanelStoreLoss {
  const schedule = options.schedule ?? probeTimer;
  let status: ExtensionStatus | undefined;
  let loss: BackgroundLoss | undefined;
  let probeDue = false;
  const listeners = new Set<(status: ExtensionStatus) => void>();
  let observations = 0;
  let readGeneration = 0;

  function notify(): void {
    if (status === undefined) return;
    const shown = status;
    for (const listener of [...listeners]) listener(shown);
  }

  /** Publishes `next`. A probe passes the loss it found; anything else keeps a loss only while the background stays down. */
  function publish(next: ExtensionStatus, probed?: { readonly loss: BackgroundLoss | undefined }): void {
    observations += 1;
    status = next;
    if (probed !== undefined) loss = probed.loss;
    else if (!DOWN.has(next.connectionState)) loss = undefined;
    notify();
    scheduleProbe();
  }

  function scheduleProbe(): void {
    if (probeDue || status === undefined || !WAITING.has(status.connectionState)) return;
    probeDue = true;
    schedule(() => {
      probeDue = false;
      void probe();
    }, PANEL_STATUS_PROBE_MS);
  }

  async function probe(): Promise<void> {
    const before = status;
    if (before === undefined || !WAITING.has(before.connectionState)) return;
    const generation = ++readGeneration;
    const observed = observations;
    const result = await panelRequest<{ status?: unknown }>({ type: RUNTIME_MESSAGES.getStatus });
    // A push, a command's reply or a later read arrived meanwhile: it is fresher than this answer.
    if (generation !== readGeneration || observed !== observations) return scheduleProbe();
    const carried = result.ok ? result.value?.status : undefined;
    if (isStatus(carried)) return publish(carried, { loss: backgroundLoss(before, carried) });
    const found = backgroundLoss(before, undefined);
    if (found !== loss) {
      loss = found;
      notify();
    }
    scheduleProbe();
  }

  chrome.runtime.onMessage.addListener((message: unknown) => {
    const typed = message as { type?: unknown; status?: unknown };
    if (typed?.type === RUNTIME_MESSAGES.statusChanged && isStatus(typed.status)) publish(typed.status);
  });

  const store: PanelStore & PanelStoreLoss = {
    current: () => status,
    lost: () => loss,
    subscribe(listener) {
      listeners.add(listener);
      if (status !== undefined) listener(status);
      return () => {
        listeners.delete(listener);
      };
    },
    async request<T>(message: PanelMessage): Promise<PanelResult<T>> {
      const isRead = message.type === RUNTIME_MESSAGES.getStatus;
      const generation = isRead ? ++readGeneration : readGeneration;
      const observed = observations;
      const result = await panelRequest<T>(message);
      if (result.ok) {
        const carried = (result.value as { status?: unknown } | undefined)?.status;
        if (isStatus(carried) && (!isRead || generation === readGeneration && observed === observations)) publish(carried);
      }
      return result;
    }
  };

  void store.request({ type: RUNTIME_MESSAGES.getStatus });
  return store;
}

/**
 * The probe's real timer. Where the host can (Node, under the unit tests) it
 * is unref'd, so a store left waiting never holds a process open; a browser's
 * timer has no `unref` and the panel page owns its own lifetime.
 */
function probeTimer(run: () => void, ms: number): void {
  const handle: unknown = globalThis.setTimeout(run, ms);
  (handle as { unref?: () => void } | undefined)?.unref?.();
}

function isStatus(value: unknown): value is ExtensionStatus {
  return typeof value === "object" && value !== null && typeof (value as { connectionState?: unknown }).connectionState === "string";
}
