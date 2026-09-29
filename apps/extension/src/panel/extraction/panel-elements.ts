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
  body: HTMLElement;
  label: HTMLInputElement;
  summary: HTMLElement;
  fields: HTMLElement;
  paginateRow: HTMLElement;
  paginate: HTMLInputElement;
  paginateLabel: HTMLElement;
  previewHead: HTMLTableRowElement;
  previewBody: HTMLElement;
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

  const status = createElement("p", { id: "extractionStatus", className: "extraction-status", text: "Click one example item on the page." });
  const closeButton = createElement("button", {
    id: "extractionCloseButton",
    className: "icon-button",
    text: "x",
    attrs: { type: "button", title: "Close", "aria-label": "Close" }
  });
  const notice = createElement("p", { id: "extractionNotice", className: "notice warning", hidden: true });

  const label = createElement("input", {
    id: "extractionLabel",
    attrs: { type: "text", spellcheck: "false", autocomplete: "off" }
  });
  const summary = createElement("p", { id: "extractionSummary", className: "extraction-summary" });
  const fields = createElement("div", { id: "extractionFields", className: "extraction-fields" });
  const paginate = createElement("input", { id: "extractionPaginate", attrs: { type: "checkbox" } });
  const paginateLabel = createElement("span", { id: "extractionPaginateLabel", text: "Read every page" });
  const paginateRow = createElement("label", { id: "extractionPaginateRow", className: "extraction-paginate", hidden: true }, [paginate, paginateLabel]);
  const previewNote = createElement("span", { id: "extractionPreviewNote" });
  const previewHead = createElement("tr", { id: "extractionPreviewHead" });
  const previewBody = createElement("tbody", { id: "extractionPreviewBody" });

  const body = createElement("div", { id: "extractionBody", className: "extraction-body", hidden: true }, [
    createElement("label", { className: "field" }, [createElement("span", { text: "Dataset name" }), label]),
    summary,
    sectionHeading("Columns", createElement("span", { text: "Rename, remove, or exclude a column." })),
    fields,
    paginateRow,
    sectionHeading("Preview", previewNote),
    createElement("div", { className: "extraction-preview-scroll" }, [
      createElement("table", { className: "extraction-preview" }, [createElement("thead", {}, [previewHead]), previewBody])
    ])
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
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "extractionTitle" }
  }, [
    createElement("header", { className: "extraction-header" }, [
      createElement("div", {}, [createElement("h2", { id: "extractionTitle", text: "Extract Data From This Page" }), status]),
      closeButton
    ]),
    notice,
    body,
    createElement("footer", { className: "extraction-actions" }, [cancelButton, confirmButton])
  ]);

  host.append(openButton, panel);
  return {
    openButton,
    panel,
    status,
    notice,
    body,
    label,
    summary,
    fields,
    paginateRow,
    paginate,
    paginateLabel,
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
