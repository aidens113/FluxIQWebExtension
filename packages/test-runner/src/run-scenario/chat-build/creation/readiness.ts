import { RunnerFailure } from "../../../failure.js";

/** Read the paired extension's public status before the creation message is sent. */
export async function assertCreationProjectReady(
  projectId: string,
  waitForStatus: (matches: (status: unknown) => boolean) => Promise<unknown>,
): Promise<void> {
  const matches = (status: unknown): boolean => status !== null && typeof status === "object"
    && (status as { projectId?: unknown }).projectId === projectId;
  const status = await waitForStatus(matches);
  if (!matches(status)) throw new RunnerFailure("gateway.connection", "The extension is not ready in the independent creation project");
}
