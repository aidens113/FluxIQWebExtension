import type { PlatformHookPayloads } from "fluxiq/platform/panel";

export const DEFAULT_PROJECT_NAME = "My automations";

/**
 * `workspace.created`: gives the new workspace the project the chat opens
 * into. Idempotent by name within the workspace's own instance (a personal
 * workspace has one owner). Errors propagate; Core isolates and logs them.
 */
export async function seedDefaultProject(payload: PlatformHookPayloads["workspace.created"]): Promise<void> {
  const studio = payload.fluxiq.programs.automationStudio;
  const { projects } = await studio.listProjects();
  if (projects.some((project) => project.name === DEFAULT_PROJECT_NAME)) return;
  await studio.createProject({ name: DEFAULT_PROJECT_NAME });
}
