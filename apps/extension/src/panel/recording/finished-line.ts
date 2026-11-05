// What the panel says while a finished recording is being attached, and when it
// could not be: "Saving your recording..." until the chip is on the composer, and
// a line with OK if it never showed up. The line stays until the person presses
// OK or starts another recording; it is not a way for anything to fail, the "+"
// beside the box attaches the recording by hand.

import type { PanelStore } from "../state";
import { recordingsPort } from "../chat/transport/ports";
import { attachFinishedRecording, type FinishedRecordingDeps } from "./attach-finished";
import type { PendingRecording, PendingRecordingStore } from "./pending-recording-store";
import { createElement } from "../dom";

/** What the finish needs from the panel. */
export type RecordingFinishHost = {
  readonly request: PanelStore["request"];
  readonly pending: PendingRecordingStore;
  /** Attaches the newest described recording to the next message. */
  attach(): Promise<boolean>;
  /** The recording is on the composer: the caret goes into the box. */
  attached(): void;
  /** The line changed: the bar may need to show or hide. */
  changed(): void;
  /** A seam for a test: how the list is read and how time passes. */
  deps?: Pick<FinishedRecordingDeps, "list" | "wait">;
};

export const SAVING_LINE = "Saving your recording so it can go with your next message...";
export const NOT_ATTACHED_LINE = "Your recording is saved, but it didn't attach. Press + beside the message box to attach it.";

export type RecordingFinish = {
  readonly element: HTMLElement;
  /** Whether the line is on show. */
  shown(): boolean;
  /** Waits for `pending`'s recording and attaches it. One at a time. */
  run(pending: PendingRecording): Promise<void>;
  /** Forgets any line, as a new recording begins. */
  reset(): void;
};

/** Builds the finish. */
export function createRecordingFinish(host: RecordingFinishHost): RecordingFinish {
  const text = createElement("span", { className: "recording-finish-text", attrs: { role: "status" } });
  const ok = createElement("button", { className: "small-button", text: "OK", hidden: true, attrs: { type: "button" } });
  const element = createElement("div", { className: "notice recording-finish", hidden: true }, [text, ok]);
  let running = false;
  const deps: FinishedRecordingDeps = {
    list: host.deps?.list ?? (async () => {
      const result = await recordingsPort(host.request).list({ page: 1, pageSize: 100 });
      return result.ok ? result.value.items ?? [] : undefined;
    }),
    attach: host.attach,
    wait: host.deps?.wait ?? ((ms) => new Promise((resolve) => window.setTimeout(resolve, ms)))
  };

  function say(words: string, dismissable: boolean): void {
    text.textContent = words;
    ok.hidden = !dismissable;
    element.hidden = words === "";
    host.changed();
  }

  ok.addEventListener("click", () => say("", false));

  return {
    element,
    shown: () => !element.hidden,
    reset: () => say("", false),
    async run(pending) {
      if (running) return;
      running = true;
      say(SAVING_LINE, false);
      const attached = await attachFinishedRecording(pending, deps);
      running = false;
      await host.pending.clear();
      if (attached) {
        say("", false);
        host.attached();
      } else say(NOT_ATTACHED_LINE, true);
    }
  };
}
