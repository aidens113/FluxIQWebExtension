// Core telling this browser that the person who paired it can no longer read
// the session's project (`server.project_access_ended`, Core's
// `ClientGatewayProjectAccessEnded`): their access, membership or sharing was
// removed, they were disabled, or the project was deleted. Core checks that
// access before each `server.activity` it sends, so the project's live
// activity has stopped, and it has moved the session where a cleared choice
// (`client.focus_project` of null) would have: the pairing's project, or none.
// The browser drops a choice of that project and follows Core again
// (`ProjectContext.accessEnded`), and shows the person Core's reason.

const FALLBACK_REASON = "FluxIQ stopped this project's live activity because this browser's person can no longer open it.";

/** Which project's access ended, where Core moved the session (null: no project), and why, in Core's words. */
export type ProjectAccessEnded = { readonly projectId: string; readonly currentProjectId: string | null; readonly message: string };

/** The notice a `server.project_access_ended` payload carries, or undefined when it names no project. */
export function projectAccessEnded(payload: { projectId?: unknown; currentProjectId?: unknown; message?: unknown } | null | undefined): ProjectAccessEnded | undefined {
  const projectId = payload?.projectId;
  if (typeof projectId !== "string" || projectId.trim() === "") return undefined;
  const current = payload?.currentProjectId;
  const currentProjectId = typeof current === "string" && current.trim() !== "" ? current : null;
  const message = typeof payload?.message === "string" && payload.message.trim() !== "" ? payload.message : FALLBACK_REASON;
  return { projectId, currentProjectId, message };
}
