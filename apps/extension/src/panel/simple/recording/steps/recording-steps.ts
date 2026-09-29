// The steps of the recording in progress, newest first, each with a Remove
// button (plan 3.3: "event feedback", "remove mistaken steps").
//
// Shown only while recording, paused included. Whenever the status's event
// count moves, the newest page of the recording log is read again; a reply
// that arrives after a newer read was sent, or after the recording ended, is
// dropped. A failed read keeps the list as it was: the next event reads again.

import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { createElement } from "../../../dom";
import type { PanelViewContext } from "../../../shell";
import { SIMPLE_RELAY_MESSAGES } from "../../relay";
import { stepRows, type StepRow } from "./step-rows";
import { reduceSteps, type StepsEvent, type StepsModel } from "./steps-model";
import "../recording.css";

/** The mounted step list. */
export type RecordingSteps = { readonly element: HTMLElement; render(status: ExtensionStatus): void };

/** How many of the newest log entries are read for the list. */
const LOG_PAGE_SIZE = 5;

/** Creates the step list; the owner calls `render` with every status. */
export function createRecordingSteps(context: PanelViewContext): RecordingSteps {
  const { request } = context.store;
  const heading = createElement("p", { className: "recording-heading", text: "Recording" });
  // SEAM(t180): pause/resume. The Pause (and Resume) control goes here, in the
  // header beside the heading; lane t180 designs its message. Until then
  // "paused" is shown as a recording still in progress, headed "Recording paused".
  const header = createElement("div", { className: "recording-header" }, [heading]);
  const empty = createElement("p", { className: "recording-empty", text: "Your steps will show here as you go." });
  const list = createElement("ol", { className: "recording-list", attrs: { "aria-label": "Recorded steps, newest first" } });
  const notice = createElement("p", { className: "notice recording-notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("section", { className: "card recording-steps", hidden: true, attrs: { "aria-label": "Recorded steps" } }, [
    header,
    empty,
    list,
    notice
  ]);

  let model: StepsModel = reduceSteps(undefined, { type: "recordingEnded" });
  let showing = false;
  let eventCount: number | undefined;
  let readSequence = 0;

  function dispatch(event: StepsEvent): void {
    model = reduceSteps(model, event);
    draw();
  }

  function readLog(): void {
    const sequence = ++readSequence;
    void request<unknown>({ type: RUNTIME_MESSAGES.getRecordingLog, page: 1, pageSize: LOG_PAGE_SIZE }).then((result) => {
      if (sequence !== readSequence || !showing || !result.ok) return;
      dispatch({ type: "logRead", rows: stepRows(result.value) });
    });
  }

  function remove(id: string): void {
    if (!model.removable || model.removing.includes(id)) return;
    dispatch({ type: "removeStarted", id });
    void request<unknown>({ type: SIMPLE_RELAY_MESSAGES.removeRecordingStep, entryId: id }).then((result) => {
      if (!showing) return;
      dispatch({ type: "removeFinished", id, result });
      if (result.ok) readLog();
    });
  }

  function rowElement(row: StepRow): HTMLElement {
    const words = row.detail === undefined ? row.label : `${row.label} ${row.detail}`;
    const parts: Node[] = [createElement("span", { className: "recording-step-label", text: row.label })];
    if (row.detail !== undefined) parts.push(createElement("span", { className: "recording-step-detail", text: row.detail }));
    const button = createElement("button", {
      className: "small-button recording-remove",
      text: "Remove",
      hidden: !model.removable,
      attrs: { type: "button", "aria-label": `Remove step: ${words}` }
    });
    button.disabled = model.removing.includes(row.id);
    button.addEventListener("click", () => remove(row.id));
    return createElement("li", { className: "recording-step" }, [createElement("span", { className: "recording-step-words" }, parts), button]);
  }

  function draw(): void {
    empty.hidden = model.rows.length > 0;
    list.hidden = model.rows.length === 0;
    list.replaceChildren(...model.rows.map(rowElement));
    notice.textContent = model.notice?.sentence ?? "";
    notice.title = model.notice?.detail ?? "";
    notice.hidden = model.notice === undefined;
  }

  return {
    element,
    render(status) {
      const recording = status.recordingState === "recording" || status.recordingState === "paused";
      if (!recording) {
        if (showing) {
          showing = false;
          eventCount = undefined;
          readSequence++;
          dispatch({ type: "recordingEnded" });
        }
        element.hidden = true;
        return;
      }
      if (!showing) {
        showing = true;
        draw();
      }
      element.hidden = false;
      heading.textContent = status.recordingState === "paused" ? "Recording paused" : "Recording";
      if (status.eventCount !== eventCount) {
        eventCount = status.eventCount;
        readLog();
      }
    }
  };
}
