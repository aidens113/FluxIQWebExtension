// Core's refusal of a `client.focus_project` (`project-focus.ts`): a
// `server.error` whose code starts `project_focus.` (Core's
// `CLIENT_GATEWAY_PROJECT_FOCUS_REFUSAL_CODES`: `invalid`, `not_paired`,
// `refused`, `unavailable`). It is about the project, never the connection: the
// session stays ready and on its earlier project, so the caller must not treat
// it as a failed connection.

const PROJECT_FOCUS_CODE_PREFIX = "project_focus.";

/** A refused focus: Core's code, its words, and the project it was about when Core named one. */
export type ProjectFocusRefusal = { readonly code: string; readonly message: string; readonly projectId?: string };

/** The refusal a `server.error` payload carries, or undefined when it is about something else. */
export function projectFocusRefusal(payload: { message?: unknown; code?: unknown; metadata?: unknown } | null | undefined): ProjectFocusRefusal | undefined {
  const code = payload?.code;
  if (typeof code !== "string" || !code.startsWith(PROJECT_FOCUS_CODE_PREFIX)) return undefined;
  const message = typeof payload?.message === "string" ? payload.message : "FluxIQ did not move this browser to that project.";
  const projectId = (payload?.metadata as { projectId?: unknown } | null | undefined)?.projectId;
  return typeof projectId === "string" ? { code, message, projectId } : { code, message };
}
