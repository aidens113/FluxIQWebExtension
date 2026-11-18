// Tells Core which project this browser is working in (`client.focus_project`).
//
// Core's gateway pushes `server.activity` to a session only for the session's
// own project, which pairing set. The person's project choice lives here
// (`ProjectContext`, `choice-storage.ts`), so without this a chosen project's
// work never reached the chat as it happened. Core checks that the person who
// paired this browser may read the project, moves the session to it, and
// answers `server.project_focused`, or a `server.error` with a
// `project_focus.*` code (`focus-refusal.ts`) that leaves it where it was.
//
// Sent only over a live session, never queued: a focus queued while offline
// would arrive after the session it was meant for, and every new session is
// told the held choice when it becomes ready, since Core binds a new session to
// its pairing's project. Clearing the choice sends null, which returns the
// session to that project. An older Core ignores the message.

/** What a focus is sent with and decided from. */
export type ProjectFocusDeps = {
  /** The gateway's send; the session's own `send`, which queues while it is not ready, is never reached offline. */
  readonly send: (type: "client.focus_project", payload: { projectId: string | null }) => Promise<void>;
  /** True while the gateway session is ready. */
  readonly connected: () => boolean;
  /** The project the person chose, or undefined while the browser follows Core. */
  readonly chosenProject: () => string | undefined;
  /** Told when a send fails, which never stops the caller. */
  readonly onSendFailed?: (error: unknown) => void;
};

export class ProjectFocus {
  constructor(private readonly deps: ProjectFocusDeps) {}

  /** The person chose a project, or cleared the choice (null). Sent at once over a live session; otherwise the next ready session hears it. */
  async chosen(projectId: string | null): Promise<void> {
    await this.send(projectId);
  }

  /** A session became ready, or the choice was read from storage: a held choice is sent, since a new session starts at its pairing's project. */
  async announceHeld(): Promise<void> {
    const projectId = this.deps.chosenProject();
    if (projectId !== undefined) await this.send(projectId);
  }

  private async send(projectId: string | null): Promise<void> {
    if (!this.deps.connected()) return;
    try {
      await this.deps.send("client.focus_project", { projectId });
    } catch (error) {
      this.deps.onSendFailed?.(error);
    }
  }
}
