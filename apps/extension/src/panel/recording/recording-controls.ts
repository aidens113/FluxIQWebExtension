// Recording and extraction, reachable without clutter:
//
//   recordButton   the top bar's round record button, "Start recording" (the
//                  name the Lab presses), shown while connected and idle
//   newAutomation  the automations tab's "New automation" section: "Record a
//                  new automation" and "Extract Data From This Page", each with
//                  a line saying what it does or why it can't
//   bar            a slim bar under the top bar, on every tab, while a
//                  recording runs: how many steps, "Extract Data From This
//                  Page", and "Stop recording" (the Lab's name). It also holds
//                  a recording refusal (with OK) and any failed request, until
//                  its cause is gone or the person presses again.
//
// The extraction sheet is mounted once and its entry moves between the two
// places, so a sheet already open is never torn away by a status change: it
// is fixed over the whole panel wherever its entry sits. Pressed while no
// recording runs, the entry starts one first, so the extraction compiles into
// the recording's Flow (plan 3.7).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { mountExtractionPanel } from "../extraction";
import type { PanelContext } from "../shell";
import { createStickyError } from "../state";
import { extractControl } from "./extract-control";
import { recordControl } from "./record-control";
import "./recording.css";

/** The recording parts the shell places. */
export type RecordingControls = {
  readonly recordButton: HTMLButtonElement;
  readonly bar: HTMLElement;
  readonly newAutomation: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Whether FluxIQ is working, held steady by the shell; redraws when it changes. */
  setWorking(working: boolean): void;
};

const SVG = "http://www.w3.org/2000/svg";

/** Builds the recording controls. */
export function createRecordingControls(context: PanelContext): RecordingControls {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();
  let latest: ExtensionStatus | undefined;
  let sending = false;
  let working = false;

  // "Start recording" is the exact name the Lab presses; the id is kept from the single-file popup.
  const recordButton = createElement("button", {
    id: "recordButton",
    className: "icon-button record-button",
    hidden: true,
    attrs: { type: "button", "aria-label": "Start recording", title: "Record a new automation" }
  }, [recordIcon()]);
  const recordNew = createElement("button", { className: "small-button", text: "Record a new automation", attrs: { type: "button" } });
  const recordLine = createElement("p", { className: "card-line" });
  const extractionHost = createElement("div", { className: "extraction-entry" });
  const extraction = mountExtractionPanel(extractionHost, { prepare: startRecordingIfIdle });
  const extractLine = createElement("p", { id: "extractDataLine", className: "card-line" });
  const extractSlot = createElement("div", { className: "new-automation-extract" }, [extractionHost]);
  const newAutomation = createElement("section", { className: "new-automation", attrs: { "aria-label": "New automation" } }, [
    createElement("h3", { className: "new-automation-title", text: "New automation" }),
    createElement("p", { className: "card-line", text: "Describe what you want in the chat, or show FluxIQ how by doing it once while it records." }),
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
  const blockTitle = createElement("strong", {});
  const blockLine = createElement("span", {});
  const okButton = createElement("button", { className: "small-button", text: "OK", attrs: { type: "button" } });
  const block = createElement("div", { className: "notice recording-block", attrs: { role: "status" } }, [
    createElement("span", { className: "recording-block-text" }, [blockTitle, " ", blockLine]),
    okButton
  ]);
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const bar = createElement("section", { className: "recording-bar", hidden: true, attrs: { "aria-label": "Recording", "aria-live": "polite" } }, [barRow, block, notice]);

  recordButton.addEventListener("click", () => void startRecording());
  recordNew.addEventListener("click", () => void startRecording());
  stopButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.stopRecording, stopButton, (status) => status.recordingState !== "recording"));
  okButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.dismissRecordingLock, okButton, (status) => status.recordingBlock === undefined));

  async function startRecording(): Promise<void> {
    error.clear();
    sending = true;
    rerender();
    const result = await store.request({ type: RUNTIME_MESSAGES.startRecording });
    sending = false;
    if (!result.ok) error.show(result.sentence, (status) => status.recordingState === "recording", result.detail);
    rerender();
  }

  /** Extraction is recorded into a recording; with none running, one is started first. */
  async function startRecordingIfIdle(): Promise<void> {
    if (latest?.recordingState === "recording") return;
    const result = await store.request({ type: RUNTIME_MESSAGES.startRecording });
    if (!result.ok) throw new Error(result.sentence);
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

  function render(status: ExtensionStatus): void {
    latest = status;
    const recording = status.recordingState === "recording" || status.recordingState === "paused";
    const record = recordControl(status, working);
    const connected = status.connectionState === "connected";
    recordButton.hidden = record.hidden || !connected;
    recordButton.disabled = record.disabled || sending;
    recordButton.title = record.reason ?? "Record a new automation";
    recordNew.disabled = record.disabled || record.hidden || sending;
    recordLine.textContent = record.hidden ? "Recording now. Stop it from the bar at the top." : record.reason ?? "Do the job once while FluxIQ records the steps.";

    const extract = extractControl(status, working);
    extraction.setAvailable(!extract.disabled, extract.line);
    extractLine.textContent = extract.line;
    extractLine.hidden = recording;
    const home = recording ? barExtract : extractSlot;
    if (extractionHost.parentElement !== home) home.append(extractionHost);

    const steps = status.eventCount === 1 ? "1 step" : `${status.eventCount} steps`;
    barText.textContent = status.recordingState === "paused" ? `Recording paused · ${steps}` : `Recording · ${steps}`;
    barRow.hidden = !recording;
    const refusal = status.recordingBlock;
    block.hidden = refusal === undefined;
    blockTitle.textContent = refusal?.title ?? "";
    blockLine.textContent = refusal?.message ?? "";

    error.observe(status);
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
    bar.hidden = !recording && refusal === undefined && shown === undefined;
  }

  function setWorking(next: boolean): void {
    if (next === working) return;
    working = next;
    rerender();
  }

  return { recordButton, bar, newAutomation, render, setWorking };
}

function recordIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const ring = document.createElementNS(SVG, "circle");
  ring.setAttribute("cx", "8");
  ring.setAttribute("cy", "8");
  ring.setAttribute("r", "6.5");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "currentColor");
  ring.setAttribute("stroke-width", "1.5");
  const dot = document.createElementNS(SVG, "circle");
  dot.setAttribute("cx", "8");
  dot.setAttribute("cy", "8");
  dot.setAttribute("r", "3.5");
  dot.setAttribute("fill", "currentColor");
  svg.append(ring, dot);
  return svg;
}
