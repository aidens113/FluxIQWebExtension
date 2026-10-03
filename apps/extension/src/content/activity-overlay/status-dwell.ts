// Keeps each status line on the page long enough to be read: different words
// replace the ones up only once those have been up for `STATUS_DWELL_MS`.
//
// The background already paces Core's events (`background/activity/pacer.ts`:
// a detail changes at most once per 1.2 s), but that is the pace of what it
// sends, not of what the page shows. Three things still put two lines up in
// quick succession here: a headline change -- a settle, waiting for the
// person, a new unit of work -- which the pacer sends at once, however
// recently the detail changed; the at-once answer to a new document's
// readiness, which can cross a paced send; and messages the extension's
// messaging delivers back to back after the service worker was busy. Lane D's
// run-murdouox-c5294247 UI review sampled three changes of words in three
// seconds and called it flicker (U3). This is the last guard before the
// person's eyes, so it holds whatever the reason.
//
// The rules:
//
// - Different words wait until the words up have had the dwell. While they
//   wait, a newer status replaces them: the **newest always wins**, and an
//   overtaken one is never flashed.
// - The waiting status is always drawn when the dwell ends: the **last status
//   is never dropped**, a settled one ("Flow ready", "Build failed") included,
//   which then fades or stays as `status-pill.ts` decides.
// - Anything that keeps the words -- a change of mode, mark or colour -- and a
//   status back to the words already up are drawn at once, and the second
//   cancels what was waiting.
// - A take-down (`null`: the person hid the overlay, or the work moved to
//   another tab) is drawn at once and drops what was waiting; the next status
//   after it is drawn at once.
//
// **Why 1600 ms.** More than half of three seconds, so any three seconds of the
// page show at most two changes of words: three in three seconds is what the
// user called flicker and what the Lab's UI review reads as flickering
// (`packages/test-runner/src/run-scenario/ui-review/count-overlay-changes.ts`,
// a 3 s window). The background's pace of 1.2 s alone allows three (lane D's
// moment 3 was exactly that), so this holds a paced send back by up to 0.4 s
// and, while work runs fast, shows the newest status rather than every one.
// It is also well over the time to read a three-to-five-word line --
// "Deciding the next step", "Clicking “Close chat”" -- at 4 to 5 words a second.

import type { ActivityOverlayView } from "./overlay-view";

/** The shortest time one status line stays on the page before different words replace it. */
export const STATUS_DWELL_MS = 1_600;

/** Draws the overlay's views through `draw`, holding a change of words back until the words up have had the dwell. */
export class StatusDwell {
  private drawn: ActivityOverlayView | null = null;
  private wordsChangedAt = Number.NEGATIVE_INFINITY;
  private waiting: ActivityOverlayView | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly draw: (view: ActivityOverlayView | null) => void,
    private readonly dwellMs: number = STATUS_DWELL_MS
  ) {}

  /** Shows `view` now, or once the words up have had their dwell; `null` takes the overlay down at once. */
  show(view: ActivityOverlayView | null): void {
    if (!view || !this.drawn || sameWords(view, this.drawn)) {
      this.cancelWaiting();
      this.drawNow(view);
      return;
    }
    const now = Date.now();
    const due = this.wordsChangedAt + this.dwellMs;
    if (now >= due) {
      this.cancelWaiting();
      this.drawNow(view);
      return;
    }
    this.waiting = view;
    this.timer ??= setTimeout(() => this.drawWaiting(), due - now);
  }

  private drawWaiting(): void {
    this.timer = undefined;
    const view = this.waiting;
    this.waiting = undefined;
    if (view) this.drawNow(view);
  }

  private drawNow(view: ActivityOverlayView | null): void {
    if (!view) this.wordsChangedAt = Number.NEGATIVE_INFINITY;
    else if (!this.drawn || !sameWords(view, this.drawn)) this.wordsChangedAt = Date.now();
    this.drawn = view;
    this.draw(view);
  }

  private cancelWaiting(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.waiting = undefined;
  }
}

/** Whether two views say the same thing: the same headline, detail and step. */
function sameWords(left: ActivityOverlayView, right: ActivityOverlayView): boolean {
  return left.headline === right.headline && left.detail === right.detail && left.step === right.step;
}
