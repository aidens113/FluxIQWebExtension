import { runSnapshotCapture, type SnapshotRunRequest } from "./snapshot-runner";

/**
 * The current gateway protocol has capture-snapshot request/response events,
 * but no dedicated read-state command. Treat runtime state reads as structured
 * snapshot captures until the protocol grows `server.read_state`.
 */
export async function runStateReadViaSnapshot(request: SnapshotRunRequest): Promise<void> {
  await runSnapshotCapture({ ...request, label: request.label ?? "State snapshot captured" });
}
