// The picker's worker half, with no browser: a fake page, a fake action runner
// and a `chrome` stub, shared by the three test files that drive it.
//
// It lives beside them rather than inside one of them because the tests split by
// subject -- who may drive the picker (`extraction-boundary.test.ts`), the pick
// and its preview (`extraction-control.test.ts`), and what a confirmed
// extraction records and runs (`extraction-confirm.test.ts`) -- and every one of
// them needs the same fake page. Copying it three times is how the copies drift.
//
// Two things here are load-bearing rather than convenience:
//
// - **Every preview cell carries `PAGE_SENTINEL`.** Several rows assert that the
//   string appears in nothing durable and in no reply that is meant to carry
//   counts, which is how D3 is checked cheaply: a value distinctive enough to
//   search for is proof it leaked wherever it is found.
// - **The `chrome` stub is defined `writable`.** Every test bundle runs in one
//   Node process and other files install their stub by plain assignment, so a
//   property defined without it is read-only and they fail with "Cannot assign
//   to read only property 'chrome'" the moment this file has run.

import type { BrowserActionCommand, BrowserActionResult, ExtensionStatus, RecordingState } from "../../shared/protocol";
import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_PICKED_MESSAGE, EXTRACTION_RUNTIME_MESSAGES } from "../../shared/extraction-messages";
import { ExtractionSessions, handleExtractionControl, type ExtractionConfirmField, type ExtractionControlDeps } from "../extraction";
import type { FluxIQConnection } from "../connection";
import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";

/** Planted in every cell the fake page returns. Nothing durable may ever contain it. */
export const PAGE_SENTINEL = "SENTINEL-PAGE-VALUE";

export const AUTOMATION_TAB = 7;

export const proposal: WebAutomationExtractionProposal = {
  container: "ul.products",
  item: "ul.products > li",
  itemCount: 8,
  confidence: 0.9,
  fields: [
    { key: "product_name", label: "Product name", coverage: 1, spec: { kind: "text", selector: ".name" } },
    { key: "price", label: "Price", coverage: 1, spec: { kind: "text", selector: ".price" } },
    { key: "card", label: "Card number", coverage: 1, spec: { kind: "text", selector: ".card", handling: "exclude" } }
  ]
};

/** What the panel sends after the user renamed nothing and left the sensitive column excluded. */
export const confirmFields: ExtractionConfirmField[] = [
  { key: "product_name", label: "Product name", kind: "text", selector: ".name", handling: "include" },
  { key: "price", label: "Price", kind: "text", selector: ".price", handling: "include" },
  { key: "card_number", label: "Card number", kind: "text", selector: ".card", handling: "exclude" }
];

export type SentMessage = { tabId: number; frameId: number | undefined; message: Record<string, unknown> };

export type Harness = {
  deps: ExtractionControlDeps;
  sent: SentMessage[];
  ran: BrowserActionCommand[];
  storageWrites: unknown[];
  manager: FluxIQConnection;
};

export const sidepanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;
export const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup/index.html" } as chrome.runtime.MessageSender;
export const frame = { id: "extension-id", tab: { id: AUTOMATION_TAB }, frameId: 0 } as chrome.runtime.MessageSender;

export function harness(recordingState: RecordingState = "recording", activeTabId: number | null = AUTOMATION_TAB): Harness {
  const sent: SentMessage[] = [];
  const ran: BrowserActionCommand[] = [];
  const storageWrites: unknown[] = [];
  installChrome(storageWrites);
  previewIsReadable = true;
  let counter = 0;
  const deps: ExtractionControlDeps = {
    sessions: new ExtractionSessions(),
    sendToTab: async <TResponse,>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      const typed = message as Record<string, unknown>;
      sent.push({ tabId, frameId, message: typed });
      return pageAnswer(typed) as TResponse;
    },
    ensureContentScript: async () => undefined,
    runAction: async (request) => {
      ran.push(request.action);
      await request.attachTabForRecording(AUTOMATION_TAB);
      return { result: succeededExtraction(request.action) };
    },
    newId: () => `s${(counter += 1)}`
  };
  const status = { recordingState, ...(activeTabId === null ? {} : { activeTabId }) } as unknown as ExtensionStatus;
  return { deps, sent, ran, storageWrites, manager: { status: () => status } as unknown as FluxIQConnection };
}

/** Only what `isControlPage` and a storage spy need; nothing here touches the real browser. */
function installChrome(writes: unknown[]): void {
  const area = {
    set: async (items: unknown) => { writes.push(items); },
    get: async () => ({}),
    remove: async () => undefined,
    clear: async () => undefined
  };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    writable: true,
    value: {
      runtime: { id: "extension-id", getURL: (path: string) => `chrome-extension://extension-id/${path}` },
      storage: { local: area, session: area, sync: area }
    }
  });
}

/** Whether the fake page will read a preview at all. `harness()` puts it back to reading. */
let previewIsReadable = true;

/** Makes the next preview read refuse, for the rows about what the worker keeps when the page will not answer. */
export function setPreviewReadable(readable: boolean): void {
  previewIsReadable = readable;
}

/** The page's side of the four content messages, with every preview cell carrying the sentinel. */
function pageAnswer(message: Record<string, unknown>): unknown {
  if (message.type === EXTRACTION_CONTENT_MESSAGES.preview) {
    if (!previewIsReadable) return { ok: false, refused: "unreadable_request" };
    const request = message.request as { fields: Record<string, unknown> };
    const row = Object.fromEntries(Object.keys(request.fields).map((key) => [key, `${PAGE_SENTINEL}-${key}`]));
    return { ok: true, rows: [row, row] };
  }
  return { ok: true };
}

function succeededExtraction(action: BrowserActionCommand): BrowserActionResult {
  const fields = Object.keys(action.extractList?.fields ?? {});
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    validation: { status: "passed", expected: "records", actual: "1 record" },
    extracted: [Object.fromEntries(fields.map((key) => [key, `${PAGE_SENTINEL}-${key}`]))],
    extraction: { recordCount: 1, pagesRead: 2, truncated: false, missingFields: [], fieldNames: fields },
    startedAt: 1_000,
    finishedAt: 1_450
  };
}

export function sentOfType(sent: SentMessage[], type: string): SentMessage | undefined {
  return sent.find((entry) => entry.message.type === type);
}

export function previewFieldNames(sent: SentMessage[]): string[][] {
  return sent
    .filter((entry) => entry.message.type === EXTRACTION_CONTENT_MESSAGES.preview)
    .map((entry) => Object.keys((entry.message.request as { fields: Record<string, unknown> }).fields));
}

export function responseOf(result: Awaited<ReturnType<typeof handleExtractionControl>>): Record<string, unknown> {
  return result.handled ? result.response as Record<string, unknown> : { handled: false };
}

export async function startAndPick(h: Harness): Promise<string> {
  const started = await handleExtractionControl({ type: EXTRACTION_RUNTIME_MESSAGES.start }, sidepanel, h.manager, h.deps);
  const sessionId = String(responseOf(started).sessionId ?? "");
  await handleExtractionControl({ type: EXTRACTION_PICKED_MESSAGE, sessionId, proposal }, frame, h.manager, h.deps);
  return sessionId;
}
