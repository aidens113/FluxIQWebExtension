// The extension is told the run's own Core before its first page opens (t968).
//
// The Lab's control page is the extension's side panel (`../extension-control-page.ts`).
// While the extension is not yet paired, the panel's getting-started step asks
// its configured web address whether a FluxIQ answers there
// (`apps/extension/src/panel/getting-started/reachability/reader.ts`), and a
// fresh profile's configured address is the product default,
// `http://127.0.0.1:3000`. The run's network guard rightly refuses that
// address: no one runs a Core there for the run. So since the reader landed
// (2026-11-16), every `lab run`, saved-Flow replay and recovery-matrix case
// ended before its Flow with `Deterministic browser network policy blocked 1
// unexpected destination(s): request:http://127.0.0.1:3000/.well-known/fluxiq`
// (t968, matrix cases 1 and 14). The guard is not loosened to an address no one
// runs. The run tells the extension its own addresses, as the chat check
// already does (`../../extension-chat-check/preconfigure-extension.ts`): the
// settings are written through the extension's worker, the worker is stopped so
// its successor builds its connection from them, and a page of the run's own
// Scenario Lab is loaded to start that successor (a page load is what starts a
// stopped MV3 worker; an extension page would be the panel, which probes).
// Pairing then connects to the same addresses, as before.

import type { BrowserContext } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { preconfigureExtensionWhenReady } from "../../extension-chat-check/preconfigure-extension.js";
import { stopExtensionWorkers } from "../../extension-chat-check/stop-extension-workers.js";

/**
 * Writes the run's Core and gateway addresses into the extension and restarts
 * its worker on them. A topology with no gateway of its own (an existing
 * installation the run attaches to) is left as it is configured.
 */
export async function preconfigureRunExtension(context: BrowserContext, topology: Pick<RunningTopology, "fluxiqOrigin" | "gatewayUrl" | "scenarioOrigin">): Promise<void> {
  if (!topology.gatewayUrl) return;
  const page = await context.newPage();
  try {
    await preconfigureExtensionWhenReady(
      () => context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://")),
      { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin },
      {
        stop: () => stopExtensionWorkers(context, page),
        wake: async () => { await page.goto(`${topology.scenarioOrigin}/`, { waitUntil: "domcontentloaded" }); }
      }
    );
  } finally {
    await page.close().catch(/* best-effort: the page only woke the worker, and the run opens its own */ () => undefined);
  }
}
