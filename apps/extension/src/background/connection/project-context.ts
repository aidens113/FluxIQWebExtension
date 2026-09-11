// Which FluxIQ project the current recording belongs to. A recording can start
// before Core has linked one, so this resolves lazily and remembers what it
// learns for the rest of the session.

import type { ActivityEntry, FluxIQSession, FluxIQSettings } from "../../shared/protocol";
import { fetchProjectIdFromCoreSnapshot } from "./core-api";

export type ProjectContextDeps = {
  readonly settings: () => FluxIQSettings;
  readonly session: () => FluxIQSession;
  // Records a newly discovered project on the session and persists it.
  readonly adoptProjectId: (projectId: string) => Promise<void>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
};

export class ProjectContext {
  // null is meaningful: Core accepted the recording and told us it has no
  // project, which is different from not yet knowing.
  private activeRecordingProjectId: string | null | undefined;

  constructor(private readonly deps: ProjectContextDeps) {}

  activeRecordingProject(): string | null | undefined {
    return this.activeRecordingProjectId;
  }

  setActiveRecordingProject(projectId: string | null | undefined): void {
    this.activeRecordingProjectId = projectId;
  }

  current(): string | undefined {
    const value = this.activeRecordingProjectId ?? this.deps.session().projectId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  async resolve(reason: string): Promise<string | undefined> {
    const current = this.current();
    if (current) return current;
    const hydrated = await this.hydrateFromCoreSnapshot(reason);
    return hydrated ?? this.current();
  }

  private async hydrateFromCoreSnapshot(reason: string): Promise<string | undefined> {
    const session = this.deps.session();
    const token = session.token;
    if (!token) return undefined;
    try {
      const projectId = await fetchProjectIdFromCoreSnapshot(
        { coreApiUrl: this.deps.settings().coreApiUrl, token },
        { sessionId: session.sessionId, clientId: session.clientId },
        reason
      );
      if (!projectId) return undefined;
      this.activeRecordingProjectId ??= projectId;
      await this.deps.adoptProjectId(projectId);
      this.deps.onActivity("recording", "Project context linked", projectId, "success");
      return projectId;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project context lookup failed.";
      this.deps.onActivity("recording", "Project context unavailable", message, "warning");
      return undefined;
    }
  }
}
