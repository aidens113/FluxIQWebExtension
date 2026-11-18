// Whether FluxIQ answers at the web address, read before this browser is paired so the first
// setup step can say "FluxIQ is running" the moment it is true instead of waiting for Connect.
// It asks only while the browser is disconnected, again on a beat (FluxIQ may start or stop
// meanwhile), and never blocks anything: an unanswered or failed probe is `false`.

import { FLUXIQ_CONNECT_PATHS } from "@fluxiq/contracts/platform";
import type { ExtensionStatus } from "../../../shared/protocol";

/** How often an unreachable or reachable-but-unconnected FluxIQ is asked again. */
export const REACHABILITY_BEAT_MS = 5000;
const PROBE_TIMEOUT_MS = 3000;

/** Asks the FluxIQ at `webAddress` whether it answers; never throws. */
export type ReachabilityProbe = (webAddress: string) => Promise<boolean>;

/** The page's timers, so a test drives them without a browser. */
export type ReachabilityHost = {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** The running reader. */
export type ReachabilityReader = {
  /** `true` once FluxIQ answered; `false` when it did not; `undefined` before an answer or when not asked. */
  current(): boolean | undefined;
  /** Tells it the status; call on every status. */
  observe(status: ExtensionStatus | undefined): void;
};

/** The discovery document request every FluxIQ answers, with no credentials and a short wait. */
export const discoveryProbe: ReachabilityProbe = async (webAddress) => {
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = new URL(FLUXIQ_CONNECT_PATHS.discovery, webAddress).href;
    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(url, { method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** `changed` is called after the answer changes. */
export function createReachabilityReader(probe: ReachabilityProbe, host: ReachabilityHost, changed: () => void): ReachabilityReader {
  let answer: boolean | undefined;
  let address: string | undefined;
  let timer: unknown;
  let sequence = 0;

  function stop(): void {
    sequence += 1;
    host.clearTimeout(timer);
    timer = undefined;
  }

  async function read(): Promise<void> {
    if (address === undefined) return;
    const mine = ++sequence;
    const asked = address;
    let next = false;
    try { next = await probe(asked); } catch { next = false; }
    if (mine !== sequence || asked !== address) return;
    const moved = next !== answer;
    answer = next;
    host.clearTimeout(timer);
    timer = host.setTimeout(() => void read(), REACHABILITY_BEAT_MS);
    if (moved) changed();
  }

  return {
    current: () => answer,
    observe(status) {
      const next = status?.connectionState === "disconnected" ? status.settings?.coreApiUrl : undefined;
      if (next === address) return;
      address = next;
      stop();
      if (next === undefined) {
        const moved = answer !== undefined;
        answer = undefined;
        if (moved) changed();
        return;
      }
      void read();
    }
  };
}
