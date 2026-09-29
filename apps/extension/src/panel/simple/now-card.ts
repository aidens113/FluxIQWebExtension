// The "Right now" card: what FluxIQ is doing, with a way to stop it (UI audit,
// section 4, "2. 'Right now' card"). The words are `nowCopy`; Stop while a run
// is going is `createRunStop`; this file puts them on screen.
//
// While recording, the card holds "Stop recording" (the Lab's exact name) and,
// under it, the extraction sheet's entry, "Extract Data From This Page", from
// `mountExtractionPanel`, unchanged. The sheet is mounted once and stays in the
// DOM; only its entry button is hidden when nothing is being recorded, so a
// sheet already open is never torn away mid-pick.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { mountExtractionPanel } from "../extraction";
import type { PanelViewContext } from "../shell";
import { nowCopy } from "./now-copy";
import { createOpenFluxIQButton } from "./open-fluxiq-button";
import type { RunStop } from "./run-stop";
import { createStickyError } from "./sticky-error";

/** The mounted now card. */
export type NowCard = {
  readonly element: HTMLElement;
  /** Renders `status` at time `now`; called on every status and on the view's one-second tick. */
  render(status: ExtensionStatus, now: number): void;
};

/** Creates the now card, stopping runs through `runStop`. */
export function createNowCard(context: PanelViewContext, runStop: RunStop): NowCard {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();
  let latest: ExtensionStatus | undefined;

  const recDot = createElement("span", { className: "rec-dot", hidden: true, attrs: { "aria-hidden": "true" } });
  const title = createElement("h2", { className: "card-title", text: "Nothing running" });
  const detail = createElement("p", { className: "card-line" });
  const detailsLink = createElement("button", { className: "link-button", text: "Details", attrs: { type: "button" }, hidden: true });
  const okButton = createElement("button", { className: "small-button", text: "OK", attrs: { type: "button" }, hidden: true });
  const stopRecordingButton = createElement("button", {
    id: "stopRecordingButton",
    className: "primary-button danger-fill",
    text: "Stop recording",
    attrs: { type: "button" },
    hidden: true
  });
  const extractionHost = createElement("div", { className: "simple-extraction", attrs: { "data-recording": "false" } });
  const stopButton = createElement("button", { id: "stopRunButton", className: "primary-button danger-fill", text: "Stop", attrs: { type: "button" }, hidden: true });
  const stopNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const stopOpen = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "small" });
  const stopFallback = createElement("div", { className: "simple-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "To stop this, use FluxIQ." }),
    stopOpen.element
  ]);
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("section", { className: "card simple-now", attrs: { "aria-label": "Right now", "aria-live": "polite" } }, [
    createElement("p", { className: "simple-eyebrow", text: "Right now" }),
    createElement("div", { className: "simple-now-heading" }, [recDot, title]),
    createElement("p", { className: "simple-now-detail" }, [detail, " ", detailsLink]),
    okButton,
    stopRecordingButton,
    extractionHost,
    stopButton,
    stopNotice,
    stopFallback,
    notice
  ]);
  const extraction = mountExtractionPanel(extractionHost);

  detailsLink.addEventListener("click", () => context.navigate({ mode: "advanced", tab: "activity" }));
  okButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.dismissRecordingLock, okButton, (status) => status.recordingBlock === undefined));
  stopRecordingButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.stopRecording, stopRecordingButton, (status) => status.recordingState !== "recording"));
  stopButton.addEventListener("click", () => {
    const pressed = runStop.press();
    rerender();
    void pressed.then(rerender);
  });

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
    if (latest !== undefined) render(latest, Date.now());
  }

  function render(status: ExtensionStatus, now: number): void {
    latest = status;
    const copy = nowCopy(status, now);
    const recording = copy.kind === "recording";
    title.textContent = copy.title;
    detail.textContent = copy.detail;
    recDot.hidden = !copy.recordingDot;
    detailsLink.hidden = !copy.details;
    okButton.hidden = copy.kind !== "block";
    stopRecordingButton.hidden = !recording;

    const extractable = recording && status.connectionState === "connected" && status.unsupportedPage === undefined;
    extraction.setAvailable(extractable, status.unsupportedPage ? "This page cannot be recorded." : "Start recording first.");
    extractionHost.dataset.recording = String(recording);

    runStop.observe(status, now);
    const stop = runStop.view();
    const running = copy.kind === "running";
    stopButton.hidden = !running || stop.button === undefined;
    stopButton.textContent = stop.button?.label ?? "Stop";
    stopButton.disabled = stop.button?.disabled ?? true;
    stopNotice.textContent = stop.sentence ?? "";
    stopNotice.title = stop.detail ?? "";
    stopNotice.hidden = !running || stop.sentence === undefined;
    stopFallback.hidden = !running || !stop.fallback;
    stopOpen.observe(status);

    error.observe(status);
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  return { element, render };
}
