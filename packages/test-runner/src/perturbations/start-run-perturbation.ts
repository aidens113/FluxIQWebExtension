// One run's perturbation from start to report: what the Lab calls, at the two
// seams where a run opens the extension and connects it to Core.
//
// 1. Before the browser launches, `startRunPerturbation` starts whatever sits
//    between the extension and Core and hands back the topology the run then
//    uses: for `drop-action-result`, the same topology with `gatewayUrl` set to
//    the relay, so the browser's containment, the network guard and the
//    extension's `fluxiq.connect` all name the relay and nothing else changes.
// 2. Once the browser, its network guard and the extension's control page are
//    up, `armBrowser` arms what acts inside the browser (`stop-service-worker`)
//    and gives the session the readers it uses after the fault: the
//    extension's status and Core's gateway snapshot, each read at fixed delays
//    after the fault fired and screened before it is kept.
// 3. `close` stops the relay or disarms the stop and answers the report the
//    run writes as `snapshots/perturbation.json`.

import type { BrowserContext, Page } from "@playwright/test";
import { startDropActionResultRelay, type DropActionResultRelay } from "./drop-action-result-relay.js";
import { PerturbationLog, type PerturbationReport } from "./perturbation-log.js";
import type { RunPerturbation } from "./run-perturbation.js";
import { screenExtensionStatus } from "./screen-extension-status.js";
import { screenGatewaySnapshot } from "./screen-gateway-snapshot.js";
import { armServiceWorkerStop } from "./stop-service-worker.js";

/** How the session reads the two sides after the fault. Either may be absent, and the observation then says so. */
export type AfterFaultReaders = { extension?: () => Promise<unknown>; core?: () => Promise<unknown> };

export type PerturbationBrowser = {
  context: BrowserContext;
  /** The extension's control page: its CDP session closes the worker, and the extension status is read from it. */
  cdpPage: Page;
  scenarioOrigins: readonly string[];
  readers: AfterFaultReaders;
};

export type RunPerturbationSession = {
  readonly perturbation: RunPerturbation;
  armBrowser(browser: PerturbationBrowser): Promise<void>;
  /** Whether the fault has fired yet. */
  fired(): boolean;
  /** The record so far. */
  report(): PerturbationReport;
  /** Disarms, stops the relay, waits for any observation already being read, and answers the final record. */
  close(): Promise<PerturbationReport>;
};

/** After the fault, the two sides are read this long after it, so the record shows both the immediate and the settled answer. */
const AFTER_FAULT_DELAYS_MS: readonly number[] = [2_000, 10_000];
/** Core's audit entries kept from this long before the fault, so the dispatch that preceded it is in the record. */
const AUDIT_LOOKBACK_MS = 5_000;

export type StartRunPerturbationOptions = { afterFaultDelaysMs?: readonly number[]; now?: () => number };

/** Starts the perturbation's network half and answers the session and the topology the run uses from here on. */
export async function startRunPerturbation<T extends { gatewayUrl?: string }>(perturbation: RunPerturbation, topology: T, options: StartRunPerturbationOptions = {}): Promise<{ session: RunPerturbationSession; topology: T }> {
  const log = new PerturbationLog(perturbation, options.now);
  const delays = options.afterFaultDelaysMs ?? AFTER_FAULT_DELAYS_MS;
  let relay: DropActionResultRelay | undefined;
  let nextTopology = topology;
  if (perturbation.kind === "drop-action-result") {
    if (!topology.gatewayUrl) throw new Error("A drop-action-result perturbation needs the run's gateway URL");
    relay = await startDropActionResultRelay({ gatewayUrl: topology.gatewayUrl, afterCommittingActs: perturbation.afterCommittingActs, log });
    nextTopology = { ...topology, gatewayUrl: relay.url };
  }
  let disarm: (() => Promise<void>) | undefined;
  const timers = new Set<NodeJS.Timeout>();
  const reading = new Set<Promise<void>>();
  let closed = false;

  const observeAt = (afterMs: number, firedAtMs: number, readers: AfterFaultReaders): void => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      const read = (async () => {
        const [extension, core] = await Promise.all([
          readScreened(readers.extension, screenExtensionStatus),
          readScreened(readers.core, value => screenGatewaySnapshot(value, firedAtMs - AUDIT_LOOKBACK_MS)),
        ]);
        log.observe({ afterMs, at: new Date().toISOString(), extension, core });
      })();
      reading.add(read);
      void read.finally(() => reading.delete(read));
    }, Math.max(0, firedAtMs + afterMs - Date.now()));
    timers.add(timer);
  };

  const session: RunPerturbationSession = {
    perturbation,
    async armBrowser(browser) {
      if (perturbation.kind === "stop-service-worker") {
        const armed = await armServiceWorkerStop({ context: browser.context, cdpPage: browser.cdpPage, scenarioOrigins: browser.scenarioOrigins, onSiteRequest: perturbation.onSiteRequest, log });
        disarm = armed.disarm;
      }
      log.onFired(event => { if (!closed) for (const afterMs of delays) observeAt(afterMs, event.atMs, browser.readers); });
    },
    fired: () => log.firedAtMs() !== undefined,
    report: () => log.report(),
    async close() {
      if (closed) return log.report();
      closed = true;
      for (const timer of timers) { clearTimeout(timer); log.record("observation.skipped", { reason: "the run closed first" }); }
      timers.clear();
      await Promise.all([...reading]);
      await disarm?.();
      await relay?.close();
      if (log.firedAtMs() === undefined) log.record("fault.not-fired", {});
      return log.report();
    },
  };
  return { session, topology: nextTopology };
}

async function readScreened(reader: (() => Promise<unknown>) | undefined, screen: (value: unknown) => unknown): Promise<unknown> {
  if (!reader) return { unreadable: "no reader for this side in this harness" };
  try { return screen(await reader()); } catch (error) { return { unreadable: error instanceof Error ? error.message.split("\n")[0]!.slice(0, 300) : String(error).slice(0, 300) }; }
}
