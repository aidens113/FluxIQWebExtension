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
import type { PanelRelayResponse } from "../../shared/protocol";
import { askCoreForFirstProject, fetchProjectFromCoreSnapshot, writeCoreActiveProject } from "./core-api";
import type { ProjectChoice, ProjectChoiceStorage } from "../projects/index";

// A Core answer is reused this long, so a burst of reads (the panel opening,
// one snapshot per runtime step) asks Core once rather than once each.
export const CORE_PROJECT_CONTEXT_REUSE_MS = 1_000;
// How long a read waits for Core before it goes on with the stored project.
// The lookup itself is left to finish, and is adopted when it does. Kept under
// the recording start's own lookup bound (active-recording.ts), so a slow Core
// starts a recording under the stored project rather than under none.
export const CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS = 1_000;

// A panel read goes on with the project held here and asks Core again in the
// background no more often than this, so a project the person switched to in
// FluxIQ is followed within a beat without a snapshot fetch in front of each call.
export const CORE_PROJECT_CONTEXT_REFRESH_MS = 15_000;

export type ProjectContextDeps = {
  readonly settings: () => FluxIQSettings;
  readonly session: () => FluxIQSession;
  // Records a project Core named on the session and persists it.
  readonly adoptProjectId: (projectId: string) => Promise<void>;
  // Removes the session's project and persists that, when Core says its person lost it and moved the session to none.
  readonly forgetProjectId?: () => Promise<void>;
  // Told when Core names the current project's name, which the status carries to the panel.
  readonly onProjectName?: () => void;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly now?: () => number;
  readonly lookupBoundMs?: number;
  // Where the person's chosen project is kept between worker runs, by server address. Absent: kept in memory only.
  readonly choiceStorage?: ProjectChoiceStorage;
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
  private generation = 0;
  private leaseScoped = false;
  // What Core last called a project, kept here only: a restarted worker learns it again at the next read.
  private named: { readonly projectId: string; readonly name: string } | undefined;
  // The project the person chose in the panel; it applies to every call that names none. Undefined: follow Core.
  private chosen: ProjectChoice | undefined;
  // When Core was last asked in this lease, answered or not; undefined until it has been.
  private checkedAt: number | undefined;
  // Rises with every choice the person makes, so a stored choice read before one never overwrites it.
  private choices = 0;

  constructor(private readonly deps: ProjectContextDeps) {}

  /** Reads the choice kept for the current server address, and says whether it changed the held one. Call at start and when the address changes. */
  async loadChoice(): Promise<boolean> {
    const storage = this.deps.choiceStorage;
    if (!storage) return false;
    const choices = this.choices;
    const stored = await storage.read(this.deps.settings().coreApiUrl);
    // The person chose while this was read: their choice is newer than what was stored.
    if (choices !== this.choices) return false;
    if ((this.chosen?.projectId) === stored?.projectId) return false;
    this.chosen = stored;
    this.deps.onProjectName?.();
    return true;
  }

  /**
   * Tells Core the person's current project, so the panel and every other client read the same one.
   * The browser's own copy (`choose`) stays as the fallback for a Core that cannot be reached.
   */
  shareChoice(projectId: string): Promise<PanelRelayResponse> {
    return writeCoreActiveProject({ coreApiUrl: this.deps.settings().coreApiUrl, token: this.deps.session().token }, { activeProjectId: projectId });
  }

  /** The project the person chose, or undefined when this browser follows Core. */
  chosenProject(): string | undefined {
    return this.chosen?.projectId;
  }

  /** Who decided the current project: the person's choice, else Core. */
  chosenBy(): "person" | "core" {
    return this.chosen ? "person" : "core";
  }

  /** Chooses a project for every call that names none; null follows Core again. */
  async choose(choice: ProjectChoice | null): Promise<void> {
    this.choices++;
    this.chosen = choice ?? undefined;
    await this.deps.choiceStorage?.write(this.deps.settings().coreApiUrl, choice);
    this.deps.onProjectName?.();
    // Following Core again: learn its project now rather than at the next beat.
    if (!choice) this.refreshInBackground("follow_core");
  }

  /**
   * Core says the person who paired this browser can no longer read
   * `projectId`, and moved the session to `currentProjectId`
   * (`server.project_access_ended`, `projects/access-ended.ts`). A choice of
   * that project is dropped as clearing it would be, the session's project
   * becomes Core's, and the browser follows Core again from there. A recording
   * keeps its own project. Says whether anything held here changed.
   */
  async accessEnded(notice: { readonly projectId: string; readonly currentProjectId: string | null }): Promise<boolean> {
    let changed = false;
    if (this.chosen?.projectId === notice.projectId) {
      this.choices++;
      this.chosen = undefined;
      await this.deps.choiceStorage?.write(this.deps.settings().coreApiUrl, null);
      changed = true;
    }
    if (nonEmpty(this.deps.session().projectId) === notice.projectId) {
      if (notice.currentProjectId) await this.deps.adoptProjectId(notice.currentProjectId);
      else await this.deps.forgetProjectId?.();
      changed = true;
    }
    if (this.named?.projectId === notice.projectId) this.named = undefined;
    if (!changed) return false;
    // A Core answer read before the loss may still name the lost project: it is neither reused nor adopted.
    this.generation++;
    this.lookup = undefined;
    this.checkedAt = undefined;
    this.deps.onProjectName?.();
    this.refreshInBackground("project_access_ended");
    return true;
  }

  /** Tells the context what a project is called, from a listing, so the status can carry its name. */
  noteName(projectId: string, name: string): void {
    if (this.chosen?.projectId === projectId && this.chosen.name !== name) {
      this.chosen = { projectId, name };
      void this.deps.choiceStorage?.write(this.deps.settings().coreApiUrl, this.chosen).catch(/* best-effort: only the stored name is stale, the choice itself is held */ () => undefined);
    }
    this.learnName(projectId, name);
  }

  /**
   * The project a panel call uses. The person's choice wins; else the project
   * held here, which is not fetched per call: Core is asked once per lease and
   * then again in the background at most every `CORE_PROJECT_CONTEXT_REFRESH_MS`.
   * Only a browser with nothing held waits on Core, as `resolve` does.
   */
  async forPanel(reason: string): Promise<string | undefined> {
    if (this.chosen) return this.chosen.projectId;
    const recording = nonEmpty(this.activeRecordingProjectId);
    if (recording) return recording;
    const held = nonEmpty(this.deps.session().projectId);
    if (!this.deps.session().token) return held;
    if (held && this.checkedAt !== undefined) {
      if (this.now() - this.checkedAt >= CORE_PROJECT_CONTEXT_REFRESH_MS) this.refreshInBackground(reason);
      return held;
    }
    return this.resolve(reason);
  }

  private refreshInBackground(reason: string): void {
    if (!this.deps.session().token) return;
    void this.coreLookup(reason).catch(/* best-effort: the held project answers until the next refresh */ () => undefined);
  }

  /** A new Core lease may name another project even within the cache's reuse window. */
  invalidate(): void {
    this.generation++;
    this.lookup = undefined;
    this.named = undefined;
    this.checkedAt = undefined;
    this.leaseScoped = true;
  }

  activeRecordingProject(): string | null | undefined {
    return this.activeRecordingProjectId;
  }

  setActiveRecordingProject(projectId: string | null | undefined): void {
    this.activeRecordingProjectId = projectId;
  }

  /** The best project known without asking Core: the recording's, else the stored one. */
  current(): string | undefined {
    return nonEmpty(this.activeRecordingProjectId ?? this.chosen?.projectId ?? this.deps.session().projectId);
  }

  /** The project panel reads use without asking: the person's choice, else the stored one. */
  held(): string | undefined {
    return nonEmpty(this.chosen?.projectId ?? this.deps.session().projectId);
  }

  /** What Core calls the current project, or nothing when it has not said or the project has since changed. */
  currentName(): string | undefined {
    const project = this.current();
    if (this.chosen && this.chosen.projectId === project && this.chosen.name) return this.chosen.name;
    return this.named !== undefined && this.named.projectId === project ? this.named.name : undefined;
  }

  /**
   * The project as Core currently names it, adopted onto the session when it
   * differs. A recording's own project wins without asking. Falls back to the
   * stored project when Core names none, cannot be asked, or is slow.
   */
  async resolve(reason: string): Promise<string | undefined> {
    const generation = this.generation;
    const recording = nonEmpty(this.activeRecordingProjectId);
    if (recording) return recording;
    if (this.chosen) return this.chosen.projectId;
    if (!this.deps.session().token) return this.current();
    const named = await this.boundedCoreLookup(reason);
    if (generation !== this.generation) return undefined;
    return named ?? (this.leaseScoped ? undefined : this.current());
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
    const generation = this.generation;
    void lookup.answer.finally(() => {
      lookup.settledAt = this.now();
      if (generation === this.generation) this.checkedAt = lookup.settledAt;
    });
    return lookup.answer;
  }

  private reusable(lookup: CoreLookup | undefined, now: number): lookup is CoreLookup {
    if (!lookup) return false;
    if (lookup.settledAt !== undefined) return now - lookup.settledAt < CORE_PROJECT_CONTEXT_REUSE_MS;
    return now - lookup.startedAt < (this.deps.lookupBoundMs ?? CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS);
  }

  private async askCore(reason: string): Promise<string | undefined> {
    const generation = this.generation;
    const session = this.deps.session();
    const token = session.token;
    if (!token) return undefined;
    try {
      const credentials = { coreApiUrl: this.deps.settings().coreApiUrl, token };
      const found = await fetchProjectFromCoreSnapshot(credentials, { sessionId: session.sessionId, clientId: session.clientId }, reason);
      if (generation !== this.generation) return undefined;
      const named = nonEmpty(found?.projectId);
      // Core read none: asked once this browser has nothing stored either, since a browser's chat has nowhere to be without one.
      const projectId = named ?? (this.current() ? undefined : nonEmpty(await askCoreForFirstProject(credentials)));
      if (generation !== this.generation) return undefined;
      if (!projectId) return undefined;
      // A recording Core accepted with no project takes the one Core now names.
      if (this.activeRecordingProjectId === null) this.activeRecordingProjectId = projectId;
      if (nonEmpty(this.deps.session().projectId) !== projectId) {
        await this.deps.adoptProjectId(projectId);
        if (generation !== this.generation) return undefined;
        this.deps.onActivity("recording", "Project context linked", projectId, "success");
      }
      this.learnName(projectId, named === projectId ? found?.projectName : undefined);
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

  private learnName(projectId: string, name: string | undefined): void {
    const before = this.named;
    this.named = name ? { projectId, name } : this.named?.projectId === projectId ? this.named : undefined;
    if (before?.projectId !== this.named?.projectId || before?.name !== this.named?.name) this.deps.onProjectName?.();
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
