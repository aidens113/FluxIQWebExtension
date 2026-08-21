export type SnapshotRunRequest = {
  label?: string;
  captureActiveSnapshot(label: string): Promise<void>;
};

export async function runSnapshotCapture(request: SnapshotRunRequest): Promise<void> {
  await request.captureActiveSnapshot(request.label ?? "Snapshot captured");
}
