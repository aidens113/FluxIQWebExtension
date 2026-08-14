import { DEFAULT_CORE_API_URL, LEGACY_GATEWAY_CORE_API_URL, MAX_EVENT_QUEUE_SIZE, STORAGE_KEYS } from "../shared/constants";
import { defaultSettings } from "../shared/browser";
import type { ClientGatewayClientMessage, FluxIQSession, FluxIQSettings } from "../shared/protocol";

export async function readSettings(): Promise<FluxIQSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings({ ...defaultSettings(), ...((stored[STORAGE_KEYS.settings] as Partial<FluxIQSettings> | undefined) ?? {}) });
}

export async function writeSettings(settings: FluxIQSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: normalizeSettings(settings) });
}

function normalizeSettings(settings: FluxIQSettings): FluxIQSettings {
  if (settings.coreApiUrl.trim().replace(/\/+$/, "") !== LEGACY_GATEWAY_CORE_API_URL) return settings;
  return { ...settings, coreApiUrl: DEFAULT_CORE_API_URL };
}

export async function readSession(): Promise<FluxIQSession | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.session);
  return (stored[STORAGE_KEYS.session] as FluxIQSession | undefined) ?? null;
}

export async function writeSession(session: FluxIQSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

export async function readOrCreateClientId(): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.clientId);
  const existing = stored[STORAGE_KEYS.clientId] as string | undefined;
  if (existing) return existing;
  const clientId = `extension-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [STORAGE_KEYS.clientId]: clientId });
  return clientId;
}

export async function readQueuedEvents(): Promise<ClientGatewayClientMessage[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.queuedEvents);
  return (stored[STORAGE_KEYS.queuedEvents] as ClientGatewayClientMessage[] | undefined) ?? [];
}

export async function queueEvent(message: ClientGatewayClientMessage): Promise<number> {
  const queued = await readQueuedEvents();
  queued.push(message);
  const trimmed = queued.slice(-MAX_EVENT_QUEUE_SIZE);
  await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: trimmed });
  return trimmed.length;
}

export async function clearQueuedEvents(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: [] });
}
