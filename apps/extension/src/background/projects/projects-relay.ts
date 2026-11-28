// The panel's project messages: list the projects this browser may use and
// choose which one every call without its own project uses. Projects are made in
// the FluxIQ panel, or by the first message (Core's `first-project`).
//
// Core's automation-studio `projects` is called through
// the same program-call path as every other relay. What this side adds is the
// choice: written to Core (`shareChoice`, I5) and kept in the worker (`ProjectContext`)
// and in `chrome.storage.local` as the offline fallback. A choice for a project that no longer exists is dropped when
// the projects are listed, and the browser follows Core's project again.
//
// A paired token sees `id`, `name` and `updatedAt` of each project and nothing
// about who owns it; this module passes on exactly those three.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelProjectSummary, PanelRelayResponse } from "../../shared/protocol";
import { relayFailure } from "../panel/relay-failure";
import type { ProjectChoice } from "./choice-storage";

type ProjectMessage = { readonly type?: string; readonly [key: string]: unknown };

/** What the project messages reach: Core, and the worker's project choice. */
export type ProjectsRelayContext = {
  readonly call: (endpoint: string, payload: Record<string, unknown>) => Promise<PanelRelayResponse>;
  readonly chosenProject: () => string | undefined;
  readonly choose: (choice: ProjectChoice | null) => Promise<void>;
  readonly noteName: (projectId: string, name: string) => void;
  /** Writes the chosen project to Core so every client agrees. Absent: the choice stays in this browser. */
  readonly shareChoice?: (projectId: string) => Promise<PanelRelayResponse>;
};

export const PROJECT_MESSAGES: readonly string[] = [
  RUNTIME_MESSAGES.panelListProjects,
  RUNTIME_MESSAGES.panelSelectProject
];

/** Answers one project message; undefined for any other type. */
export async function relayProjects(message: ProjectMessage, context: ProjectsRelayContext): Promise<unknown> {
  if (message.type === RUNTIME_MESSAGES.panelListProjects) return list(context);
  if (message.type === RUNTIME_MESSAGES.panelSelectProject) return select(message, context);
  return undefined;
}

async function listed(context: ProjectsRelayContext): Promise<{ ok: true; projects: PanelProjectSummary[] } | Extract<PanelRelayResponse, { ok: false }>> {
  const reply = await context.call("projects", {});
  if (!reply.ok) return reply;
  const projects = (reply.payload as { projects?: unknown } | null)?.projects;
  return { ok: true, projects: (Array.isArray(projects) ? projects : []).flatMap((item) => summary(item) ?? []) };
}

async function list(context: ProjectsRelayContext): Promise<unknown> {
  const result = await listed(context);
  if (!result.ok) return result;
  for (const project of result.projects) context.noteName(project.id, project.name);
  let selected = context.chosenProject();
  if (selected !== undefined && !result.projects.some((project) => project.id === selected)) {
    // The chosen project is gone: follow Core's again.
    await context.choose(null);
    selected = undefined;
  }
  return { ok: true, projects: result.projects, selectedProjectId: selected ?? null };
}

async function select(message: ProjectMessage, context: ProjectsRelayContext): Promise<unknown> {
  if (message.projectId === null) {
    await context.choose(null);
    return { ok: true };
  }
  const projectId = typeof message.projectId === "string" ? message.projectId.trim() : "";
  if (!projectId) return relayFailure("invalid_request", "Say which project to use, or null to follow FluxIQ.");
  const result = await listed(context);
  if (!result.ok) return result;
  const project = result.projects.find((candidate) => candidate.id === projectId);
  if (!project) return relayFailure("invalid_request", "FluxIQ has no such project.");
  // Core is told first: a client bound to another project is refused with a sentence, and the choice is then not made.
  // A Core that cannot be reached leaves the browser's own copy as the choice until it can.
  const shared = await context.shareChoice?.(projectId);
  if (shared && !shared.ok && shared.code !== "unreachable" && shared.code !== "timed_out" && shared.code !== "not_paired") return shared;
  await context.choose({ projectId, name: project.name });
  return { ok: true };
}

function summary(value: unknown): PanelProjectSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { id, name, updatedAt } = value as { id?: unknown; name?: unknown; updatedAt?: unknown };
  if (typeof id !== "string" || !id) return undefined;
  // Core sends epoch milliseconds; the panel's summary carries an ISO time.
  const when = typeof updatedAt === "number" && Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : typeof updatedAt === "string" ? updatedAt : undefined;
  return { id, name: typeof name === "string" && name ? name : id, ...(when === undefined ? {} : { updatedAt: when }) };
}
