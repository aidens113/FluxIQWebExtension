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
// **D12 is enforced on every edit, on both sides.** The rows this holds are
// passed through `retainExtractionPreview` after each change to the draft, which
// rebuilds them from the columns that may still be shown. Excluding a column
// therefore deletes its values from memory before the next frame is drawn; it
// does not hide them. Un-excluding brings nothing back, because there is nothing
// left to bring, and the column stays out of the preview until the extraction is
// run.
//
// The background worker is the other side, and it is not optional. It is the one
// that reads the page, so it is the only one that can stop reading a column: an
// edit that changes which columns may be shown sends them with `getSession`, and
// the worker re-reads without the excluded one rather than filtering rows it
// already has. A panel that only narrowed its own copy would leave the values
// one `getSession` away from being on screen again.

import type { WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";
import { cancelExtraction, confirmExtraction, readExtractionSession, startExtractionPick } from "./client";
import { extractionConfirmPayload } from "./confirm-payload";
import { extractionFieldRowElement } from "./field-row";
import type { ExtractionConfirmOutcome, ExtractionPreviewRow, ExtractionSessionRefusal, ExtractionSessionView } from "./messages";
import { extractionPanelElements, type ExtractionPanelElements } from "./panel-elements";
import { extractionPreviewColumns, extractionPreviewSelection, retainExtractionPreview } from "./preview";
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
const RECORDED_WITHOUT_COUNT = "The extraction is recorded.";

// One sentence per word the background can put on a session. The `satisfies`
// is the seam check: a refusal the worker can send and this has no sentence for
// fails the build instead of reaching the user as a blank notice.
const REFUSALS = {
  target_not_found: "That element is no longer on the page. Try picking another one.",
  no_repeating_run: "That item is not part of a repeating list. Pick an item inside a list or a table row.",
  value_form_unsupported: "FluxIQ cannot record a single value yet. Pick an item in a repeating list."
} satisfies Record<ExtractionSessionRefusal, string>;

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

  /**
   * The extraction is recorded: say what it captured, and keep the panel open
   * long enough for the person to read it.
   *
   * This used to close the panel the moment Confirm succeeded, so the counts the
   * worker sends back had no reader at all and the first question anyone asks --
   * did it actually get my rows? -- went unanswered by the one screen that knew.
   * The draft and its rows go here, as `close` does it, but the panel stays up
   * with the sentence until the person closes it or starts another pick.
   */
  function captured(outcome: ExtractionConfirmOutcome | undefined): void {
    stopPolling();
    draft = undefined;
    rows = [];
    els.notice.hidden = true;
    els.notice.textContent = "";
    els.status.textContent = outcome === undefined ? RECORDED_WITHOUT_COUNT : capturedSentence(outcome);
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
    // The notice is cleared when the session carries no refusal, so a sentence
    // about a pick that failed does not sit beside the proposal from the pick
    // that then worked.
    if (session.refused !== undefined) {
      els.notice.hidden = false;
      els.notice.textContent = refusalMessage(session.refused);
    } else if (!els.notice.hidden) {
      els.notice.hidden = true;
      els.notice.textContent = "";
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

  /**
   * Every edit runs through here, so no edit can forget to drop what the user
   * just excluded -- and no edit can leave the worker still holding it.
   *
   * `retainExtractionPreview` empties the panel's own copy in the same turn as
   * the edit. The worker's copy is the other half: it read the rows and it is
   * the only side that can stop reading a column, so an edit that changes which
   * columns may be shown asks it to read again without them. Without this, the
   * feature is wired at one end and the preview is the one place a value the
   * user has just marked private would still be showing.
   */
  function edit(next: ExtractionDraft): void {
    const before = shownColumnsKey(draft);
    draft = next;
    rows = retainExtractionPreview(rows, next);
    render();
    if (shownColumnsKey(next) !== before) void rereadPreview(next);
  }

  /**
   * Replaces the rows with a fresh read under the columns `edited` may show.
   *
   * A reply for columns the user has since changed again is dropped rather than
   * rendered: the rows the panel still holds are already narrowed to what may
   * be shown, so the stale answer would add nothing and could add a column back.
   */
  async function rereadPreview(edited: ExtractionDraft): Promise<void> {
    const key = shownColumnsKey(edited);
    try {
      const session = await readExtractionSession(extractionPreviewSelection(edited));
      if (!draft || shownColumnsKey(draft) !== key) return;
      rows = retainExtractionPreview(session?.preview ?? [], draft);
      render();
    } catch (error) {
      fail(error);
    }
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
    captured(await confirmExtraction(extractionConfirmPayload(requireDraft())));
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

/**
 * What a confirmed extraction captured, in the words the person would use.
 *
 * Counts and the name they typed, and nothing read off the page: the reply
 * carries no record, so there is nothing here that could quote one. A read that
 * found nothing says so plainly rather than being dressed up as a success --
 * "0 records" is the answer they need before they build a Flow on it.
 */
function capturedSentence(outcome: ExtractionConfirmOutcome): string {
  const records = outcome.recordCount === 1 ? "1 record" : `${outcome.recordCount} records`;
  const pages = outcome.pagesRead > 1 ? ` from ${outcome.pagesRead} pages` : "";
  const stopped = outcome.truncated ? " It stopped at FluxIQ's limit, so the page may hold more." : "";
  return outcome.recordCount === 0
    ? `Recorded "${outcome.label}", but the page returned no records. Check the columns and pick again if that is wrong.`
    : `Captured ${records}${pages} into "${outcome.label}".${stopped}`;
}

/** The columns whose values the panel may currently show, as one comparable string. A draft with none, and no draft at all, are both "". */
function shownColumnsKey(draft: ExtractionDraft | undefined): string {
  return draft === undefined ? "" : extractionPreviewColumns(draft).map((field) => field.sourceKey).join(",");
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

/** The guard survives the typing: a worker from an older build can still send a word this one has never heard of. */
function refusalMessage(refused: string): string {
  return refused in REFUSALS ? REFUSALS[refused as ExtractionSessionRefusal] : GENERIC_REFUSAL;
}
