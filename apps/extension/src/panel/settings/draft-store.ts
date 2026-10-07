// The Connection form's unsaved values, kept per viewer in
// `chrome.storage.local` under `fluxiq.ui.connectionDraft` (audit defect S1:
// Firefox closes its popup on every click in the page, and an address typed but
// not yet saved used to vanish with it). Cleared by Save.
//
// A viewer convenience only: every read and write is wrapped, and a panel whose
// storage fails simply starts from the saved settings.

import type { FluxIQSettings } from "../../shared/protocol";

export const CONNECTION_DRAFT_KEY = "fluxiq.ui.connectionDraft";

const TEXT = ["gatewayUrl", "coreApiUrl"] as const;
const SWITCHES = ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots"] as const;

/** A stored draft, or undefined for anything that is not a whole, well-typed set of settings. */
export function parseConnectionDraft(value: unknown): FluxIQSettings | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!TEXT.every((key) => typeof record[key] === "string")) return undefined;
  if (!SWITCHES.every((key) => typeof record[key] === "boolean")) return undefined;
  return {
    gatewayUrl: record.gatewayUrl as string,
    coreApiUrl: record.coreApiUrl as string,
    autoReconnect: record.autoReconnect as boolean,
    captureMutations: record.captureMutations as boolean,
    captureInputValues: record.captureInputValues as boolean,
    captureSnapshots: record.captureSnapshots as boolean,
    requestsEnabled: false
  };
}

/** The unsaved draft, or undefined when there is none or storage fails. Never rejects. */
export function readConnectionDraft(): Promise<FluxIQSettings | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([CONNECTION_DRAFT_KEY], (items) => {
        resolve(chrome.runtime.lastError ? undefined : parseConnectionDraft(items?.[CONNECTION_DRAFT_KEY]));
      });
    } catch {
      resolve(undefined);
    }
  });
}

/** Keeps `values` as the unsaved draft; undefined forgets it. Never throws. */
export function writeConnectionDraft(values: FluxIQSettings | undefined): void {
  try {
    const done = () => {
      void chrome.runtime.lastError;
    };
    if (values === undefined) chrome.storage.local.remove(CONNECTION_DRAFT_KEY, done);
    else chrome.storage.local.set({ [CONNECTION_DRAFT_KEY]: { ...values, requestsEnabled: false } }, done);
  } catch {
    /* best-effort: the draft is a viewer convenience, and Save works the same without it */
  }
}
