import { DEFAULT_CORE_API_URL, LEGACY_GATEWAY_CORE_API_URL, STORAGE_KEYS } from "../shared/constants";
import { defaultSettings } from "../shared/browser";
import type { FluxIQSession, FluxIQSettings } from "../shared/protocol";
import { readSavedClientId, readSavedSession, readSavedSettings, type SavedReading } from "./saved-state";

// Every read below goes through a reader in `saved-state.ts`, so a stored value
// of the wrong shape is repaired, written back, and reported here, rather than
// thrown from every message the background answers.
type SavedStateRepairListener = (message: string) => void;
let repairListener: SavedStateRepairListener | undefined;

/** Who hears that stored state was unreadable and repaired: the problem log (`background/index.ts`). */
export function onSavedStateRepaired(listener: SavedStateRepairListener | undefined): void {
  repairListener = listener;
}

async function repaired<T>(reading: SavedReading<T>, key: string, rewrite: (value: T) => Promise<void>): Promise<T> {
  if (!reading.repaired.length) return reading.value;
  // Field names only: the stored values are what was wrong, and may be anything.
  reportSavedStateRepair(key, reading.repaired);
  await rewrite(reading.value).catch((error: unknown) => {
    // The repaired value is still what this read answers; the next read repairs again.
    console.warn("FluxIQ could not write repaired", key, error instanceof Error ? error.message : error);
  });
  return reading.value;
}

// Saved settings are the person's choices, direct requests included, kept as
// they set them. Storage is read before Core's recording-capture policy is
// known, so it applies no policy: the policy is applied where settings are used
// (`capture-policy/effective-settings.ts`, which keeps direct requests off under
// Core's default) and to what a save may change (`capture-policy/requests-choice.ts`).

export async function readSettings(): Promise<FluxIQSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = await repaired(readSavedSettings(stored[STORAGE_KEYS.settings], defaultSettings()), "settings", writeSettings);
  return normalizeSettings(settings);
}

export async function writeSettings(settings: FluxIQSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: normalizeSettings(settings) });
}

function normalizeSettings(settings: FluxIQSettings): FluxIQSettings {
  settings = { ...settings, requestsEnabled: settings.requestsEnabled === true };
  if (settings.coreApiUrl.trim().replace(/\/+$/, "") !== LEGACY_GATEWAY_CORE_API_URL) return settings;
  return { ...settings, coreApiUrl: DEFAULT_CORE_API_URL };
}

export async function readSession(): Promise<FluxIQSession | null> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.session, STORAGE_KEYS.clientId]);
  const clientId = readSavedClientId(stored[STORAGE_KEYS.clientId]) ?? "";
  return await repaired(readSavedSession(stored[STORAGE_KEYS.session], clientId), "session", async (session) => {
    if (session) await writeSession(session);
    else await clearSession();
  });
}

export async function writeSession(session: FluxIQSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

export async function readOrCreateClientId(): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.clientId);
  const existing = readSavedClientId(stored[STORAGE_KEYS.clientId]);
  if (existing) return existing;
  if (stored[STORAGE_KEYS.clientId] !== undefined) repairListener?.("Saved client id could not be read and was replaced; this browser will pair again.");
  const clientId = `extension-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [STORAGE_KEYS.clientId]: clientId });
  return clientId;
}

/**
 * Removes the offline queue older builds kept in `chrome.storage.local`, where
 * queued page data outlived the browser session that recorded it. The queue
 * now lives in session storage (`connection/outbox/`); this runs when the
 * background starts, which every upgrade does, and the old key is never read.
 */
export async function discardPersistentQueue(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.queuedEvents);
}

/**
 * Notes that a stored value of the wrong shape was repaired, for a reader that
 * repairs outside this file (the offline queue's store). Field names only.
 */
export function reportSavedStateRepair(key: string, fields: readonly string[]): void {
  const message = `Saved ${key} could not be read and was repaired (${fields.join(", ")}).`;
  console.warn("FluxIQ", message);
  repairListener?.(message);
}
