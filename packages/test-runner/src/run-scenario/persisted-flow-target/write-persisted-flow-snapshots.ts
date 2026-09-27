import type { EvidenceBundle } from "@fluxiq-web-extension/test-evidence";
import type { ExistingFlowExecution } from "../../existing-flow-run.js";

/**
 * What a persisted Flow's run leaves in the bundle: Core's own run detail, the
 * durable actions it recorded, and the events it emitted.
 *
 * The three files are what `lab inspect` and the bench read back to say what the
 * Flow did, so they are written as one step under fixed names. Both replay lanes
 * write the same three; only the lane-specific snapshot beside them (the remote
 * Flow's identity, or the clone package and its import) differs.
 */
export async function writePersistedFlowSnapshots(bundle: EvidenceBundle, execution: ExistingFlowExecution): Promise<void> {
  await bundle.writeStructured("snapshots/runtime-run.json", execution.detail);
  await bundle.writeStructured("snapshots/runtime-actions.json", execution.actions);
  await bundle.writeStructured("snapshots/runtime-events.json", execution.events);
}
