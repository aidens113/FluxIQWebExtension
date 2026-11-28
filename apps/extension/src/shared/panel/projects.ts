// The panel's project messages (`background/projects/`).

/** One project as the panel lists it: what a paired token may see, no owners. */
export type PanelProjectSummary = { id: string; name: string; updatedAt?: string };

/** `panelListProjects` answers this; `selectedProjectId` null means the browser follows Core's project. */
export type PanelListProjectsReply = { ok: true; projects: PanelProjectSummary[]; selectedProjectId: string | null };

/** `panelSelectProject` request; null follows Core's project. */
export type PanelSelectProjectRequest = { projectId: string | null };

/** Pushed from the worker to the panel when Core's gateway reports work in a project or conversation. */
export type PanelChangesMessage = { type: "fluxiq.panel.changes"; projectId: string | null; conversationIds?: string[]; at: number };
