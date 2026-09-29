// HTTP calls the extension makes to FluxIQ Core, outside the client-gateway
// socket: listing recordings, reading the gateway snapshot for project context,
// storing a captured screenshot as a state asset, and the program calls the
// panel's relays make (`background/panel/`).

import { DEFAULT_CORE_API_URL } from "../../shared/constants";
import type { CoreRecordingSummary, CoreRecordingsPage, PanelRelayResponse } from "../../shared/protocol";
import { arrayValue, compactObject, numberValue, objectValue, parseJsonBody, stringValue, timestampValue } from "./value-readers";

export type CoreApiCredentials = {
  readonly coreApiUrl: string;
  readonly token: string | undefined;
};

export async function fetchCoreRecordings(
  credentials: CoreApiCredentials,
  page: number,
  pageSize: number
): Promise<CoreRecordingsPage> {
  const normalizedPageSize = Math.min(50, Math.max(5, Math.floor(pageSize) || 10));
  const normalizedPage = Math.max(1, Math.floor(page) || 1);
  const sourceUrl = recordingsApiUrl(credentials.coreApiUrl, normalizedPage, normalizedPageSize);
  const response = await fetch(sourceUrl, {
    headers: compactObject({
      accept: "application/json",
      ...(credentials.token ? { authorization: `Bearer ${credentials.token}` } : {})
    }) as Record<string, string>
  });
  if (!response.ok) throw new Error(`FluxIQ recordings API returned ${response.status}.`);
  return normalizeRecordingsResponse(await response.json(), normalizedPage, normalizedPageSize, sourceUrl);
}

// The project this client's session belongs to, as Core currently sees it.
// Falls back to whichever project Automation Studio has open.
export async function fetchProjectIdFromCoreSnapshot(
  credentials: CoreApiCredentials & { token: string },
  identity: { sessionId: string | undefined; clientId: string },
  reason: string
): Promise<string | undefined> {
  const url = new URL("/api/client-gateway/snapshot", credentials.coreApiUrl || DEFAULT_CORE_API_URL);
  const response = await fetch(url.toString(), {
    headers: compactObject({
      accept: "application/json",
      authorization: `Bearer ${credentials.token}`
    }) as Record<string, string>
  });
  const bodyText = await response.text().catch(() => "");
  const payload = parseJsonBody(bodyText);
  console.info("FluxIQ project context lookup", {
    url: url.toString(),
    status: response.status,
    reason,
    body: payload ?? bodyText
  });
  if (!response.ok) return undefined;
  const root = objectValue(payload);
  if (root?.ok !== true) return undefined;
  const body = objectValue(root.payload);
  const sessions = arrayValue(body?.sessions);
  const matchingSession = sessions
    .map(objectValue)
    .find((session) => session && stringValue(session.sessionId) === identity.sessionId)
    ?? sessions
      .map(objectValue)
      .find((session) => session && stringValue(session.clientId) === identity.clientId);
  const sessionProjectId = stringValue(matchingSession?.projectId);
  const webRuntime = objectValue(body?.webRuntime);
  const automationStudio = objectValue(webRuntime?.automationStudio);
  const activeProjectId = stringValue(automationStudio?.activeProjectId);
  return sessionProjectId ?? activeProjectId;
}

export async function uploadStateAsset(
  credentials: CoreApiCredentials,
  projectId: string,
  sha256: string,
  bytes: ArrayBuffer,
  mediaType: string
): Promise<string> {
  const url = new URL(`/api/programs/automation-studio/state-assets/${encodeURIComponent(projectId)}/${sha256}`, credentials.coreApiUrl || DEFAULT_CORE_API_URL);
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: compactObject({
      "content-type": mediaType,
      "x-content-sha256": sha256,
      ...(credentials.token ? { authorization: `Bearer ${credentials.token}` } : {})
    }) as Record<string, string>,
    body: bytes
  });
  const bodyText = await response.text().catch(() => "");
  const payload = parseJsonBody(bodyText);
  console.info("FluxIQ screenshot upload", {
    url: url.toString(),
    status: response.status,
    body: payload ?? bodyText
  });
  const responseObject = objectValue(payload);
  const responsePayload = objectValue(responseObject?.payload);
  const contentRef = stringValue(responsePayload?.contentRef);
  if (!response.ok || responseObject?.ok !== true || !contentRef) {
    throw new Error(`FluxIQ state asset upload failed (${response.status}).`);
  }
  return contentRef;
}

/** How long a program call may take. `append-turn` waits for FluxIQ to read and answer the message, which is a model call. */
const CORE_PROGRAM_CALL_TIMEOUT_MS = 120_000;

/**
 * One call to an Automation Studio program endpoint, with the pairing token as
 * the bearer credential. Core accepts the token only on the endpoints its
 * program route allowlists for a paired client (`apps/web/src/lib/program-route.ts`
 * in FluxIQ Core); any other answers 403, which comes back as `refused`.
 *
 * A successful answer's payload is returned exactly as Core sent it. The token
 * is never part of a failure: every sentence here is fixed text or Core's own
 * `error`, and the login cookie is never sent (`credentials: "omit"`), so the
 * token is the only credential Core sees.
 */
export async function callCoreProgram(
  credentials: CoreApiCredentials,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<PanelRelayResponse> {
  if (!credentials.token) return { ok: false, code: "not_paired", error: "This browser is not paired with FluxIQ yet." };
  let status: number;
  let bodyText: string;
  try {
    const url = new URL(`/api/programs/automation-studio/${encodeURIComponent(endpoint)}`, credentials.coreApiUrl || DEFAULT_CORE_API_URL);
    const response = await fetch(url.toString(), {
      method: "POST",
      credentials: "omit",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${credentials.token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CORE_PROGRAM_CALL_TIMEOUT_MS)
    });
    status = response.status;
    bodyText = await response.text();
  } catch {
    // No answer, or an answer cut off before its body arrived: either way
    // FluxIQ said nothing the panel can act on.
    return { ok: false, code: "unreachable", error: "FluxIQ could not be reached." };
  }
  const body = objectValue(parseJsonBody(bodyText));
  if (status === 401 || status === 403) {
    return { ok: false, code: "refused", httpStatus: status, error: stringValue(body?.error) ?? "FluxIQ refused this browser's pairing." };
  }
  if (status < 200 || status >= 300 || body?.ok !== true) {
    return { ok: false, code: "failed", httpStatus: status, error: stringValue(body?.error) ?? `FluxIQ answered ${status}.` };
  }
  return { ok: true, payload: body.payload ?? null };
}

function recordingsApiUrl(coreApiUrl: string, page: number, pageSize: number): string {
  const url = new URL("/api/recordings", coreApiUrl || DEFAULT_CORE_API_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}

function normalizeRecordingsResponse(value: unknown, page: number, pageSize: number, sourceUrl: string): CoreRecordingsPage {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(object.items) ? object.items : Array.isArray(object.recordings) ? object.recordings : [];
  return {
    items: rawItems.map(normalizeRecordingSummary).filter((item): item is CoreRecordingSummary => Boolean(item)),
    page: numberValue(object.page) ?? page,
    pageSize: numberValue(object.pageSize) ?? pageSize,
    total: numberValue(object.total),
    sourceUrl
  };
}

function normalizeRecordingSummary(value: unknown): CoreRecordingSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  const id = stringValue(object.id) ?? stringValue(object.recordingId);
  if (!id) return undefined;
  return compactObject({
    id,
    title: stringValue(object.title) ?? stringValue(object.name) ?? id,
    status: stringValue(object.status),
    projectId: stringValue(object.projectId),
    taskId: stringValue(object.taskId),
    eventCount: numberValue(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}
