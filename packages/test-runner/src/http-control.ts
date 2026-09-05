import { RunnerFailure, type RunnerFailureCategory } from "./failure.js";
import { cookieExpiry, type AuthSessionStatus, type CachedAuthSession, type CookieValidationHook, type WebPanelAuthSessionCache } from "./auth-session.js";

export async function waitForHttp(url: string, options: { headers?: HeadersInit; timeoutMs?: number; intervalMs?: number; category?: RunnerFailureCategory; signal?: AbortSignal } = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw options.signal.reason;
    try {
      const response = await fetch(url, {
        ...(options.headers ? { headers: options.headers } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await abortableDelay(Math.min(options.intervalMs ?? 200, Math.max(1, deadline - Date.now())), options.signal);
  }
  throw new RunnerFailure(options.category ?? "process.startup", `Timed out waiting for ${url}`, { cause: lastError, details: { url, timeoutMs } });
}

export type FluxIQCredentials = { username: string; password: string; totp?: string; pin?: string };
export type FluxIQHttpOptions = { signal?: AbortSignal; timeoutMs?: number };
export type FluxIQLoginOptions = FluxIQHttpOptions & {
  sessionCache?: WebPanelAuthSessionCache;
  freshLogin?: boolean;
  validateCachedCookie?: CookieValidationHook;
};

export class FluxIQControlClient {
  private cookie: string | undefined;
  private credentials: FluxIQCredentials | undefined;
  private loginOptions: FluxIQLoginOptions = {};
  constructor(readonly origin: string) {}

  async login(credentials: FluxIQCredentials, options: FluxIQLoginOptions = {}): Promise<"cache" | "login"> {
    this.credentials = credentials;
    this.loginOptions = options;
    const scope = { origin: this.origin, username: credentials.username };
    if (options.sessionCache && !options.freshLogin) {
      const cached = await options.sessionCache.load(scope, options.validateCachedCookie ?? (session => this.validateCookie(session)));
      if (cached.session) { this.cookie = cached.session.cookie; return "cache"; }
    }
    await this.freshLogin(credentials, options.sessionCache, options);
    return "login";
  }

  async authSessionStatus(username: string): Promise<AuthSessionStatus | undefined> {
    return this.loginOptions.sessionCache?.status({ origin: this.origin, username });
  }

  async clearAuthSession(username: string): Promise<AuthSessionStatus | undefined> {
    if (this.credentials?.username === username) this.cookie = undefined;
    return this.loginOptions.sessionCache?.clear({ origin: this.origin, username });
  }

  sessionCookieValue(): string {
    const prefix = "fluxiq_session=";
    if (!this.cookie?.startsWith(prefix)) throw new RunnerFailure("environment.missing", "Authenticated FluxIQ session cookie is unavailable");
    const value = this.cookie.slice(prefix.length);
    if (!value || /[;\r\n\s]/.test(value)) throw new RunnerFailure("environment.missing", "Authenticated FluxIQ session cookie is malformed");
    return value;
  }

  private async freshLogin(credentials: FluxIQCredentials, sessionCache?: WebPanelAuthSessionCache, bounds: FluxIQHttpOptions = {}): Promise<void> {
    const response = await boundedFetch("FluxIQ login", "environment.missing", bounds, signal => fetch(`${this.origin}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: credentials.username, password: credentials.password, ...(credentials.totp ? { totp: credentials.totp } : {}) }), signal,
    }));
    if (!response.ok) throw new RunnerFailure("environment.missing", `FluxIQ authentication failed (${response.status})`);
    const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? undefined;
    this.cookie = setCookie?.split(";", 1)[0];
    if (!this.cookie?.startsWith("fluxiq_session=") || !this.cookie.slice("fluxiq_session=".length)) throw new RunnerFailure("environment.missing", "FluxIQ login did not return the expected session cookie");
    if (sessionCache && setCookie) {
      const expiresAt = cookieExpiry(setCookie);
      if (Date.parse(expiresAt) > Date.now()) await sessionCache.save({ origin: this.origin, username: credentials.username }, { cookie: this.cookie, expiresAt });
    }
  }

  async createProject(input: { name: string; description?: string; domainId?: string | null; authorizationPin?: string }, bounds: FluxIQHttpOptions = {}): Promise<string> {
    const suffix = input.domainId ? `?domainId=${encodeURIComponent(input.domainId)}` : "";
    const { domainId: _domainId, ...body } = input;
    const payload = await this.request(`/api/programs/automation-studio/create-project${suffix}`, body, "recording.persistence", "POST", bounds);
    const id = readString(readRecord(readRecord(payload)?.payload)?.id) ?? readString(readRecord(readRecord(readRecord(payload)?.payload)?.project)?.id);
    if (!id) throw new RunnerFailure("recording.persistence", "FluxIQ create-project response did not include a project ID");
    return id;
  }

  async createFlow(input: { projectId: string; flowId: string; name: string; description?: string; authorizationPin?: string }, bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    return this.request("/api/programs/automation-studio/create-flow", input, "recording.persistence", "POST", bounds);
  }

  async saveFlow(input: { projectId: string; flow: Readonly<Record<string, unknown>>; expectedUpdatedAt?: number; authorizationPin?: string }, bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    return this.request("/api/programs/automation-studio/save-flow", input, "recording.persistence", "POST", bounds);
  }

  async getFlow(projectId: string, flowId: string, bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    return this.request("/api/programs/automation-studio/get-flow", { projectId, flowId }, "recording.persistence", "POST", bounds);
  }

  async selectProject(projectId: string, clientId?: string, bounds: FluxIQHttpOptions = {}): Promise<void> {
    await this.request("/api/client-gateway/automation-studio-context", { activeProjectId: projectId, ...(clientId ? { clientId } : {}) }, "process.startup", "POST", bounds);
  }

  async approvePairing(pairingCode: string): Promise<unknown> {
    return this.request("/api/client-gateway/approve-pairing", { pairingCode }, "gateway.pairing");
  }

  async gatewaySnapshot(): Promise<unknown> {
    return this.request("/api/client-gateway/snapshot", undefined, "gateway.connection", "GET");
  }

  async listRecordings(projectId: string): Promise<unknown> {
    return this.request("/api/programs/automation-studio/list-recordings", { projectId }, "recording.persistence");
  }

  async executeClientAction(sessionId: string, command: Record<string, unknown>, authorizationPin: string): Promise<unknown> {
    return this.request("/api/programs/automation-studio/execute-client-action", { sessionId, command, authorizationPin }, "action.dispatch");
  }

  protected async request(path: string, body?: unknown, category: RunnerFailureCategory = "process.startup", method = "POST", bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    const response = await this.authenticatedResponse(path, body, method, bounds, category);
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) throw new RunnerFailure(category, `FluxIQ control request failed: ${path} (${response.status})`, { details: { path, status: response.status } });
    return payload;
  }

  protected async authenticatedResponse(path: string, body?: unknown, method = "POST", bounds: FluxIQHttpOptions = {}, category: RunnerFailureCategory = "process.startup", retryAuthentication = true): Promise<Response> {
    if (!this.cookie) throw new RunnerFailure("environment.missing", "FluxIQ control client is not authenticated");
    const cookie = this.cookie;
    const response = await boundedFetch(`FluxIQ request ${path}`, category, bounds, signal => fetch(`${this.origin}${path}`, {
      method,
      headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
    }));
    if ((response.status === 401 || response.status === 403) && retryAuthentication && this.credentials) {
      await this.freshLogin(this.credentials, this.loginOptions.sessionCache, bounds);
      return this.authenticatedResponse(path, body, method, bounds, category, false);
    }
    return response;
  }

  protected async validateCookie(session: Readonly<CachedAuthSession>): Promise<boolean> {
    const response = await boundedFetch("FluxIQ cached-session validation", "environment.missing", this.loginOptions, signal => fetch(`${this.origin}/api/client-gateway/snapshot`, { method: "GET", headers: { cookie: session.cookie }, signal }));
    return response.ok;
  }
}

export function isBoundedHttpFailure(error: unknown): boolean {
  return error instanceof RunnerFailure && (error.details?.bounded === "timeout" || error.details?.bounded === "abort");
}

async function boundedFetch(label: string, category: RunnerFailureCategory, options: FluxIQHttpOptions, operation: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const timeoutMs = boundedTimeout(options.timeoutMs);
  const controller = new AbortController();
  const abort = () => controller.abort(new RunnerFailure(category, `${label} was interrupted`, { details: { bounded: "abort" } }));
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new RunnerFailure(category, `${label} timed out after ${timeoutMs}ms`, { details: { bounded: "timeout", timeoutMs } })), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

function boundedTimeout(value: number | undefined): number {
  const resolved = value ?? 30_000;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 300_000) throw new Error("FluxIQ HTTP timeout must be between 1 and 300000 milliseconds");
  return resolved;
}

function readRecord(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function readString(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}
