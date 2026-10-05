// The status shown from the moment the person sends a message FluxIQ takes
// on, until Core's first activity replaces it.
//
// Between a send and Core's first activity there is nothing of Core's to
// draw: Core answers the send, then starts the work, and its first event comes
// a second or more after the person pressed Send. The overlay was off the page
// for that whole second at every build's start (D14 of the
// run-musp4h2f-72e8ed99 UI review: present in 9 of 16 samples at the first
// build moment). The overlay is on the page whenever FluxIQ is working, so the
// relay puts this status up as the send leaves (`ActivityRelay.sending`):
// "Starting…", working, with no detail, marked `kind: "starting"`.
//
// It comes down in exactly these ways:
// - Core's first activity replaces it (`coreSpoke`), whenever it comes,
//   before or after Core's answer.
// - The send fails, or Core answers without starting work (`sendStartedWork`
//   is false): the status is taken down and nothing is shown, since FluxIQ is
//   not working. What was up before the send -- a finished or failed unit --
//   is not drawn again.
// - Core said it started but no activity followed within `STARTING_HOLD_MS`
//   (a dropped session): taken down, never left claiming work for good.
//
// It is not put up over work already running or waiting on the person: that
// work's own status is truer than "Starting…", and a question waiting in front
// of the person must stay there. Nor without a live session, since then no
// activity could ever replace it.
//
// Pure apart from the injected clock.

import type { ActivityDisplay } from "../../shared/activity/index";
import type { ActivityClock, ActivityTimer } from "./clock";

/** The starting status's headline. */
export const STARTING_HEADLINE = "Starting…";

/** The longest the starting status waits for Core's first activity once Core said it started. */
export const STARTING_HOLD_MS = 20_000;

/** What the starting status puts in place of the pacer's display, while it applies. */
export type StartingOverride = { readonly display: ActivityDisplay | null };

export class SendStart {
  private override: StartingOverride | undefined;
  private timer: ActivityTimer | undefined;
  private count = 0;

  constructor(
    private readonly clock: ActivityClock,
    /** Called when what the override says changed. */
    private readonly onChange: () => void,
    private readonly holdMs: number = STARTING_HOLD_MS
  ) {}

  /** The display to show instead of the pacer's, or undefined when the pacer's applies. */
  current(): StartingOverride | undefined {
    return this.override;
  }

  /**
   * Puts the starting status up over `shown`, the pacer's display, unless that
   * is work running or waiting on the person. Returns the status put up, to be
   * named when it is taken down, or undefined when none was.
   */
  putUp(shown: ActivityDisplay | null): ActivityDisplay | undefined {
    if (shown !== null && (shown.working || shown.outcome === "waiting")) return undefined;
    this.count += 1;
    const display: ActivityDisplay = {
      activityId: `starting:${this.count}`,
      subjectKind: "build",
      phase: "thinking",
      headline: STARTING_HEADLINE,
      detail: null,
      step: null,
      working: true,
      outcome: null,
      sequence: 0,
      kind: "starting"
    };
    this.cancelTimer();
    this.override = { display };
    this.timer = this.clock.setTimeout(() => this.takeDown(display), this.holdMs);
    this.onChange();
    return display;
  }

  /** Takes `display` down, if it is still the one up: nothing is shown in its place until Core's next activity. */
  takeDown(display: ActivityDisplay | undefined): void {
    if (display === undefined || this.override?.display !== display) return;
    this.cancelTimer();
    this.override = { display: null };
    this.onChange();
  }

  /** Core reported activity: the pacer's display applies again. Returns whether an override was in place. */
  coreSpoke(): boolean {
    if (this.override === undefined) return false;
    this.cancelTimer();
    this.override = undefined;
    return true;
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
