import { RunnerFailure } from "../../../failure.js";

/** Read the mounted chat's authorized project scope before the creation message is sent. */
export async function assertCreationProjectReady(
  projectId: string,
  readChatScope: () => Promise<unknown>,
): Promise<void> {
  const status = await readChatScope();
  const scope = status !== null && typeof status === "object" ? status as Record<string, unknown> : {};
  if (scope.projectId !== projectId || scope.scopeState !== "ready" || scope.composerAvailable !== true || scope.composerEnabled !== true) {
    throw new RunnerFailure("gateway.connection", "The mounted chat is not ready in the independent creation project");
  }
}
