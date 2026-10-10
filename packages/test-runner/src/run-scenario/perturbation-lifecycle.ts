import type { BrowserContext, Page } from "@playwright/test";
import type { RunningTopology } from "../coordinator.js";
import { startRunPerturbation, type RunPerturbation } from "../perturbations/index.js";
import { extensionStatus } from "../run-lifecycle/index.js";

/** Where the run's browser stands when the perturbation is armed: the network guard installed and the extension's control page open. */
export type PerturbationArming = { context: BrowserContext; controlPage: Page; scenarioOrigins: readonly string[] };

/**
 * One run's perturbation (`perturbations/`) across the run's own lifecycle:
 * `topology` is what the browser launches against, `arm` runs once the
 * control page is open, and `writeRecord` runs before the browser closes,
 * while the after-fault readers still have that page.
 */
export type PerturbationLifecycle = {
  topology: RunningTopology;
  arm(browser: PerturbationArming): Promise<void>;
  /** Closes the perturbation and writes `snapshots/perturbation.json`. Best-effort: the record may not fail a run whose verdict is already decided. */
  writeRecord(bundle: { writeStructured(relativePath: string, value: unknown): Promise<unknown> }): Promise<void>;
};

/**
 * Starts the run's perturbation before the browser launches, so the browser's
 * containment and the extension's gateway name its relay. Without one, the
 * topology is returned as it came and arming and writing do nothing: the run
 * is unchanged.
 */
export async function startPerturbationLifecycle(perturbation: RunPerturbation | undefined, topology: RunningTopology): Promise<PerturbationLifecycle> {
  if (!perturbation) return { topology, arm: async () => undefined, writeRecord: async () => undefined };
  const started = await startRunPerturbation(perturbation, topology);
  const control = started.topology.control;
  return {
    topology: started.topology,
    arm: browser => started.session.armBrowser({
      context: browser.context,
      cdpPage: browser.controlPage,
      scenarioOrigins: browser.scenarioOrigins,
      readers: { extension: () => extensionStatus(browser.controlPage), ...(control ? { core: () => control.gatewaySnapshot() } : {}) },
    }),
    writeRecord: async bundle => {
      await started.session.close().then(report => bundle.writeStructured("snapshots/perturbation.json", report)).catch(/* best-effort: the perturbation's record may not fail a run whose verdict is already decided */ () => undefined);
    },
  };
}
