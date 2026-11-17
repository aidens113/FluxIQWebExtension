import type { ProjectsPort, ProjectSummary } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelStore } from "../state";

/** Said when the worker answers a project read with something that is not a list. */
const UNREADABLE = "FluxIQ's projects could not be read. Try again.";

/**
 * The project switcher's port over the background: the list (`panelListProjects`) and New project
 * (`panelCreateProject`). A refusal rejects with the sentence the person reads, which the switcher shows.
 */
export function extensionProjectsPort(request: PanelStore["request"]): ProjectsPort {
  return {
    async list() {
      const result = await request<{ projects?: unknown }>({ type: RUNTIME_MESSAGES.panelListProjects });
      if (!result.ok) throw new Error(result.sentence);
      return summariesOf(result.value.projects);
    },
    async create(name) {
      const result = await request<{ project?: unknown }>({ type: RUNTIME_MESSAGES.panelCreateProject, name });
      if (!result.ok) throw new Error(result.sentence);
      const project = summaryOf(result.value.project);
      if (project === undefined) throw new Error(UNREADABLE);
      return project;
    }
  };
}

function summariesOf(value: unknown): ProjectSummary[] {
  if (!Array.isArray(value)) throw new Error(UNREADABLE);
  return value.flatMap((item) => summaryOf(item) ?? []);
}

function summaryOf(value: unknown): ProjectSummary | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { id, name, updatedAt } = value as { id?: unknown; name?: unknown; updatedAt?: unknown };
  if (typeof id !== "string" || id === "" || typeof name !== "string") return undefined;
  return { id, name, ...(typeof updatedAt === "string" ? { updatedAt } : {}) };
}
