// HTTP calls the extension makes to FluxIQ Core, outside the client-gateway
// socket: listing recordings, reading the gateway snapshot for project context,
// storing a captured screenshot as a state asset, storing a traced command's
// artifacts, and the program calls the panel's relays make (`background/panel/`).

import type { CLIENT_GATEWAY_TRACE_ARTIFACT_PATH } from "fluxiq/client-gateway";
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
/** How long the project-context lookup may take before the request is abandoned. */
const PROJECT_CONTEXT_LOOKUP_TIMEOUT_MS = 10_000;

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
    }) as Record<string, string>,
    // Callers wait a bounded time (project-context.ts); this bounds the request
    // itself, so a Core that never answers does not hold a connection open.
    signal: AbortSignal.timeout(PROJECT_CONTEXT_LOOKUP_TIMEOUT_MS)
  });
  const bodyText = await response.text().catch(() => "");
  const payload = parseJsonBody(bodyText);
  // Status and reason only: the snapshot's body lists every paired client's
  // session, which a console log has no business keeping.
  console.info("FluxIQ project context lookup", { status: response.status, reason });
  if (!response.ok) return undefined;
  const root = objectValue(payload);
  if (root?.ok !== true) return undefined;
  const body = objectValue(root.payload);
  // Core keeps a closed session in its snapshot with the project it had
  // (client-gateway `disconnect`). A previous run's closed session is not this
  // browser's binding now, so only a session still open is matched.
  const sessions = arrayValue(body?.sessions)
    .map(objectValue)
    .filter((session) => session && stringValue(session.status) !== "disconnected");
  const matchingSession = sessions.find((session) => session && stringValue(session.sessionId) === identity.sessionId)
    ?? sessions.find((session) => session && stringValue(session.clientId) === identity.clientId);
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
  console.info("FluxIQ screenshot upload", { status: response.status });
  const responseObject = objectValue(payload);
  const responsePayload = objectValue(responseObject?.payload);
  const contentRef = stringValue(responsePayload?.contentRef);
  if (!response.ok || responseObject?.ok !== true || !contentRef) {
    throw new Error(`FluxIQ state asset upload failed (${response.status}).`);
  }
  return contentRef;
}

/**
 * Where a traced command's artifacts are stored (`CLIENT_GATEWAY_TRACE_ARTIFACT_PATH`).
 * Core's constant is imported as a type only, so the background bundle never
 * loads Core's gateway service; the declared type makes a drift a compile error.
 */
const TRACE_ARTIFACT_PATH: typeof CLIENT_GATEWAY_TRACE_ARTIFACT_PATH = "/api/client-gateway/trace-artifacts";

/**
 * PUTs one trace artifact (traces and offline trials, P2, D13) to Core's trace
 * store under its lower-case hex SHA-256, with the pairing token as the bearer
 * credential and its media type as the content type. Core binds it to this
 * browser's gateway session and keeps one copy per digest. Any answer but a
 * success rejects, naming only the status, and so does a request that takes
 * longer than `timeoutMs`; the caller counts the artifact unavailable.
 */
export async function uploadTraceArtifact(
  credentials: CoreApiCredentials,
  sha256: string,
  bytes: Uint8Array<ArrayBuffer>,
  mediaType: string,
  timeoutMs: number
): Promise<void> {
  if (!credentials.token) throw new Error("This browser is not paired with FluxIQ yet.");
  const url = new URL(`${TRACE_ARTIFACT_PATH}/${sha256}`, credentials.coreApiUrl || DEFAULT_CORE_API_URL);
  // The call's own timer, as `callCoreProgram` keeps one: it ends the request
  // whether or not headers have arrived.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException("FluxIQ did not store the trace artifact in time.", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method: "PUT",
      credentials: "omit",
      headers: { "content-type": mediaType, authorization: `Bearer ${credentials.token}` },
      body: bytes,
      signal: deadline.signal
    });
    if (!response.ok) throw new Error(`FluxIQ trace artifact upload failed (${response.status}).`);
  } finally {
    clearTimeout(timer);
  }
}

/** How long a program call may take, unless its endpoint has a limit of its own below. */
const CORE_PROGRAM_CALL_TIMEOUT_MS = 120_000;

/**
 * How long the person's message may take (`append-turn`): FluxIQ reads it with
 * the model in three attempts and 24 s in all, then answers from the words
 * alone (`conversations/instructions/interpret.ts` in FluxIQ Core), stores its
 * answer and starts what it chose. Forty seconds covers that with room to
 * spare. Until t613 the send waited the two minutes every call gets, so a Core
 * still waiting on a stalled model left the chat on "Sending your message"
 * past the Lab's 60 s.
 */
const CORE_CHAT_TURN_TIMEOUT_MS = 40_000;

/** Each limit with what the panel says when it runs out. FluxIQ was reached, or may have been, and may still be working on the request. */
const CALL_LIMITS: Readonly<Record<string, { ms: number; sentence: string }>> = {
  "append-turn": {
    ms: CORE_CHAT_TURN_TIMEOUT_MS,
    sentence: "FluxIQ did not answer your message within 40 seconds. It may still be working on it, so wait for its answer here before sending it again."
  }
};
const DEFAULT_LIMIT = { ms: CORE_PROGRAM_CALL_TIMEOUT_MS, sentence: "FluxIQ did not answer within two minutes. It may still be working on this, so check FluxIQ before trying again." };

/** The code Core's program route puts on a call naming a project outside the paired domain. */
const PROJECT_DOMAIN_ERROR_CODE = "authorization.project_domain";

/**
 * One call to a Core program endpoint -- Automation Studio's unless another
 * program is named -- with the pairing token as
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
  payload: Record<string, unknown>,
  programId = "automation-studio"
): Promise<PanelRelayResponse> {
  if (!credentials.token) return { ok: false, code: "not_paired", error: "This browser is not paired with FluxIQ yet." };
  let status: number;
  let bodyText: string;
  const limit = CALL_LIMITS[endpoint] ?? DEFAULT_LIMIT;
  // The limit is this call's own timer, and it ends the body read as well as
  // the wait for headers: the answer is read under the same signal.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException("FluxIQ did not answer in time.", "TimeoutError")), limit.ms);
  try {
    const url = new URL(`/api/programs/${encodeURIComponent(programId)}/${encodeURIComponent(endpoint)}`, credentials.coreApiUrl || DEFAULT_CORE_API_URL);
    const response = await fetch(url.toString(), {
      method: "POST",
      credentials: "omit",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${credentials.token}`
      },
      body: JSON.stringify(payload),
      signal: deadline.signal
    });
    status = response.status;
    bodyText = await response.text();
  } catch (error) {
    // The time limit ran out: FluxIQ was reached, or may have been, and may
    // still be working on the request -- a conversation turn waits on a model.
    // Saying "could not be reached" would invite a retry that does it twice.
    if (deadline.signal.aborted || isTimeout(error)) return { ok: false, code: "timed_out", error: limit.sentence };
    // No answer, or an answer cut off before its body arrived: either way
    // FluxIQ said nothing the panel can act on.
    return { ok: false, code: "unreachable", error: "FluxIQ could not be reached." };
  } finally {
    clearTimeout(timer);
  }
  const body = objectValue(parseJsonBody(bodyText));
  // A project outside the domain this browser was paired for is refused with
  // its own code and a sentence the person can act on; the pairing itself is
  // fine, so it is a failed call, not a refused token (t379).
  if (status === 403 && body?.errorCode === PROJECT_DOMAIN_ERROR_CODE) {
    return { ok: false, code: "failed", httpStatus: status, error: stringValue(body?.error) ?? "This project is not in the area FluxIQ paired this browser for." };
  }
  if (status === 401 || status === 403) {
    return { ok: false, code: "refused", httpStatus: status, error: stringValue(body?.error) ?? "FluxIQ refused this browser's pairing." };
  }
  const diagnostic = objectValue(objectValue(body?.payload)?.diagnostic);
  const diagnosticCode = stringValue(body?.errorCode) ?? stringValue(diagnostic?.code);
  const authorityFailure = diagnosticCode === "automation.instructions_required"
    || diagnosticCode === "automation.instruction_led_authoring_required"
    || diagnosticCode === "recording.description_required"
    || diagnosticCode === "recording.supporting_evidence_invalid";
  if (authorityFailure && body?.ok !== true) {
    return { ok: false, code: "failed", diagnosticCode, httpStatus: status, error: stringValue(body?.error) ?? "Open FluxIQ to author task instructions or describe the supporting recording." };
  }
  if (status < 200 || status >= 300 || body?.ok !== true) {
    return { ok: false, code: "failed", httpStatus: status, error: stringValue(body?.error) ?? `FluxIQ answered ${status}.` };
  }
  return { ok: true, payload: body.payload ?? null };
}

function isTimeout(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "TimeoutError";
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
    description: stringValue(object.description),
    status: stringValue(object.status),
    projectId: stringValue(object.projectId),
    taskId: stringValue(object.taskId),
    eventCount: numberValue(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}
