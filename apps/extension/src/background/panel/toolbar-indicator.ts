// Keeps the toolbar badge in step with the extension's status
// (`toolbar-badge.ts` decides what it says). It writes only when the text
// changes, because status is emitted many times a second while recording, and
// it re-reads the last status when a run's hold runs out, since no status
// change arrives to clear it. The activity display comes separately
// (`activity`), from the activity relay, because a wait on the person is not
// part of the extension's status.

import type { ActivityDisplay } from "../../shared/activity/index";
import type { ExtensionStatus } from "../../shared/protocol";
import { toolbarBadge, type ToolbarBadge } from "./toolbar-badge";

/** The browser's badge, reached through an adapter so a test can watch it. */
export type ToolbarBadgeWriter = (text: ToolbarBadge["text"]) => void;

type Timers = {
  readonly now: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

const BADGE_COLORS: Record<Exclude<ToolbarBadge["text"], "">, string> = {
  REC: "#c62828",
  "!": "#b26a00",
  "...": "#1565c0"
};

/** The real badge on both browsers. Absent `chrome.action` (an old Firefox build) writes nothing. */
export const browserToolbarBadge: ToolbarBadgeWriter = (text) => {
  const action = (globalThis as { chrome?: { action?: typeof chrome.action } }).chrome?.action;
  if (!action?.setBadgeText) return;
  void action.setBadgeText({ text }).catch(/* best-effort: a badge that fails to draw changes nothing else */ () => undefined);
  if (text) void action.setBadgeBackgroundColor?.({ color: BADGE_COLORS[text] })?.catch(/* best-effort: the default colour still shows the text */ () => undefined);
};

export class ToolbarIndicator {
  private shown: ToolbarBadge["text"] | undefined;
  private last: Pick<ExtensionStatus, "recordingState" | "runtime"> | undefined;
  private display: Pick<ActivityDisplay, "outcome"> | null = null;
  private timer: unknown;

  constructor(
    private readonly write: ToolbarBadgeWriter = browserToolbarBadge,
    private readonly timers: Timers = { now: () => Date.now(), setTimeout: (callback, delayMs) => setTimeout(callback, delayMs), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }
  ) {}

  /** The activity display shown now; the badge says "!" while it waits on the person. */
  activity(display: Pick<ActivityDisplay, "outcome"> | null): void {
    if ((display?.outcome === "waiting") === (this.display?.outcome === "waiting")) {
      this.display = display;
      return;
    }
    this.display = display;
    this.update(this.last ?? { recordingState: "idle" });
  }

  update(status: Pick<ExtensionStatus, "recordingState" | "runtime">): void {
    this.last = status;
    const badge = toolbarBadge(status, this.timers.now(), this.display);
    if (badge.text !== this.shown) {
      this.shown = badge.text;
      this.write(badge.text);
    }
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    if (badge.recheckAt !== undefined) {
      this.timer = this.timers.setTimeout(() => {
        this.timer = undefined;
        if (this.last) this.update(this.last);
      }, Math.max(0, badge.recheckAt - this.timers.now()));
    }
  }
}
