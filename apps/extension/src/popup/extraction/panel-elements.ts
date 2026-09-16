// The extraction panel's elements, looked up once and typed.
//
// Held apart from the controller so that `panel.ts` reads as the flow it is --
// start, pick, edit, confirm -- rather than opening with twenty
// `getElementById` calls. The ids are the ones in `popup/index.html` and
// `sidepanel/index.html`, which are the same file; a missing id throws here,
// naming itself, instead of failing as `null` somewhere later.

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

/** Looks the panel's elements up in the document the popup and the side panel share. */
export function extractionPanelElements(): ExtractionPanelElements {
  return {
    openButton: element<HTMLButtonElement>("extractDataButton"),
    panel: element<HTMLElement>("extractionPanel"),
    status: element<HTMLElement>("extractionStatus"),
    notice: element<HTMLElement>("extractionNotice"),
    body: element<HTMLElement>("extractionBody"),
    label: element<HTMLInputElement>("extractionLabel"),
    summary: element<HTMLElement>("extractionSummary"),
    fields: element<HTMLElement>("extractionFields"),
    paginateRow: element<HTMLElement>("extractionPaginateRow"),
    paginate: element<HTMLInputElement>("extractionPaginate"),
    paginateLabel: element<HTMLElement>("extractionPaginateLabel"),
    previewHead: element<HTMLTableRowElement>("extractionPreviewHead"),
    previewBody: element<HTMLElement>("extractionPreviewBody"),
    previewNote: element<HTMLElement>("extractionPreviewNote"),
    confirmButton: element<HTMLButtonElement>("extractionConfirmButton"),
    cancelButton: element<HTMLButtonElement>("extractionCancelButton"),
    closeButton: element<HTMLButtonElement>("extractionCloseButton")
  };
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing extraction panel element: ${id}`);
  return found as T;
}
