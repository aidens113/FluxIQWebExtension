// D12 across the seam: what the *background worker* is still holding after the
// user excludes a column.
//
// `preview.test.ts` covers the panel's own copy. This covers the other half,
// which no test could reach while the panel sent nothing: the worker reads the
// rows, so only the worker can stop reading a column, and a panel that drops a
// value locally while the worker keeps reading it leaves the excluded column one
// `getSession` away from being displayed again.
//
// The worker here is the real one. `handleExtractionControl` is driven through a
// `chrome.runtime.sendMessage` stub, so the panel's own client builds the
// message and the worker's own router reads it -- which is the point, since both
// known defects in this feature were a sender and a receiver that agreed on
// nothing. The subject is the panel; the worker is the collaborator it is
// measured against, and a fake page stands in for the frame.

import assert from "node:assert/strict";
import test from "node:test";

import { ExtractionSessions, handleExtractionControl, type ExtractionControlDeps } from "../../../background/extraction";
import type { FluxIQConnection } from "../../../background/connection";
import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_PICKED_MESSAGE, EXTRACTION_RUNTIME_MESSAGES } from "../../../shared/extraction-messages";
import { confirmExtraction, readExtractionSession } from "../client";
import { extractionPreviewSelection } from "../preview";
import { extractionConfirmPayload } from "../confirm-payload";
import { extractionDraftFromProposal, renameExtractionField, setExtractionFieldHandling, type ExtractionDraft } from "../view-model";
import { proposalFixture } from "./proposal-fixture";

const AUTOMATION_TAB = 11;

/** Every cell the fake page returns carries the column's key, so a row says which columns were read. */
function cell(key: string): string {
  return `page-value-${key}`;
}

type Wired = { reads: string[][]; sessions: ExtractionSessions };

/**
 * A background worker behind `chrome.runtime.sendMessage`, with a fake page.
 *
 * The sender is the side panel's exact URL, because every runtime message is
 * refused from anything else -- a stub that got this wrong would pass nothing.
 */
function wireBackground(): Wired {
  const reads: string[][] = [];
  const sessions = new ExtractionSessions();
  let counter = 0;
  const deps: ExtractionControlDeps = {
    sessions,
    sendToTab: async <TResponse,>(_tabId: number, message: unknown): Promise<TResponse> => {
      const typed = message as { type?: string; request?: { fields: Record<string, unknown> } };
      if (typed.type !== EXTRACTION_CONTENT_MESSAGES.preview) return { ok: true } as TResponse;
      const names = Object.keys(typed.request?.fields ?? {});
      reads.push(names);
      const row = Object.fromEntries(names.map((key) => [key, cell(key)]));
      return { ok: true, rows: [row, row] } as TResponse;
    },
    ensureContentScript: async () => undefined,
    // The confirm path runs the read once. Two records, from two pages, so the
    // counts the panel says back are distinguishable from any default.
    runAction: async (request) => ({
      result: {
        commandId: request.action.commandId,
        actionType: request.action.actionType,
        status: "succeeded",
        validation: { status: "passed", expected: "records", actual: "2 records" },
        extracted: [{ name: cell("name") }, { name: cell("name") }],
        extraction: { recordCount: 2, pagesRead: 2, truncated: false, missingFields: [], fieldNames: ["name"] },
        startedAt: 1_000,
        finishedAt: 1_600
      }
    }),
    newId: () => `s${(counter += 1)}`
  };
  const manager = { status: () => ({ recordingState: "recording", activeTabId: AUTOMATION_TAB }) } as unknown as FluxIQConnection;
  const sender = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;
  const frame = { id: "extension-id", tab: { id: AUTOMATION_TAB }, frameId: 0 } as chrome.runtime.MessageSender;

  // `writable` matters: other test files install their own stub by plain
  // assignment, and a property defined without it is read-only, so every one of
  // them fails with "Cannot assign to read only property 'chrome'" as soon as
  // this file has run. The suite shares one Node process.
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    writable: true,
    value: {
      runtime: {
        id: "extension-id",
        getURL: (path: string) => `chrome-extension://extension-id/${path}`,
        lastError: undefined,
        sendMessage: (message: unknown, respond: (response: unknown) => void) => {
          const typed = message as { type?: string };
          const from = typed.type === EXTRACTION_PICKED_MESSAGE ? frame : sender;
          void handleExtractionControl(message as Record<string, unknown>, from, manager, deps)
            .then((result) => respond(result.handled ? result.response : undefined));
        }
      }
    }
  });
  return { reads, sessions };
}

/** Starts a pick and answers it with the fixture proposal, the way a frame would. */
async function pickProposal(): Promise<string> {
  const started = await chromeSend({ type: EXTRACTION_RUNTIME_MESSAGES.start }) as { sessionId?: string };
  const sessionId = String(started.sessionId ?? "");
  await chromeSend({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal: proposalFixture() });
  return sessionId;
}

function chromeSend(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    (globalThis as unknown as { chrome: { runtime: { sendMessage: (m: unknown, r: (response: unknown) => void) => void } } })
      .chrome.runtime.sendMessage(message, resolve);
  });
}

function draftFromFixture(): ExtractionDraft {
  return extractionDraftFromProposal(proposalFixture(), "Products");
}

test("the first preview is read for the proposal's columns, and never for the one the picker pre-excluded", async () => {
  const wired = wireBackground();
  await pickProposal();

  const session = await readExtractionSession();
  assert.deepEqual(wired.reads, [["name", "detail", "price", "sku"]], "the sensitive column is not read at all (D12)");
  assert.deepEqual(Object.keys(session?.preview?.[0] ?? {}), ["name", "detail", "price", "sku"]);
});

test("excluding a column changes what the preview returns: the page is read again without it", async () => {
  const wired = wireBackground();
  await pickProposal();

  const opened = draftFromFixture();
  const before = await readExtractionSession(extractionPreviewSelection(opened));
  assert.equal(JSON.stringify(before?.preview).includes(cell("sku")), true, "the column's values are there to begin with");

  const excluded = setExtractionFieldHandling(opened, "sku", "exclude");
  const after = await readExtractionSession(extractionPreviewSelection(excluded));

  assert.deepEqual(wired.reads, [["name", "detail", "price", "sku"], ["name", "detail", "price"]], "the page is asked for one column fewer");
  assert.equal(JSON.stringify(after?.preview).includes(cell("sku")), false, "and the worker's rows no longer hold its values");
  for (const row of after?.preview ?? []) assert.equal(Object.hasOwn(row, "sku"), false, "absent, not null");
  assert.equal((after?.preview ?? []).length > 0, true, "the other columns are still previewed");
});

test("a column the user renamed is still the column the worker stops reading", async () => {
  const wired = wireBackground();
  await pickProposal();
  await readExtractionSession(extractionPreviewSelection(draftFromFixture()));

  // The confirm payload would call this column `cost`, because its record key is
  // derived from the label (D16). The preview is keyed by the proposal's own
  // key, and sending the wrong one of the two is the failure this row exists
  // for: it would match no proposal field, read as "as proposed", and put the
  // excluded column straight back into the read.
  const renamed = renameExtractionField(draftFromFixture(), "price", "Cost");
  const excluded = setExtractionFieldHandling(renamed, "price", "exclude");
  assert.deepEqual(
    extractionPreviewSelection(excluded).map((column) => column.key),
    ["name", "detail", "price", "sku", "card"],
    "the selection names proposal keys, not record keys"
  );

  const after = await readExtractionSession(extractionPreviewSelection(excluded));
  assert.deepEqual(wired.reads, [["name", "detail", "price", "sku"], ["name", "detail", "sku"]]);
  assert.equal(JSON.stringify(after?.preview).includes(cell("price")), false);
});

test("a column whose kind the user changed is not read again either, until the extraction runs", async () => {
  const wired = wireBackground();
  await pickProposal();
  const opened = draftFromFixture();
  await readExtractionSession(extractionPreviewSelection(opened));

  // `stale` is the panel's word for "these values no longer describe what this
  // column reads". The worker has no such concept, so the panel says it in the
  // one word the worker does understand: the column is named `exclude`.
  const stale = { ...opened, fields: opened.fields.map((field) => (field.sourceKey === "detail" ? { ...field, stale: true } : field)) };
  const after = await readExtractionSession(extractionPreviewSelection(stale));
  assert.deepEqual(wired.reads, [["name", "detail", "price", "sku"], ["name", "price", "sku"]]);
  assert.equal(JSON.stringify(after?.preview).includes(cell("detail")), false);
});

test("confirming answers what was captured, so the panel can say whether the rows arrived", async () => {
  wireBackground();
  await pickProposal();
  const draft = draftFromFixture();

  const outcome = await confirmExtraction(extractionConfirmPayload(draft));

  assert.ok(outcome, "the counts reach the panel rather than being computed for nobody");
  assert.equal(outcome.recordCount, 2);
  assert.equal(outcome.pagesRead, 2);
  assert.equal(outcome.truncated, false);
  assert.equal(outcome.label, "Products", "the name the user typed, said back to them");
  assert.equal(typeof outcome.datasetId, "string");
  assert.equal(typeof outcome.durationMs, "number");
  // The reply is the one place a record could have leaked into the panel, since
  // the worker holds the records at that moment. It carries counts only (D3).
  assert.equal(JSON.stringify(outcome).includes(cell("name")), false);
});
