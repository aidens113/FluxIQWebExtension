// The extraction panel's DOM, built into a host the caller chooses.
//
// The panel HTML pages are stubs, so this builds what used to be the
// extraction markup in `popup/index.html`: the "Extract Data From This Page"
// entry button, then the sheet. Every id, class, label and sentence is the one
// that markup had, because the Lab drives them (`#extraction*`, "Extract Data
// From This Page", "Confirm"; packages/test-runner/src/ui-e2e/journeys/
// extraction.ts and field-review.ts). Held apart from the controller so that
// `panel.ts` reads as the flow it is -- start, pick, edit, confirm.
//
// The sheet is `position: fixed` over the whole panel (extraction.css), so the
// host only decides where the entry button sits.

import { createElement } from "../dom";

/** Every element the extraction panel writes to or listens on. */
export type ExtractionPanelElements = {
  openButton: HTMLButtonElement;
  panel: HTMLElement;
  status: HTMLElement;
  notice: HTMLElement;
  entryRecovery: HTMLElement;
  entryRecoveryText: HTMLElement;
  sheetRecovery: HTMLElement;
  body: HTMLElement;
  label: HTMLInputElement;
  summary: HTMLElement;
  fields: HTMLElement;
  /** "Pages": which pages the extraction reads, said in words whether or not more pages were found. */
  pagesNote: HTMLElement;
  /** The sample table, named "Extraction preview" and marked busy while a new sample is being read. */
  previewTable: HTMLElement;
  previewHead: HTMLTableRowElement;
  previewBody: HTMLElement;
  /** Says what the sample is -- current, being refreshed, or left over from a failed read -- as a polite status. */
  previewNote: HTMLElement;
  confirmButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
};

/** Builds the entry button and the sheet, appends both to `host`, and answers the elements. */
export function buildExtractionPanel(host: HTMLElement): ExtractionPanelElements {
  const openButton = createElement("button", {
    id: "extractDataButton",
    className: "small-button extract-button",
    text: "Extract Data From This Page",
    attrs: { type: "button" }
  });
  openButton.disabled = true;

  const status = createElement("p", { id: "extractionStatus", className: "extraction-status", text: "Click one example item on the page.", attrs: { role: "status", tabindex: "-1" } });
  const closeButton = createElement("button", {
    id: "extractionCloseButton",
    className: "icon-button",
    text: "x",
    attrs: { type: "button", title: "Close", "aria-label": "Close" }
  });
  const notice = createElement("p", { id: "extractionNotice", className: "notice warning", hidden: true, attrs: { role: "alert" } });

  const entryRecoveryText = createElement("p", { className: "notice warning", attrs: { role: "alert" } });
  const entryRecovery = createElement("div", { id: "extractionEntryRecovery", hidden: true }, [entryRecoveryText]);
  const sheetRecovery = createElement("div", { id: "extractionSheetRecovery", hidden: true });

  const label = createElement("input", {
    id: "extractionLabel",
    attrs: { type: "text", spellcheck: "false", autocomplete: "off" }
  });
  const summary = createElement("p", { id: "extractionSummary", className: "extraction-summary" });
  const fields = createElement("div", { id: "extractionFields", className: "extraction-fields" });
  const pagesNote = createElement("span", { id: "extractionPagesNote" });
  const previewNote = createElement("span", { id: "extractionPreviewNote", attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
  const previewHead = createElement("tr", { id: "extractionPreviewHead" });
  const previewBody = createElement("tbody", { id: "extractionPreviewBody" });
  const previewTable = createElement("table", { id: "extractionPreviewTable", className: "extraction-preview", attrs: { "aria-label": "Extraction preview", "aria-busy": "false" } }, [
    createElement("thead", {}, [previewHead]),
    previewBody
  ]);

  const body = createElement("div", { id: "extractionBody", className: "extraction-body", hidden: true }, [
    createElement("label", { className: "field" }, [createElement("span", { text: "Dataset name" }), label]),
    summary,
    sectionHeading("Columns", createElement("span", { text: "Rename, remove, or exclude a column." })),
    fields,
    sectionHeading("Pages", pagesNote),
    sectionHeading("Preview", previewNote),
    createElement("div", { className: "extraction-preview-scroll" }, [previewTable])
  ]);

  const cancelButton = createElement("button", { id: "extractionCancelButton", className: "small-button", text: "Cancel", attrs: { type: "button" } });
  const confirmButton = createElement("button", {
    id: "extractionConfirmButton",
    className: "small-button extraction-confirm",
    text: "Confirm",
    attrs: { type: "button" }
  });
  confirmButton.disabled = true;

  const panel = createElement("section", {
    id: "extractionPanel",
    className: "extraction-panel",
    hidden: true,
    attrs: { role: "dialog", tabindex: "-1", "aria-modal": "true", "aria-labelledby": "extractionTitle" }
  }, [
    createElement("header", { className: "extraction-header" }, [
      createElement("div", {}, [createElement("h2", { id: "extractionTitle", text: "Extract Data From This Page" }), status]),
      closeButton
    ]),
    notice,
    sheetRecovery,
    body,
    createElement("footer", { className: "extraction-actions" }, [cancelButton, confirmButton])
  ]);

  host.append(openButton, entryRecovery, panel);
  return {
    openButton,
    panel,
    status,
    notice,
    entryRecovery,
    entryRecoveryText,
    sheetRecovery,
    body,
    label,
    summary,
    fields,
    pagesNote,
    previewTable,
    previewHead,
    previewBody,
    previewNote,
    confirmButton,
    cancelButton,
    closeButton
  };
}

function sectionHeading(title: string, detail: HTMLElement): HTMLElement {
  return createElement("div", { className: "section-heading" }, [
    createElement("div", {}, [createElement("h2", { text: title }), detail])
  ]);
}
