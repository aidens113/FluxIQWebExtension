// Connecting without being asked: when the browser starts and when the panel
// opens, a browser FluxIQ has approved before reconnects by itself, so the
// person does not have to press Connect every morning.
//
// Only when all of these hold: a pairing token is stored, "Reconnect
// automatically" is on, the connection is down (disconnected, or failed and no
// longer retrying), and the person has not pressed Disconnect since they last
// pressed Connect. The last one matters: without it, opening the panel after
// choosing to disconnect would undo the choice.
//
// That choice is remembered in the browser's session storage, not in this
// worker: a Manifest V3 worker is stopped after half a minute idle, and a
// memory that went with it would forget the Disconnect the next time the panel
// opened. Session storage outlives the worker and is cleared when the browser
// closes, which is exactly when connecting on browser start should resume.

import type { ConnectionState } from "../../shared/protocol";

export type AutoConnectState = {
  readonly paired: boolean;
  readonly autoReconnect: boolean;
  readonly connectionState: ConnectionState;
};

/** Where "the person pressed Disconnect" is kept between worker restarts. */
export type DisconnectMemory = {
  readonly read: () => Promise<boolean>;
  readonly write: (disconnectedByPerson: boolean) => Promise<void>;
};

const DOWN_STATES: ReadonlySet<ConnectionState> = new Set(["disconnected", "error"]);

export function shouldAutoConnect(state: AutoConnectState, disconnectedByPerson: boolean): boolean {
  return state.paired && state.autoReconnect && !disconnectedByPerson && DOWN_STATES.has(state.connectionState);
}

/** A memory that lives as long as the worker: for a browser without session storage, and for tests. */
export function workerDisconnectMemory(): DisconnectMemory {
  let value = false;
  return {
    read: async () => value,
    write: async (next) => { value = next; }
  };
}

export class AutoConnect {
  constructor(
    private readonly connect: () => Promise<void>,
    private readonly memory: DisconnectMemory = workerDisconnectMemory()
  ) {}

  /** The person pressed Disconnect (or forgot the pairing): stay down until they press Connect. */
  noteDisconnectedByPerson(): Promise<void> {
    return this.memory.write(true);
  }

  /** The person pressed Connect: automatic reconnection may resume. */
  noteConnectedByPerson(): Promise<void> {
    return this.memory.write(false);
  }

  /** Connects when `shouldAutoConnect` says so. A failed connection is the connection's own to report, so it is not rethrown. */
  async maybeConnect(state: AutoConnectState): Promise<boolean> {
    if (!shouldAutoConnect(state, await this.memory.read())) return false;
    await this.connect().catch(/* best-effort: the connection reports its own failure in the status */ () => undefined);
    return true;
  }
}
