// The extraction panel: start a pick, show what was found, let the user settle
// the columns, confirm or cancel.
//
// The panel owns no truth about the pick. The session lives in the background
// worker, and this reads it back with `getSession` -- on mount, and on a timer
// while the user is still choosing an item. That is not defensiveness: in
// Firefox the popup is destroyed the moment the user clicks the page, so a panel
// that remembered its own pick would have nothing to remember. Reopening it
// re-reads the session and the user carries on where they were, and the Chrome
// side panel, which is never destroyed, takes the same path.
//
// **D12 is enforced on every edit.** The rows this holds are passed through
// `retainExtractionPreview` after each change to the draft, which rebuilds them
// from the columns that may still be shown. Excluding a column therefore deletes
// its values from memory before the next frame is drawn; it does not hide them.
// Un-excluding brings nothing back, because there is nothing left to bring, and
// the column stays out of the preview until the extraction is run.

import type { WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";
import type { ExtractionProposeRefusal } from "../../shared/extraction-messages";
import { cancelExtraction, confirmExtraction, readExtractionSession, startExtractionPick } from "./client";
import { extractionConfirmPayload } from "./confirm-payload";
import { extractionFieldRowElement } from "./field-row";
import type { ExtractionPreviewRow, ExtractionSessionView } from "./messages";
import { extractionPanelElements, type ExtractionPanelElements } from "./panel-elements";
import { extractionPreviewColumns, retainExtractionPreview } from "./preview";
import { renderExtractionPreview } from "./preview-table";
import {
  extractionDraftFromProposal,
  removeExtractionField,
  renameExtractionField,
  setExtractionFieldHandling,
  setExtractionFieldKind,
  setExtractionPaginate,
  type ExtractionDraft
} from "./view-model";

/** What `popup/index.ts` holds once the panel is mounted. */
export type ExtractionPanelHandle = {
  /** Enables the entry point. Extraction is recorded into a recording, so it is offered only while one is running. */
  setAvailable(available: boolean, reason?: string): void;
};

const POLL_MS = 600;
const DEFAULT_LABEL = "Extracted data";
const PICK_PROMPT = "Click one example item on the page -- a product, a row, a card. FluxIQ finds the rest.";
const GENERIC_REFUSAL = "FluxIQ could not read a repeating list from that item.";

const REFUSALS = {
  target_not_found: "That element is no longer on the page. Try picking another one.",
  no_repeating_run: "That item is not part of a repeating list. Pick an item inside a list or a table row."
} satisfies Record<ExtractionProposeRefusal, string>;

/** Wires the extraction panel into the popup document and answers a handle for the entry point. */
export function mountExtractionPanel(): ExtractionPanelHandle {
  const els = extractionPanelElements();
  let draft: ExtractionDraft | undefined;
  let rows: ExtractionPreviewRow[] = [];
  let polling: ReturnType<typeof setInterval> | undefined;
  let busy = false;

  function stopPolling(): void {
    if (polling !== undefined) clearInterval(polling);
    polling = undefined;
  }

  function startPolling(): void {
    if (polling === undefined) polling = setInterval(() => void refresh(), POLL_MS);
  }

  /** Forgets the pick. Every previewed value leaves memory here, not on the next render. */
  function close(): void {
    stopPolling();
    draft = undefined;
    rows = [];
    els.panel.hidden = true;
    els.notice.hidden = true;
    render();
  }

  function fail(error: unknown): void {
    els.notice.hidden = false;
    els.notice.textContent = error instanceof Error ? error.message : "The extraction panel hit an unexpected problem.";
  }

  function applySession(session: ExtractionSessionView | undefined): void {
    if (!session) {
      if (els.panel.hidden) return;
      close();
      return;
    }
    if (session.refused !== undefined) {
      els.notice.hidden = false;
      els.notice.textContent = refusalMessage(session.refused);
    }
    if (session.state === "recorded") {
      close();
      return;
    }
    if (session.state !== "picked" || !session.proposal) {
      els.status.textContent = PICK_PROMPT;
      startPolling();
      render();
      return;
    }
    stopPolling();
    if (!draft) {
      draft = extractionDraftFromProposal(session.proposal, DEFAULT_LABEL);
      rows = retainExtractionPreview(session.preview ?? [], draft);
    }
    els.status.textContent = "Check the columns, then confirm.";
    render();
  }

  async function refresh(): Promise<void> {
    try {
      applySession(await readExtractionSession());
    } catch (error) {
      stopPolling();
      fail(error);
    }
  }

  /** Every edit runs through here, so no edit can forget to drop what the user just excluded. */
  function edit(next: ExtractionDraft): void {
    draft = next;
    rows = retainExtractionPreview(rows, next);
    render();
  }

  function render(): void {
    els.body.hidden = !draft;
    els.confirmButton.disabled = busy || !draft || draft.fields.length === 0;
    els.cancelButton.disabled = busy;
    if (!draft) return;
    if (els.label.value !== draft.label) els.label.value = draft.label;
    els.summary.textContent = summaryLabel(draft);
    els.fields.replaceChildren(...draft.fields.map((field) => extractionFieldRowElement(field, {
      rename: (key, label) => edit(renameExtractionField(requireDraft(), key, label)),
      changeKind: (key, kind) => edit(setExtractionFieldKind(requireDraft(), key, kind)),
      changeHandling: (key, handling) => edit(setExtractionFieldHandling(requireDraft(), key, handling)),
      remove: (key) => edit(removeExtractionField(requireDraft(), key))
    })));
    renderPagination(els, draft);
    renderPreview(els, draft, rows);
  }

  function requireDraft(): ExtractionDraft {
    if (!draft) throw new Error("The extraction panel has no proposal to edit.");
    return draft;
  }

  async function run(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      render();
    }
  }

  els.openButton.addEventListener("click", () => void run(async () => {
    els.panel.hidden = false;
    els.notice.hidden = true;
    els.status.textContent = PICK_PROMPT;
    draft = undefined;
    rows = [];
    await startExtractionPick();
    startPolling();
  }));

  els.label.addEventListener("input", () => {
    if (draft) draft = { ...draft, label: els.label.value };
  });

  els.paginate.addEventListener("change", () => {
    if (draft) edit(setExtractionPaginate(draft, els.paginate.checked));
  });

  els.confirmButton.addEventListener("click", () => void run(async () => {
    await confirmExtraction(extractionConfirmPayload(requireDraft()));
    close();
  }));

  for (const button of [els.cancelButton, els.closeButton]) {
    button.addEventListener("click", () => void run(async () => {
      close();
      await cancelExtraction();
    }));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || els.panel.hidden) return;
    void run(async () => {
      close();
      await cancelExtraction();
    });
  });

  void refresh().then(() => {
    if (draft || polling !== undefined) els.panel.hidden = false;
  });
  render();

  return {
    setAvailable(available, reason) {
      els.openButton.disabled = !available;
      els.openButton.title = available ? "Pick an example item and FluxIQ records the whole list" : reason ?? "Start recording first.";
    }
  };
}

function renderPagination(els: ExtractionPanelElements, draft: ExtractionDraft): void {
  els.paginateRow.hidden = draft.pagination === undefined;
  if (draft.pagination === undefined) return;
  els.paginate.checked = draft.paginate;
  els.paginateLabel.textContent = paginationLabel(draft.pagination);
}

function renderPreview(els: ExtractionPanelElements, draft: ExtractionDraft, rows: readonly ExtractionPreviewRow[]): void {
  const columns = extractionPreviewColumns(draft);
  const shown = renderExtractionPreview(els.previewHead, els.previewBody, columns, rows);
  const hidden = draft.fields.length - columns.length;
  const sample = shown === 0
    ? "No preview was read for these columns."
    : `Showing ${shown} of ${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"}.`;
  const withheld = hidden === 0
    ? ""
    : ` ${hidden} ${hidden === 1 ? "column is" : "columns are"} not previewed: an excluded column is never read, and one changed since the preview was taken is re-read when the extraction runs.`;
  els.previewNote.textContent = `${sample}${withheld}`;
}

function summaryLabel(draft: ExtractionDraft): string {
  const excluded = draft.fields.filter((field) => field.handling === "exclude").length;
  const kept = draft.fields.length - excluded;
  const items = `${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"} found`;
  const columns = `${kept} ${kept === 1 ? "column" : "columns"}`;
  return excluded === 0 ? `${items}, ${columns}.` : `${items}, ${columns}, ${excluded} excluded.`;
}

function paginationLabel(pagination: WebAutomationExtractListPagination): string {
  switch (pagination.mode) {
    case "loadMore":
      return `Read every page, pressing the load-more control up to ${pagination.maxPages} times`;
    case "scroll":
      return `Read every page, scrolling up to ${pagination.maxScrolls} times`;
    case "numbered":
      return `Read every page, following the numbered page links, up to ${pagination.maxPages} pages`;
    default:
      return `Read every page, following the next-page link, up to ${pagination.maxPages} pages`;
  }
}

function refusalMessage(refused: string): string {
  return refused in REFUSALS ? REFUSALS[refused as ExtractionProposeRefusal] : GENERIC_REFUSAL;
}
