// Whether a FluxIQ answers at the configured web address, read before this browser is paired so the first setup
// step can say where it found FluxIQ the moment it is true instead of waiting for Connect. A FluxIQ counts only
// when its discovery document is a valid one that names the address it was fetched from (Core's own reader), so
// any other page that answers 200 is not FluxIQ. It asks only while the browser is disconnected, again on a beat
// (FluxIQ may start or stop meanwhile), and never blocks anything: an unanswered or failed probe is "not found".
// The address asked is always the configured one; the built-in default is only the first value it holds.

import { FLUXIQ_CONNECT_PATHS, parseFluxIQDiscoveryDocument } from "@fluxiq/contracts/platform";
import { DEFAULT_CORE_API_URL } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import type { DiscoveryAnswer } from "./answer";
import type { ServerFinding } from "./finding";

/** How often an unreachable or reachable-but-unconnected FluxIQ is asked again. */
export const REACHABILITY_BEAT_MS = 5000;
const PROBE_TIMEOUT_MS = 3000;

/** Asks the FluxIQ at `webAddress` for its discovery document; never throws. */
export type ReachabilityProbe = (webAddress: string) => Promise<DiscoveryAnswer>;

/** The page's timers, so a test drives them without a browser. */
export type ReachabilityHost = {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** The running reader. */
export type ReachabilityReader = {
  /** What was found at the configured address; `undefined` before an answer or when not asked. */
  current(): ServerFinding | undefined;
  /** Tells it the status; call on every status. */
  observe(status: ExtensionStatus | undefined): void;
};

/** The discovery document request every FluxIQ answers, with no credentials and a short wait. */
export const discoveryProbe: ReachabilityProbe = async (webAddress) => {
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const origin = new URL(webAddress).origin;
    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(new URL(FLUXIQ_CONNECT_PATHS.discovery, origin).href, { method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal });
    if (response.status !== 200) return { found: false };
    const parsed = parseFluxIQDiscoveryDocument(await response.json(), origin);
    return parsed.success ? { found: true, gatewayUrl: parsed.data.gatewayUrl } : { found: false };
  } catch {
    return { found: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** The web address to ask for `status`: the configured one, or the built-in first guess when none is saved yet. */
function askedAddress(status: ExtensionStatus | undefined): string | undefined {
  if (status?.connectionState !== "disconnected" || status.settings === undefined) return undefined;
  return status.settings.coreApiUrl.trim() || DEFAULT_CORE_API_URL;
}

/** `changed` is called after the answer changes. */
export function createReachabilityReader(probe: ReachabilityProbe, host: ReachabilityHost, changed: () => void): ReachabilityReader {
  let answer: ServerFinding | undefined;
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
    let found: DiscoveryAnswer = { found: false };
    try { found = await probe(asked); } catch { found = { found: false }; }
    if (mine !== sequence || asked !== address) return;
    const next = findingOf(asked, found);
    const moved = answer === undefined || answer.found !== next.found || answer.origin !== next.origin || answer.gatewayUrl !== next.gatewayUrl;
    answer = next;
    host.clearTimeout(timer);
    timer = host.setTimeout(() => void read(), REACHABILITY_BEAT_MS);
    if (moved) changed();
  }

  return {
    current: () => answer,
    observe(status) {
      const next = askedAddress(status);
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

function findingOf(asked: string, answer: DiscoveryAnswer): ServerFinding {
  try {
    const url = new URL(asked);
    return { origin: url.origin, host: url.host, ...(answer.found ? { found: true, gatewayUrl: answer.gatewayUrl } : { found: false }) };
  } catch {
    return { origin: asked, host: asked, found: false };
  }
}
