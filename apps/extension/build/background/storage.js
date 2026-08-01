import { MAX_EVENT_QUEUE_SIZE, STORAGE_KEYS } from "../shared/constants";
import { defaultSettings } from "../shared/browser";
export async function readSettings() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
    return { ...defaultSettings(), ...(stored[STORAGE_KEYS.settings] ?? {}) };
}
export async function writeSettings(settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}
export async function readSession() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.session);
    return stored[STORAGE_KEYS.session] ?? null;
}
export async function writeSession(session) {
    await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}
export async function readOrCreateClientId() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.clientId);
    const existing = stored[STORAGE_KEYS.clientId];
    if (existing)
        return existing;
    const clientId = `extension-${crypto.randomUUID()}`;
    await chrome.storage.local.set({ [STORAGE_KEYS.clientId]: clientId });
    return clientId;
}
export async function readQueuedEvents() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.queuedEvents);
    return stored[STORAGE_KEYS.queuedEvents] ?? [];
}
export async function queueEvent(message) {
    const queued = await readQueuedEvents();
    queued.push(message);
    const trimmed = queued.slice(-MAX_EVENT_QUEUE_SIZE);
    await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: trimmed });
    return trimmed.length;
}
export async function clearQueuedEvents() {
    await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: [] });
}
//# sourceMappingURL=storage.js.map