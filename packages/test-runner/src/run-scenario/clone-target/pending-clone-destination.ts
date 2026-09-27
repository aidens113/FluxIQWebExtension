import { sha256 } from "@fluxiq-web-extension/test-evidence";
import type { CloneTargetConfiguration } from "../../target-config.js";

/**
 * The destination ids a clone package is first addressed at, before the isolated
 * Core that will host it exists.
 *
 * The real destination project cannot be created until an authenticated isolated
 * Core is running, and the real ids are derived from the source's content hash
 * once it is -- but the export has to produce a complete, hashable, cacheable
 * package before any of that. So it is addressed at these, and re-addressed once
 * the destination is real.
 *
 * The suffix is a hash of this run's id and the source's project and Flow, which
 * gives two properties the caller depends on: the same run exporting the same
 * source derives the same ids, so the export cache hits; and no two runs, and no
 * two sources within a run, can derive the same ids, so one run's pending package
 * can never be mistaken for another's. The parts are joined with a NUL, which no
 * id may contain, so no combination of ids can be spelled two ways.
 */
export function pendingCloneDestination(runId: string, source: Pick<CloneTargetConfiguration["source"], "projectId" | "flowId">): { projectId: string; flowId: string } {
  const suffix = sha256(`${runId}\0${source.projectId}\0${source.flowId}`).slice(0, 24);
  return { projectId: `project.clone.pending.${suffix}`, flowId: `flow.clone.pending.${suffix}` };
}
