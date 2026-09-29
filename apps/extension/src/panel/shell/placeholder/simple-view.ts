// The wave-1 simple view: just enough to pair, record and extract while
// workstream B builds the real one (UI audit, section 5, Workstream A).
//
// It keeps the Lab's names -- "Connect", "Start recording", "Stop recording",
// "Extract Data From This Page" -- and uses the section 4 copy for what it
// shows, so B replaces it rather than re-wording it. Errors stay in the card
// that caused them until the viewer acts again (audit defect F1); a status
// render never wipes them.

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { connectionCopy, errorSentence, pageHostname, stepSentence } from "../../copy";
import { createElement } from "../../dom";
import { mountExtractionPanel } from "../../extraction";
import type { PanelView, PanelViewContext } from "../contracts";
import type { SettingsDraft } from "./settings-draft";

const DONE_WINDOW_MS = 60_000;

/** Mounts the placeholder simple view: status card, now card with record, and extraction. */
export function mountPlaceholderSimpleView(context: PanelViewContext, draft: SettingsDraft): PanelView {
  const { store } = context;

  const dot = createElement("span", { className: "dot dot-grey", attrs: { "aria-hidden": "true" } });
  const sentence = createElement("p", { className: "card-title", text: "Checking the connection..." });
  const line = createElement("p", { className: "card-line", hidden: true });
  const code = createElement("p", { id: "pairingReferenceCode", className: "reference-code", hidden: true });
  const statusNotice = createElement("p", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const connectButton = createElement("button", { id: "connectButton", className: "primary-button", text: "Connect", attrs: { type: "button" }, hidden: true });
  const cancelButton = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" }, hidden: true });
  const statusCard = createElement("section", { className: "card status-card", attrs: { "aria-live": "polite" } }, [
    createElement("div", { className: "status-row" }, [dot, createElement("div", { className: "status-copy" }, [sentence, line])]),
    code,
    statusNotice,
    createElement("div", { className: "card-actions" }, [connectButton, cancelButton])
  ]);

  const nowTitle = createElement("h2", { className: "card-title", text: "Nothing running" });
  const nowDetail = createElement("p", { className: "card-line" });
  const blockOkButton = createElement("button", { className: "small-button", text: "OK", attrs: { type: "button" }, hidden: true });
  const recordButton = createElement("button", { id: "recordButton", className: "primary-button", text: "Start recording", attrs: { type: "button" } });
  const recordReason = createElement("p", { className: "card-line", hidden: true });
  const nowNotice = createElement("p", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const extractionHost = createElement("div", { className: "extraction-host" });
  const nowCard = createElement("section", { className: "card now-card", attrs: { "aria-live": "polite" } }, [
    createElement("div", { className: "now-heading" }, [createElement("span", { className: "rec-dot", hidden: true, attrs: { "aria-hidden": "true" } }), nowTitle]),
    nowDetail,
    blockOkButton,
    recordButton,
    recordReason,
    nowNotice,
    extractionHost
  ]);
  const recDot = nowCard.querySelector<HTMLElement>(".rec-dot")!;

  const element = createElement("section", { className: "simple-view", attrs: { "aria-label": "FluxIQ" } }, [statusCard, nowCard]);
  const extraction = mountExtractionPanel(extractionHost);

  async function send(type: string, notice: HTMLElement, buttons: HTMLButtonElement[], payload: Record<string, unknown> = {}): Promise<boolean> {
    notice.hidden = true;
    for (const button of buttons) button.disabled = true;
    const result = await store.request({ type, ...payload });
    for (const button of buttons) button.disabled = false;
    if (!result.ok) {
      notice.textContent = result.sentence;
      notice.title = result.detail ?? "";
      notice.hidden = false;
    }
    const current = store.current();
    if (current) render(current);
    return result.ok;
  }

  // Connect saves the settings form's values with it, as the single-file popup
  // did; the placeholder Advanced view owns that form (see settings-draft.ts).
  connectButton.addEventListener("click", () => {
    const settings = draft.read();
    void send(RUNTIME_MESSAGES.connect, statusNotice, [connectButton, cancelButton], settings === undefined ? {} : { settings })
      .then(() => draft.markSaved());
  });
  cancelButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.disconnect, statusNotice, [connectButton, cancelButton]));
  blockOkButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.dismissRecordingLock, nowNotice, [blockOkButton]));
  recordButton.addEventListener("click", () => {
    const recording = store.current()?.recordingState === "recording";
    void send(recording ? RUNTIME_MESSAGES.stopRecording : RUNTIME_MESSAGES.startRecording, nowNotice, [recordButton]);
  });

  function render(status: ExtensionStatus): void {
    renderStatusCard(status);
    renderNowCard(status);
  }

  function renderStatusCard(status: ExtensionStatus): void {
    const copy = connectionCopy(status);
    dot.className = `dot dot-${copy.dot}`;
    sentence.textContent = copy.sentence;
    line.textContent = copy.line ?? "";
    line.hidden = copy.line === undefined;
    const state = status.connectionState;
    code.hidden = state !== "pairing";
    code.textContent = status.pairingReferenceCode ?? "------";
    connectButton.hidden = !(state === "disconnected" || state === "error" || state === "reconnecting");
    connectButton.textContent = state === "error" ? "Try again" : state === "reconnecting" ? "Try now" : "Connect";
    cancelButton.hidden = !(state === "connecting" || state === "pairing");
    // A stale failure outlives nothing once the connection is up (audit defect E3).
    if (state === "connected") statusNotice.hidden = true;
  }

  function renderNowCard(status: ExtensionStatus): void {
    const connected = status.connectionState === "connected";
    const recording = status.recordingState === "recording";
    const unsupported = status.unsupportedPage !== undefined;
    const running = status.runtime?.state === "running";
    const block = status.recordingBlock;
    const [title, detail] = nowCopy(status);
    nowTitle.textContent = title;
    nowDetail.textContent = detail;
    recDot.hidden = !recording;
    blockOkButton.hidden = block === undefined;

    recordButton.textContent = recording ? "Stop recording" : "Start recording";
    recordButton.classList.toggle("active", recording);
    const reason = recording ? undefined
      : !connected ? "Connect to FluxIQ to record."
        : unsupported ? "FluxIQ can't record this page."
          : running ? "Wait for FluxIQ to finish."
            : undefined;
    recordButton.disabled = reason !== undefined;
    recordReason.textContent = reason ?? "";
    recordReason.hidden = reason === undefined;

    const extractable = connected && recording && !unsupported;
    extraction.setAvailable(extractable, unsupported ? "This page cannot be recorded." : "Start recording first.");
    extractionHost.dataset.available = String(extractable);
  }

  store.subscribe(render);
  // The store asks once on creation; asking here too is what lets this card say
  // why when the background never answers (audit defect E2).
  void store.request({ type: RUNTIME_MESSAGES.getStatus }).then((result) => {
    if (result.ok) return;
    statusNotice.textContent = result.sentence;
    statusNotice.hidden = false;
  });
  const clock = setInterval(() => {
    const current = store.current();
    if (current?.recordingState === "recording" || current?.runtime?.state === "succeeded") renderNowCard(current);
  }, 1_000);
  window.addEventListener("unload", () => clearInterval(clock));

  return {
    element,
    show() {
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    }
  };
}

function nowCopy(status: ExtensionStatus): [string, string] {
  const block = status.recordingBlock;
  if (block) return [block.title, block.message];
  if (status.recordingState === "recording") return ["Recording your steps", recordingDetail(status)];
  const runtime = status.runtime;
  if (runtime?.state === "running") return ["FluxIQ is working", stepSentence(runtime, "present")];
  if (runtime?.state === "failed") return ["A step didn't work", `${stepSentence(runtime, "past")} didn't work.`];
  if (runtime?.state === "succeeded" && runtime.finishedAt !== undefined && Date.now() - runtime.finishedAt < DONE_WINDOW_MS) {
    return ["Done", `Last step: ${stepSentence(runtime, "past")}`];
  }
  if (status.lastError === "Connect to FluxIQ before recording." && status.connectionState !== "connected") {
    return ["Connect first", errorSentence(status.lastError)];
  }
  // Section 4 says "Ask FluxIQ below, or record the steps yourself."; this
  // placeholder has no conversation card below, so it says only what is true here.
  return ["Nothing running", "Record the steps yourself with Start recording."];
}

function recordingDetail(status: ExtensionStatus): string {
  const seconds = status.recordingStartedAt === undefined ? 0 : Math.max(0, Math.floor((Date.now() - status.recordingStartedAt) / 1_000));
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const steps = status.eventCount === 1 ? "1 step" : `${status.eventCount} steps`;
  const hostname = pageHostname(status.activeTabUrl);
  return hostname === undefined ? `${clock} · ${steps}` : `${clock} · ${steps} on ${hostname}`;
}
