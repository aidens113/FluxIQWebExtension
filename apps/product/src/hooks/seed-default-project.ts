import type { PlatformHookPayloads } from "fluxiq/platform/panel";
import { recordAutomationStudioCreatedProjectOwner, type AutomationStudioService } from "fluxiq/automation-studio";

export const DEFAULT_PROJECT_NAME = "My automations";

const seeding = new WeakMap<AutomationStudioService, Promise<void>>();

/**
 * `workspace.created`: gives the new workspace the project the chat opens
 * into, owned by its new user. Attempts run in order per service, each retaining
 * its own result. A retry repairs a partially assigned seed; a different creator
 * or ambiguous name is refused. Errors propagate; Core isolates and logs them.
 */
export async function seedDefaultProject(payload: PlatformHookPayloads["workspace.created"]): Promise<void> {
  if (typeof payload.ownerUserId !== "string" || payload.ownerUserId.trim().length === 0) throw new Error("A default project needs a workspace owner.");
  const studio = payload.fluxiq.programs.automationStudio;
  const pending = (seeding.get(studio) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const { projects } = await studio.listProjects();
    const matching = projects.filter((project) => project.name === DEFAULT_PROJECT_NAME);
    if (matching.length > 1) throw new Error("The workspace has more than one default project with the same name.");
    const project = matching[0] ?? await studio.createProject({ name: DEFAULT_PROJECT_NAME });
    await recordAutomationStudioCreatedProjectOwner(studio, project.id, payload.ownerUserId);
  });
  seeding.set(studio, pending);
  try {
    await pending;
  } finally {
    if (seeding.get(studio) === pending) seeding.delete(studio);
  }
}
