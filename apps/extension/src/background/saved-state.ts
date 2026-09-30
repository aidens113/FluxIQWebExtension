// Reading what the extension saved, when what it saved may be wrong.
//
// `chrome.storage.local` holds whatever was last written: by this build, by an
// older one with a different shape, by a person poking at it in DevTools, or a
// write cut short. Read as a cast, a settings object whose `coreApiUrl` is not
// a string threw inside `readSettings`, every message to the background failed
// with the same TypeError, and nothing but reinstalling recovered.
//
// Each reader here takes the stored value as `unknown`, keeps each field that
// is well formed, puts the default in place of each that is not, and names what
// it replaced in `repaired`. The caller writes the repaired value back, so the
// next read is clean, and notes the repair where a problem report finds it. A
// stored pairing token that is not a string is dropped rather than repaired:
// there is no default token, and the browser pairs again.

import type { ClientGatewayClientMessage, FluxIQSession, FluxIQSettings } from "../shared/protocol";

export type SavedReading<T> = { value: T; repaired: string[] };

const SETTINGS_FLAGS = ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots"] as const;

export function readSavedSettings(stored: unknown, defaults: FluxIQSettings): SavedReading<FluxIQSettings> {
  if (stored === undefined) return { value: { ...defaults }, repaired: [] };
  if (!isRecord(stored)) return { value: { ...defaults }, repaired: ["settings"] };
  const repaired: string[] = [];
  const value: FluxIQSettings = { ...defaults };
  const gatewayUrl = stored.gatewayUrl;
  if (gatewayUrl !== undefined) {
    if (isAddress(gatewayUrl, ["ws:", "wss:"])) value.gatewayUrl = gatewayUrl;
    else repaired.push("gatewayUrl");
  }
  const coreApiUrl = stored.coreApiUrl;
  if (coreApiUrl !== undefined) {
    if (isAddress(coreApiUrl, ["http:", "https:"])) value.coreApiUrl = coreApiUrl;
    else repaired.push("coreApiUrl");
  }
  for (const flag of SETTINGS_FLAGS) {
    const storedFlag = stored[flag];
    if (storedFlag === undefined) continue;
    if (typeof storedFlag === "boolean") value[flag] = storedFlag;
    else repaired.push(flag);
  }
  return { value, repaired };
}

export function readSavedSession(stored: unknown, clientId: string): SavedReading<FluxIQSession | null> {
  if (stored === undefined || stored === null) return { value: null, repaired: [] };
  if (!isRecord(stored)) return { value: null, repaired: ["session"] };
  const repaired: string[] = [];
  const value: FluxIQSession = { clientId };
  if (stored.clientId !== undefined && typeof stored.clientId !== "string") repaired.push("session.clientId");
  else if (typeof stored.clientId === "string") value.clientId = stored.clientId;
  optionalString(stored, "token", repaired, (text) => { value.token = text; });
  optionalString(stored, "sessionId", repaired, (text) => { value.sessionId = text; });
  optionalString(stored, "serverUrl", repaired, (text) => { value.serverUrl = text; });
  if (stored.projectId === null) value.projectId = null;
  else optionalString(stored, "projectId", repaired, (text) => { value.projectId = text; });
  if (stored.connectedAt !== undefined) {
    if (typeof stored.connectedAt === "number" && Number.isFinite(stored.connectedAt)) value.connectedAt = stored.connectedAt;
    else repaired.push("session.connectedAt");
  }
  return { value, repaired };
}

/** The offline queue, keeping each message that still names its type and dropping the rest. */
export function readSavedQueue(stored: unknown): SavedReading<ClientGatewayClientMessage[]> {
  if (stored === undefined) return { value: [], repaired: [] };
  if (!Array.isArray(stored)) return { value: [], repaired: ["queuedEvents"] };
  const value = stored.filter((message): message is ClientGatewayClientMessage => isRecord(message) && typeof message.type === "string");
  return { value, repaired: value.length === stored.length ? [] : ["queuedEvents"] };
}

export function readSavedClientId(stored: unknown): string | undefined {
  return typeof stored === "string" && stored.trim() ? stored : undefined;
}

function optionalString(stored: Record<string, unknown>, key: keyof FluxIQSession, repaired: string[], keep: (text: string) => void): void {
  const value = stored[key];
  if (value === undefined) return;
  if (typeof value === "string") keep(value);
  else repaired.push(`session.${key}`);
}

function isAddress(value: unknown, protocols: readonly string[]): value is string {
  if (typeof value !== "string") return false;
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
