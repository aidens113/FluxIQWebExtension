// Keeping a dropped connection coming back when the worker holding it is gone.
//
// `GatewaySession` retries with a backoff timer, and a timer lives in the
// Manifest V3 service worker, which Chrome stops after about thirty seconds with
// no extension event. FluxIQ restarting, a laptop waking, a network that drops
// for longer than that: the worker is stopped mid-backoff, the timer goes with
// it, and nothing reconnects until some unrelated event happens to wake the
// worker. That was the open "nothing reconnects" half of PANEL-007.
//
// The watchdog holds a browser alarm while the connection should be up and is
// not: paired, "Reconnect automatically" on, not disconnected by the person,
// and not connected (or waiting on a pairing approval, which only a person can
// give). An alarm outlives the worker and wakes it; the worker's start-up path
// (`background/index.ts`) then reconnects a paired browser, and a live worker
// retries at once (`FluxIQConnection.retryConnection`). The alarm is cleared the
// moment the connection is back, so a healthy connection costs nothing.
//
// `chrome.alarms` needs the `alarms` permission. Without it -- or in a browser
// without the API -- the watchdog does nothing and the backoff timer alone
// remains, which is exactly the behaviour before it.

import type { ConnectionState } from "../shared/protocol";

export const RECONNECT_ALARM_NAME = "fluxiq.reconnect";
/** Chrome 120 and later honour thirty seconds; earlier versions round it up to a minute. */
export const RECONNECT_ALARM_PERIOD_MINUTES = 0.5;

export type ReconnectWatchState = {
  readonly paired: boolean;
  readonly autoReconnect: boolean;
  readonly disconnectedByPerson: boolean;
  readonly connectionState: ConnectionState;
};

/** The two `chrome.alarms` calls the watchdog makes. */
export type ReconnectAlarms = {
  readonly create: (name: string, info: { periodInMinutes: number; delayInMinutes: number }) => unknown;
  readonly clear: (name: string) => unknown;
};

/** States in which a connection is up, or waiting on something only a person can do. */
const SETTLED_STATES: ReadonlySet<ConnectionState> = new Set(["connected", "pairing"]);

export function wantsReconnectAlarm(state: ReconnectWatchState): boolean {
  return state.paired && state.autoReconnect && !state.disconnectedByPerson && !SETTLED_STATES.has(state.connectionState);
}

export class ReconnectWatchdog {
  // Unknown at start: a worker that was stopped may have left the alarm set, so
  // the first sync always says what it wants rather than assuming it is clear.
  private armed: boolean | undefined;

  constructor(private readonly alarms: ReconnectAlarms | undefined) {}

  sync(state: ReconnectWatchState): void {
    if (!this.alarms) return;
    const want = wantsReconnectAlarm(state);
    if (want === this.armed) return;
    this.armed = want;
    try {
      const settled = want
        ? this.alarms.create(RECONNECT_ALARM_NAME, { periodInMinutes: RECONNECT_ALARM_PERIOD_MINUTES, delayInMinutes: RECONNECT_ALARM_PERIOD_MINUTES })
        : this.alarms.clear(RECONNECT_ALARM_NAME);
      void Promise.resolve(settled).catch((error: unknown) => {
        // The backoff timer still retries; forget what was asked so the next sync asks again.
        this.armed = undefined;
        console.warn("FluxIQ reconnect alarm could not be changed", error instanceof Error ? error.message : error);
      });
    } catch {
      // A browser that refuses the alarm leaves the backoff timer in charge.
      this.armed = undefined;
    }
  }
}

/** `chrome.alarms` when this build may use it, otherwise nothing. */
export function browserReconnectAlarms(): ReconnectAlarms | undefined {
  const alarms = (globalThis as { chrome?: { alarms?: typeof chrome.alarms } }).chrome?.alarms;
  if (!alarms?.create || !alarms.clear) return undefined;
  return {
    create: (name, info) => alarms.create(name, info),
    clear: (name) => alarms.clear(name)
  };
}
