// Which FluxIQ project a recording, a snapshot or a panel read belongs to.
//
// Core owns the current project; the one stored in the extension session is
// only what Core last said. So, outside a recording, `resolve` asks Core's
// current context first and adopts its answer when it differs from the stored
// one; the stored project is used only when Core names none, cannot be asked
// (no pairing token) or does not answer in time. A recording keeps the project
// it was started under. A project the panel names explicitly never reaches
// here: its relays pass a named project through untouched.

import type { ActivityEntry, FluxIQSession, FluxIQSettings } from "../../shared/protocol";
import { fetchProjectIdFromCoreSnapshot } from "./core-api";

// A Core answer is reused this long, so a burst of reads (the panel opening,
// one snapshot per runtime step) asks Core once rather than once each.
export const CORE_PROJECT_CONTEXT_REUSE_MS = 1_000;
// How long a read waits for Core before it goes on with the stored project.
// The lookup itself is left to finish, and is adopted when it does. Kept under
// the recording start's own lookup bound (active-recording.ts), so a slow Core
// starts a recording under the stored project rather than under none.
export const CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS = 1_000;

export type ProjectContextDeps = {
  readonly settings: () => FluxIQSettings;
  readonly session: () => FluxIQSession;
  // Records a project Core named on the session and persists it.
  readonly adoptProjectId: (projectId: string) => Promise<void>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly now?: () => number;
  readonly lookupBoundMs?: number;
};

type CoreLookup = {
  readonly startedAt: number;
  readonly answer: Promise<string | undefined>;
  settledAt?: number;
};

export class ProjectContext {
  // Set only by the recording's owner. undefined: no recording, or one with no
  // project yet. null is meaningful: Core accepted the recording and told us it
  // has no project, which is different from not yet knowing.
  private activeRecordingProjectId: string | null | undefined;
  private lookup: CoreLookup | undefined;

  constructor(private readonly deps: ProjectContextDeps) {}

  activeRecordingProject(): string | null | undefined {
    return this.activeRecordingProjectId;
  }

  setActiveRecordingProject(projectId: string | null | undefined): void {
    this.activeRecordingProjectId = projectId;
  }

  /** The best project known without asking Core: the recording's, else the stored one. */
  current(): string | undefined {
    return nonEmpty(this.activeRecordingProjectId ?? this.deps.session().projectId);
  }

  /**
   * The project as Core currently names it, adopted onto the session when it
   * differs. A recording's own project wins without asking. Falls back to the
   * stored project when Core names none, cannot be asked, or is slow.
   */
  async resolve(reason: string): Promise<string | undefined> {
    const recording = nonEmpty(this.activeRecordingProjectId);
    if (recording) return recording;
    if (!this.deps.session().token) return this.current();
    const named = await this.boundedCoreLookup(reason);
    return named ?? this.current();
  }

  private async boundedCoreLookup(reason: string): Promise<string | undefined> {
    const answer = this.coreLookup(reason);
    let bound: ReturnType<typeof setTimeout> | undefined;
    const giveUp = new Promise<undefined>((resolve) => {
      bound = setTimeout(() => resolve(undefined), this.deps.lookupBoundMs ?? CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS);
    });
    try {
      return await Promise.race([answer, giveUp]);
    } finally {
      clearTimeout(bound);
    }
  }

  // One lookup at a time, and its answer reused briefly once it has settled.
  // A lookup still open past the bound is not waited on again: the next read
  // asks afresh, so one hung request cannot stand in for Core indefinitely.
  private coreLookup(reason: string): Promise<string | undefined> {
    const now = this.now();
    if (this.reusable(this.lookup, now)) return this.lookup.answer;
    const lookup: CoreLookup = { startedAt: now, answer: this.askCore(reason) };
    this.lookup = lookup;
    void lookup.answer.finally(() => { lookup.settledAt = this.now(); });
    return lookup.answer;
  }

  private reusable(lookup: CoreLookup | undefined, now: number): lookup is CoreLookup {
    if (!lookup) return false;
    if (lookup.settledAt !== undefined) return now - lookup.settledAt < CORE_PROJECT_CONTEXT_REUSE_MS;
    return now - lookup.startedAt < (this.deps.lookupBoundMs ?? CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS);
  }

  private async askCore(reason: string): Promise<string | undefined> {
    const session = this.deps.session();
    const token = session.token;
    if (!token) return undefined;
    try {
      const projectId = nonEmpty(await fetchProjectIdFromCoreSnapshot(
        { coreApiUrl: this.deps.settings().coreApiUrl, token },
        { sessionId: session.sessionId, clientId: session.clientId },
        reason
      ));
      if (!projectId) return undefined;
      // A recording Core accepted with no project takes the one Core now names.
      if (this.activeRecordingProjectId === null) this.activeRecordingProjectId = projectId;
      if (nonEmpty(this.deps.session().projectId) !== projectId) {
        await this.deps.adoptProjectId(projectId);
        this.deps.onActivity("recording", "Project context linked", projectId, "success");
      }
      return projectId;
    } catch (error) {
      // With a stored project to fall back on, an unreachable Core changes
      // nothing a person can see, so it is not logged on every read.
      if (!this.current()) {
        const message = error instanceof Error ? error.message : "Project context lookup failed.";
        this.deps.onActivity("recording", "Project context unavailable", message, "warning");
      }
      return undefined;
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
