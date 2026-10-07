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

import { cancelExtraction, confirmExtraction, readExtractionSession, startExtractionPick } from "./client";
import { createElement } from "../dom";
import { createExtractionReadRecovery, type ExtractionRecoveryTicket } from "./read-recovery";
import { createExtractionDialogFocus } from "./dialog-focus";
import { extractionConfirmPayload } from "./confirm-payload";
import { extractionFieldRowElement } from "./field-row";
import type { ExtractionConfirmOutcome, ExtractionPreviewRow, ExtractionSessionRefusal, ExtractionSessionIdentity, ExtractionSessionView } from "./messages";
import { buildExtractionPanel, type ExtractionPanelElements } from "./panel-elements";
import { extractionPreviewColumns, extractionPreviewSelection, retainExtractionPreview } from "./preview";
import { renderExtractionPreview } from "./preview-table";
import {
  extractionDraftFromProposal,
  removeExtractionField,
  renameExtractionField,
  setExtractionFieldHandling,
  setExtractionFieldKind,
  type ExtractionDraft
} from "./view-model";
import "./extraction.css";

/** What the view that mounted the panel holds (pinned by the UI audit, section 5). */
export type ExtractionPanelHandle = {
  /** Enables the entry point, or disables it with `reason` as its tooltip. */
  setAvailable(available: boolean, reason?: string): void;
};

/**
 * What the host may add to the panel's own behaviour.
 *
 * `prepare` runs when the entry is pressed, before the pick starts. Extraction
 * is recorded into a recording, so the panel's entry (`panel/recording`) uses it to
 * start one when none is running -- the extraction then compiles into the
 * recording's Flow like any other step, instead of bypassing it (plan 3.7).
 * A `prepare` that throws stops the pick, and its message is shown in the sheet.
 */
export type ExtractionPanelOptions = { prepare?: (() => Promise<void>) | undefined };

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

/**
 * Builds the extraction panel into `host` -- the entry button where the host
 * sits, the sheet over the whole panel -- wires it, and answers a handle for
 * the entry point.
 */
export function mountExtractionPanel(host: HTMLElement, options: ExtractionPanelOptions = {}): ExtractionPanelHandle {
  const els = buildExtractionPanel(host);
  let draft: ExtractionDraft | undefined;
  let rows: ExtractionPreviewRow[] = [];
  // Raw typing survives redraw without changing settled record names per keystroke.
  const rawNames = new Map<string, string>();
  let fieldGeneration = 0;
  let busy = false;
  let epoch = 0;
  let identity: ExtractionSessionIdentity | undefined;
  let noticeOwner: object | undefined;
  const refusalOwner = {};
  let retryButton: HTMLButtonElement | undefined;
  let retryTicket: ExtractionRecoveryTicket | undefined;
  // How many sample rows the table holds now; the preview note describes them.
  let previewShown = 0;
  const dialog = createExtractionDialogFocus(els.panel, {
    initial: () => draft && !busy ? els.label : els.status,
    returnTo: () => !els.openButton.disabled && !els.openButton.closest("[hidden]") && els.openButton.getClientRects().length > 0 ? els.openButton : document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? undefined,
    busy: () => busy,
    dismiss: () => cancel()
  });

  const recovery = createExtractionReadRecovery({ read: readExtractionSession, start: startExtractionPick, prepare: options.prepare }, {
    epoch: () => epoch, identity: () => identity, acceptIdentity: next => { identity ??= next; }, busy: () => busy, selection: () => draft && extractionPreviewSelection(draft),
    runBusy: (work) => run(async () => work()),
    acceptSession: (session, restore) => { applySession(session); if (restore && (draft || session?.state === "picking" || session?.state === "picked")) { dialog.open(); drawRecovery(); } },
    acceptPreview: (session) => { if (draft) { rows = retainExtractionPreview(session?.preview ?? [], draft); render(); } },
    showError: (ticket, sentence) => { noticeOwner = ticket; els.notice.textContent = sentence; els.notice.hidden = false; },
    clearError: (ticket) => { if (noticeOwner === ticket) { noticeOwner = undefined; els.notice.hidden = true; els.notice.textContent = ""; } },
    onChange: () => drawRecovery()
  });

  function drawRecovery(): void {
    dialog.render(() => {
      const { ticket, pending, previewPending, previewFailed } = recovery.state();
      drawPreviewNote(els, draft, previewShown, previewPending, previewFailed);
      if (ticket !== retryTicket) {
        retryButton?.remove(); retryButton = undefined; retryTicket = ticket;
        if (ticket) {
          const captured = ticket;
          retryButton = createElement("button", { id: "extractionReadRetry", className: "small-button", text: ticket.label, attrs: { type: "button" } });
          const button = retryButton;
          button.addEventListener("click", () => { if (button === retryButton && !button.disabled) void recovery.retry(captured); });
        }
      }
      els.entryRecovery.hidden = !ticket || !els.panel.hidden;
      els.sheetRecovery.hidden = !ticket || els.panel.hidden;
      els.entryRecoveryText.textContent = ticket?.sentence ?? "";
      if (retryButton) {
        retryButton.disabled = pending;
        retryButton.textContent = pending ? (ticket?.stage === "preview" ? "Refreshing preview..." : "Trying again...") : ticket?.label ?? "Retry";
        const parent = els.panel.hidden ? els.entryRecovery : els.sheetRecovery;
        parent.setAttribute("aria-busy", String(pending));
        if (retryButton.parentElement !== parent) parent.append(retryButton);
      }
    });
  }

  /** Forgets the pick. Every previewed value leaves memory here, not on the next render. */
  function close(): void {
    epoch++;
    busy = false;
    recovery.reset();
    identity = undefined;
    draft = undefined;
    rawNames.clear();
    rows = [];
    dialog.close();
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
    epoch++;
    busy = false;
    recovery.reset();
    identity = undefined;
    draft = undefined;
    rawNames.clear();
    rows = [];
    els.notice.hidden = true;
    els.notice.textContent = "";
    els.status.textContent = outcome === undefined ? RECORDED_WITHOUT_COUNT : capturedSentence(outcome);
    render();
  }

  function fail(error: unknown): void {
    noticeOwner = {};
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
      noticeOwner = refusalOwner; els.notice.hidden = false; els.notice.textContent = refusalMessage(session.refused);
    } else if (noticeOwner === refusalOwner) { noticeOwner = undefined; els.notice.hidden = true; els.notice.textContent = ""; }
    if (session.state === "recorded") {
      close();
      return;
    }
    if (session.state !== "picked" || !session.proposal) {
      els.status.textContent = PICK_PROMPT;
      recovery.startPolling();
      render();
      return;
    }
    recovery.stopPolling();
    if (!draft) {
      draft = extractionDraftFromProposal(session.proposal, DEFAULT_LABEL);
      rows = retainExtractionPreview(session.preview ?? [], draft);
    }
    els.status.textContent = "Check the columns, then confirm.";
    render();
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
    for (const key of rawNames.keys()) if (!next.fields.some(field => field.sourceKey === key)) rawNames.delete(key);
    rows = retainExtractionPreview(rows, next);
    render();
    if (shownColumnsKey(next) !== before) void recovery.refreshPreview(extractionPreviewSelection(next));
  }

  function render(): void {
    const token = epoch, generation = ++fieldGeneration;
    const editable = (key: string) => token === epoch && generation === fieldGeneration && !busy && draft?.fields.some(field => field.sourceKey === key) === true;
    dialog.render(() => {
      els.body.hidden = !draft;
      els.confirmButton.disabled = busy || !draft || draft.fields.length === 0;
      els.cancelButton.disabled = busy;
      els.closeButton.disabled = busy;
      if (!draft) {
        els.label.value = "";
        els.fields.replaceChildren();
        els.previewHead.replaceChildren();
        els.previewBody.replaceChildren();
        previewShown = 0;
        return;
      }
      if (els.label.value !== draft.label) els.label.value = draft.label;
      els.summary.textContent = summaryLabel(draft);
      els.fields.replaceChildren(...draft.fields.map((field) => extractionFieldRowElement({ ...field, label: rawNames.get(field.sourceKey) ?? field.label }, {
        inputName: (key, raw) => { if (editable(key)) rawNames.set(key, raw); },
        rename: (key, label) => {
          if (!editable(key)) return;
          const settled = (rawNames.get(key) ?? label).trim() || requireDraft().fields.find(field => field.sourceKey === key)!.label;
          rawNames.delete(key); edit(renameExtractionField(requireDraft(), key, settled));
        },
        changeKind: (key, kind) => { if (editable(key)) edit(setExtractionFieldKind(requireDraft(), key, kind)); },
        changeHandling: (key, handling) => { if (editable(key)) edit(setExtractionFieldHandling(requireDraft(), key, handling)); },
        remove: (key) => { if (editable(key)) edit(removeExtractionField(requireDraft(), key)); }
      })));
      for (const control of els.body.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")) control.disabled = busy;
      els.pagesNote.textContent = pagesSentence(draft);
      previewShown = renderExtractionPreview(els.previewHead, els.previewBody, extractionPreviewColumns(draft), rows);
    });
    drawRecovery();
  }

  function requireDraft(): ExtractionDraft {
    if (!draft) throw new Error("The extraction panel has no proposal to edit.");
    return draft;
  }

  async function run(work: (token: number) => Promise<void>): Promise<void> {
    if (busy) return;
    const token = epoch;
    busy = true;
    render();
    try {
      await work(token);
    } catch (error) {
      if (token === epoch) fail(error);
    } finally {
      if (token === epoch) { busy = false; render(); }
    }
  }

  els.openButton.addEventListener("click", () => {
    if (busy || !els.panel.hidden) return;
    epoch++;
    identity = undefined;
    els.notice.hidden = true;
    els.status.textContent = PICK_PROMPT;
    draft = undefined;
    rawNames.clear();
    rows = [];
    dialog.open();
    recovery.reset();
    void recovery.beginPick();
  });

  els.label.addEventListener("input", () => {
    if (draft && !busy) draft = { ...draft, label: els.label.value };
  });

  els.confirmButton.addEventListener("click", () => {
    if (busy || !draft || !identity) return;
    draft = { ...draft, fields: draft.fields.map(field => ({ ...field, label: rawNames.has(field.sourceKey) ? rawNames.get(field.sourceKey)!.trim() || field.label : field.label })) };
    rawNames.clear();
    const payload = extractionConfirmPayload(draft), selected = identity;
    epoch++;
    recovery.reset();
    void run(async (token) => {
      const outcome = await confirmExtraction(payload, selected);
      if (token === epoch) captured(outcome);
    });
  });

  function cancel(): void {
    if (busy) return;
    const selected = identity;
    if (!selected) { close(); return; }
    epoch++;
    recovery.reset();
    draft = undefined;
    rawNames.clear();
    rows = [];
    els.notice.hidden = true;
    els.status.textContent = "Cancelling extraction...";
    void run(async (token) => {
      await cancelExtraction(selected);
      if (token === epoch) close();
    });
  }
  for (const button of [els.cancelButton, els.closeButton]) button.addEventListener("click", cancel);
  void recovery.refresh(true);

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

/**
 * The note beside the sample, which says whether the rows under it are current.
 *
 * Every recovery change reaches this (through `drawRecovery`), not only table
 * redraws, because the automatic re-read after a column edit changes no rows
 * until it settles: without it the note would show the old count as current
 * while the new read is still pending. The note is a polite status, and is only
 * rewritten when its words change, so a redraw is not announced twice.
 */
function drawPreviewNote(els: ExtractionPanelElements, draft: ExtractionDraft | undefined, shown: number, pending: boolean, failed: boolean): void {
  const text = draft === undefined ? "" : previewSentence(draft, shown, pending, failed);
  if (els.previewNote.textContent !== text) els.previewNote.textContent = text;
  els.previewTable.setAttribute("aria-busy", String(draft !== undefined && pending));
}

function previewSentence(draft: ExtractionDraft, shown: number, pending: boolean, failed: boolean): string {
  const rows = `${shown} ${shown === 1 ? "row" : "rows"} below ${shown === 1 ? "is" : "are"} from the last read.`;
  const sample = pending
    ? shown === 0 ? "Refreshing preview..." : `Refreshing preview... The ${rows}`
    : failed
      ? shown === 0 ? "The preview was not refreshed, so no sample is shown for these columns." : `The preview was not refreshed. The ${rows}`
      : shown === 0
        ? "No preview was read for these columns."
        : `Showing ${shown} of ${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"}.`;
  const hidden = draft.fields.length - extractionPreviewColumns(draft).length;
  const withheld = hidden === 0
    ? ""
    : ` ${hidden} ${hidden === 1 ? "column is" : "columns are"} not previewed: an excluded column is never read, and one changed since the preview was taken is re-read when the extraction runs.`;
  return `${sample}${withheld}`;
}

function summaryLabel(draft: ExtractionDraft): string {
  const excluded = draft.fields.filter((field) => field.handling === "exclude").length;
  const kept = draft.fields.length - excluded;
  const items = `${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"} found`;
  const columns = `${kept} ${kept === 1 ? "column" : "columns"}`;
  return excluded === 0 ? `${items}, ${columns}.` : `${items}, ${columns}, ${excluded} excluded.`;
}

/**
 * What the recorded read covers, in words (plan 3.7, "Pages"). It reads the
 * current page only (S5); a list that goes on is read further by a Next page
 * step and a repeat, which the sentence says rather than offering a switch.
 */
function pagesSentence(draft: ExtractionDraft): string {
  if (draft.pagination === undefined) return "Current page only: FluxIQ found no link to more pages.";
  return "Current page only. The list goes on: a Next page step after this one reads the pages that follow.";
}

/** The guard survives the typing: a worker from an older build can still send a word this one has never heard of. */
function refusalMessage(refused: string): string {
  return refused in REFUSALS ? REFUSALS[refused as ExtractionSessionRefusal] : GENERIC_REFUSAL;
}
