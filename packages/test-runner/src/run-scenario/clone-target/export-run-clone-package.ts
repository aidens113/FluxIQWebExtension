import { sha256 } from "@fluxiq-web-extension/test-evidence";
import { canonicalClonePackageJson, type ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { WebPanelAuthSessionCache } from "../../auth-session.js";
import { ClonePackageCache } from "../../clone-cache.js";
import { exportClonePackage } from "../../clone-source-exporter.js";
import type { CloneTargetConfiguration } from "../../target-config.js";
import { pendingCloneDestination } from "./pending-clone-destination.js";

/** The source Flow this run will replay in isolation, and the hash the run manifest attests it by. */
export type ExportedRunClonePackage = { clonePackage: ClonePackage; clonePackageHash: string };

/**
 * Exports the configured source Flow into a clone package addressed at a
 * *pending* destination, before the isolated Core that will host it exists.
 *
 * The destination ids have to be decided twice, which is why they are "pending"
 * here: the export has to produce a complete, hashable package -- it is what the
 * compatibility verdict is computed from and what the cache is keyed on -- before
 * the isolated Core that will host it exists. `pendingCloneDestination` owns the
 * ids it is addressed at until then.
 *
 * It does not refuse an incompatible source. The caller records the package and
 * its hash first and refuses afterwards, so a run stopped by an unsafe
 * dependency still carries the package it read into its evidence and still has
 * its source verified unchanged during cleanup.
 */
export async function exportRunClonePackage(target: CloneTargetConfiguration, run: { runId: string; runsDirectory: string }): Promise<ExportedRunClonePackage> {
  const clonePackage = await exportClonePackage(target, {
    destination: pendingCloneDestination(run.runId, target.source),
    cache: new ClonePackageCache(run.runsDirectory),
    sessionCache: new WebPanelAuthSessionCache(run.runsDirectory),
  });
  return { clonePackage, clonePackageHash: sha256(canonicalClonePackageJson(clonePackage)) };
}
