// The start card: Simple Mode's three ways in (plan 3.1 "Primary Screen", plan
// 4.2 step 4) -- describe an automation, show FluxIQ how, extract data from this
// page -- in one card, each with a line saying what it does or why it can't.
//
//   Describe an automation   moves focus to the conversation's composer
//   Show FluxIQ how          the manual actions row ("Start recording")
//   Extract data             the extraction sheet's entry ("Extract Data From
//                            This Page"), which starts a recording first when
//                            none is running (`extract-control.ts`)
//
// The extraction sheet is mounted here once and stays in the DOM, so a sheet
// already open is never torn away mid-pick by a status change.

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import { mountExtractionPanel } from "../../extraction";
import type { PanelViewContext } from "../../shell";
import { createManualActions } from "../manual-actions";
import { extractControl } from "./extract-control";

/** The mounted start card. */
export type StartCard = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
};

/** Creates the start card; `describe` moves the person to the conversation's composer. */
export function createStartCard(context: PanelViewContext, describe: () => void): StartCard {
  const { store } = context;
  const manual = createManualActions(context);
  const describeButton = createElement("button", { id: "describeAutomationButton", className: "small-button", text: "Describe an automation", attrs: { type: "button" } });
  describeButton.addEventListener("click", describe);
  const extractLine = createElement("p", { id: "extractDataLine", className: "card-line" });
  const extractionHost = createElement("div", { className: "simple-extraction" });
  let latest: ExtensionStatus | undefined;
  const extraction = mountExtractionPanel(extractionHost, { prepare: startRecordingIfIdle });

  const element = createElement("section", { className: "card simple-start", attrs: { "aria-label": "What should FluxIQ do?" } }, [
    createElement("h2", { className: "card-title", text: "What should FluxIQ do?" }),
    createElement("div", { className: "simple-option", attrs: { role: "group", "aria-label": "Describe it" } }, [
      createElement("p", { className: "simple-option-title", text: "Describe it" }),
      createElement("p", { className: "card-line", text: "Say what you want done, in your own words." }),
      describeButton
    ]),
    manual.element,
    createElement("div", { className: "simple-option", attrs: { role: "group", "aria-label": "Extract data" } }, [
      createElement("p", { className: "simple-option-title", text: "Extract data" }),
      extractLine,
      extractionHost
    ])
  ]);

  /** Extraction is recorded into a recording; with none running, one is started first. */
  async function startRecordingIfIdle(): Promise<void> {
    if (latest?.recordingState === "recording") return;
    const result = await store.request({ type: RUNTIME_MESSAGES.startRecording });
    if (!result.ok) throw new Error(result.sentence);
  }

  return {
    element,
    render(status) {
      latest = status;
      manual.render(status);
      const control = extractControl(status);
      extraction.setAvailable(!control.disabled, control.line);
      extractLine.textContent = control.line;
    }
  };
}
