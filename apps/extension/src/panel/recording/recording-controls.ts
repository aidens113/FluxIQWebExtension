// Recording and extraction, reachable without clutter:
//
//   recordButton   the chat composer's "Show me how", beside "+" (its name is
//                  "Start recording", the name the Lab presses), shown while
//                  connected and idle. One press asks what FluxIQ should learn
//                  from it and starts recording this tab; the chat stays on screen.
//   newAutomation  the automations tab's "New automation" section: "Show FluxIQ
//                  how" (the same name) and "Extract Data From This Page", each
//                  with a line saying what it does or why it can't
//   bar            a slim bar under the top bar, on every tab, while a
//                  recording runs: how many steps, "Extract Data From This
//                  Page", and "Stop recording" (the Lab's name). It also holds
//                  a recording refusal (with OK) and any failed request, until
//                  its cause is gone or the person presses again.
//
// When a recording ends it attaches to the next message by itself, with the
// chip the composer shows and the caret in the box (`finished-line.ts`); the
// panel stays where it is. What was asked is kept (`pending-recording-store.ts`)
// so a Firefox popup that closed in between still attaches it on reopening.
//
// The extraction sheet is mounted once and its entry moves between the two
// places, so a sheet already open is never torn away by a status change: it
// is fixed over the whole panel wherever its entry sits. Pressed while no
// recording runs, the entry starts one first, so the extraction compiles into
// the recording's Flow (plan 3.7).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { recordingsPort } from "../chat/transport/ports";
import { createElement } from "../dom";
import { mountExtractionPanel } from "../extraction";
import type { PanelContext } from "../shell";
import { createStickyError } from "../state";
import { extractControl } from "./extract-control";
import { requestRecordingDescription } from "./description";
import { createPendingRecordingStore, type PendingRecordingStore } from "./pending-recording-store";
import { recordControl } from "./record-control";
import { recordIcon } from "./record-icon";
import { createRecordingFinish, type RecordingFinishHost } from "./finished-line";
import "./recording.css";

/** The recording parts the shell places. */
export type RecordingControls = {
  /** "Show me how", for the composer. */
  readonly recordButton: HTMLButtonElement;
  readonly bar: HTMLElement;
  readonly newAutomation: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Whether FluxIQ is working, held steady by the shell; redraws when it changes. */
  setWorking(working: boolean): void;
};

/** What a finished recording does to the chat, and the seams a test replaces. */
export type RecordingControlsOptions = Pick<RecordingFinishHost, "attach" | "attached"> & {
  readonly pending?: PendingRecordingStore;
  readonly finishDeps?: RecordingFinishHost["deps"];
};

/** Shown while the recording runs in Firefox's popup, which closes when the page is clicked. */
export const POPUP_BAR_LINE = "Clicking the page closes this window, but recording goes on. Open FluxIQ again to see it and press Stop recording.";
const IDLE_WORDS = "FluxIQ watches this tab while you do the task once, then keeps it with your next message.";

type Refusal = { readonly cancelled: true } | { readonly sentence: string; readonly detail?: string | undefined };

/** Builds the recording controls. */
export function createRecordingControls(context: PanelContext, options: RecordingControlsOptions): RecordingControls {
  const { store } = context;
  const pending = options.pending ?? createPendingRecordingStore();
  const popup = context.surface === "popup";
  const error = createStickyError<ExtensionStatus>();
  let latest: ExtensionStatus | undefined;
  let sending = false;
  let working = false;
  let recordingWas: boolean | undefined;

  // "Start recording" is the exact name the Lab presses; the id is kept from the single-file popup.
  const recordButton = createElement("button", {
    id: "recordButton",
    className: "composer-record",
    hidden: true,
    attrs: { type: "button", "aria-label": "Start recording", title: IDLE_WORDS }
  }, [recordIcon(), createElement("span", { className: "composer-record-text", text: "Show me how" })]);
  const recordNew = createElement("button", { className: "small-button", text: "Show FluxIQ how", attrs: { type: "button", "aria-label": "Start recording" } });
  const recordLine = createElement("p", { className: "card-line" });
  const extractionHost = createElement("div", { className: "extraction-entry" });
  const extraction = mountExtractionPanel(extractionHost, { prepare: startRecordingIfIdle });
  const extractLine = createElement("p", { id: "extractDataLine", className: "card-line" });
  const extractSlot = createElement("div", { className: "new-automation-extract" }, [extractionHost]);
  const newAutomation = createElement("section", { className: "new-automation", attrs: { "aria-label": "New automation" } }, [
    createElement("h3", { className: "new-automation-title", text: "New automation" }),
    createElement("p", { className: "card-line", text: "Tell FluxIQ what to do in the Chat tab, or show it how." }),
    createElement("div", { className: "new-automation-row" }, [recordNew, recordLine]),
    createElement("div", { className: "new-automation-row" }, [extractSlot, extractLine])
  ]);

  const barText = createElement("span", { className: "recording-bar-text" });
  const barExtract = createElement("div", { className: "recording-bar-extract" });
  const stopButton = createElement("button", {
    id: "stopRecordingButton",
    className: "small-button danger-fill",
    text: "Stop recording",
    attrs: { type: "button" }
  });
  const barRow = createElement("div", { className: "recording-bar-row" }, [
    createElement("span", { className: "recording-bar-status" }, [createElement("span", { className: "rec-dot", attrs: { "aria-hidden": "true" } }), barText]),
    createElement("span", { className: "recording-bar-actions" }, [barExtract, stopButton])
  ]);
  const popupLine = createElement("p", { className: "recording-bar-note", text: POPUP_BAR_LINE, hidden: true });
  const blockTitle = createElement("strong", {});
  const blockLine = createElement("span", {});
  const okButton = createElement("button", { className: "small-button", text: "OK", attrs: { type: "button" } });
  const block = createElement("div", { className: "notice recording-block", attrs: { role: "status" } }, [
    createElement("span", { className: "recording-block-text" }, [blockTitle, " ", blockLine]),
    okButton
  ]);
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const finish = createRecordingFinish({
    request: store.request,
    pending,
    attach: options.attach,
    attached: options.attached,
    changed: rerender,
    ...(options.finishDeps === undefined ? {} : { deps: options.finishDeps })
  });
  const bar = createElement("section", { className: "recording-bar", hidden: true, attrs: { "aria-label": "Recording", "aria-live": "polite" } }, [barRow, popupLine, block, notice, finish.element]);

  recordButton.addEventListener("click", () => void startRecording());
  recordNew.addEventListener("click", () => void startRecording());
  stopButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.stopRecording, stopButton, (status) => status.recordingState !== "recording"));
  okButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.dismissRecordingLock, okButton, (status) => status.recordingBlock === undefined));

  /** The recordings FluxIQ already holds, so the one made now can be told from them. Waits at most a few seconds; a list it cannot read is no list. */
  async function knownRecordings(): Promise<string[]> {
    const listed = await Promise.race([
      recordingsPort(store.request).list({ page: 1, pageSize: 100 }),
      new Promise<undefined>((resolve) => window.setTimeout(resolve, 4000))
    ]);
    return listed?.ok ? (listed.value.items ?? []).map((item) => item.id) : [];
  }

  /** Asks what FluxIQ should learn, then starts recording this tab; undefined once it started. */
  async function begin(): Promise<Refusal | undefined> {
    finish.reset();
    const description = await requestRecordingDescription(newAutomation, { popup });
    if (description === undefined) return { cancelled: true };
    await pending.write({ description, known: await knownRecordings(), at: Date.now() });
    const result = await store.request({ type: RUNTIME_MESSAGES.startRecording, description });
    if (result.ok) return undefined;
    await pending.clear();
    return { sentence: result.sentence, detail: result.detail };
  }

  async function startRecording(): Promise<void> {
    error.clear();
    sending = true;
    rerender();
    let refused: Refusal | undefined;
    try {
      refused = await begin();
    } catch {
      refused = { sentence: "Couldn't start recording. Try again." };
    }
    sending = false;
    if (refused !== undefined && !("cancelled" in refused)) error.show(refused.sentence, (status) => status.recordingState === "recording", refused.detail);
    rerender();
  }

  /** Extraction is recorded into a recording; with none running, one is started first. */
  async function startRecordingIfIdle(): Promise<void> {
    if (latest?.recordingState === "recording") return;
    const refused = await begin();
    if (refused !== undefined) throw new Error("cancelled" in refused ? "Recording cancelled." : refused.sentence);
  }

  async function send(type: string, button: HTMLButtonElement, causeGone: (status: ExtensionStatus) => boolean): Promise<void> {
    error.clear();
    button.disabled = true;
    rerender();
    const result = await store.request({ type });
    button.disabled = false;
    if (!result.ok) error.show(result.sentence, causeGone, result.detail);
    rerender();
  }

  function rerender(): void {
    if (latest !== undefined) render(latest);
  }

  /** A recording that ended (here, or while the popup was closed) goes to the next message. */
  function recordingEnded(): void {
    void pending.read().then((remembered) => {
      if (remembered !== undefined) void finish.run(remembered);
    });
  }

  function render(status: ExtensionStatus): void {
    latest = status;
    const recording = status.recordingState === "recording" || status.recordingState === "paused";
    const connected = status.connectionState === "connected";
    // The first connected status counts too: a popup reopened after a recording ended elsewhere.
    if (connected) {
      const was = recordingWas;
      recordingWas = recording;
      if (!recording && was !== false) recordingEnded();
    }
    const record = recordControl(status, working);
    recordButton.hidden = record.hidden || !connected;
    recordButton.disabled = record.disabled || sending;
    recordButton.title = record.reason ?? IDLE_WORDS;
    recordNew.disabled = record.disabled || record.hidden || sending;
    recordLine.textContent = record.hidden ? "Recording now. Stop it from the bar at the top." : record.reason ?? IDLE_WORDS;

    const extract = extractControl(status, working);
    extraction.setAvailable(!extract.disabled, extract.line);
    extractLine.textContent = extract.line;
    extractLine.hidden = recording;
    const home = recording ? barExtract : extractSlot;
    if (extractionHost.parentElement !== home) home.append(extractionHost);

    const steps = status.eventCount === 1 ? "1 step" : `${status.eventCount} steps`;
    barText.textContent = status.recordingState === "paused" ? `Recording paused · ${steps}` : `Recording this tab · ${steps}`;
    barRow.hidden = !recording;
    popupLine.hidden = !recording || !popup;
    const refusal = status.recordingBlock;
    block.hidden = refusal === undefined;
    blockTitle.textContent = refusal?.title ?? "";
    blockLine.textContent = refusal?.message ?? "";

    error.observe(status);
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
    bar.hidden = !recording && refusal === undefined && shown === undefined && !finish.shown();
  }

  function setWorking(next: boolean): void {
    if (next === working) return;
    working = next;
    rerender();
  }

  return { recordButton, bar, newAutomation, render, setWorking };
}
