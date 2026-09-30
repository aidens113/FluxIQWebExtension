// The extension start, timestamped: what the browser did with the extension's
// service worker and its pages between launch and pairing, and what they said.
//
// It exists because three live runs (t174 runs 8, 9 and 11) ended with a
// `fluxiq.connect` that was never answered and a bundle that could not say why.
// t174-w7 then found the reason only by recording exactly this: the extension's
// renderer crashed about 150 ms after its worker started, the worker went with
// it, and it was never started again. Recorded here:
//
// - `cdp`: Chrome's own target lifecycle for the extension -- a worker or an
//   extension page created, changed, destroyed, or crashed with its exit code.
// - `worker`: the service worker's console, exceptions and browser log lines,
//   read through a second DevTools session on the worker.
// - `page`: the control page's console, errors, crash and close.
// - `lab`: the Lab's own steps (`mark`), such as the first connect and its answer.
//
// Every string is screened before it is kept (`screenText`, `screenUrl`): the
// run's secrets and the evidence redactor's token patterns are removed, a
// six-digit pairing reference code is removed, long opaque strings are removed,
// and a URL is reduced to its origin -- an extension URL to its path under a
// placeholder id. No page content, cookie, header or token is ever read.

import type { BrowserContext, CDPSession, Page, Worker } from "@playwright/test";
import { redactText } from "@fluxiq-web-extension/test-evidence";

export type ExtensionStartTraceDetail = Readonly<Record<string, string | number | boolean | null>>;
export type ExtensionStartTraceEntry = Readonly<{ atMs: number; source: "lab" | "cdp" | "worker" | "page"; event: string; detail?: ExtensionStartTraceDetail }>;

const MAX_ENTRIES = 500;
const MAX_TEXT = 300;
type TargetInfo = { targetId: string; type: string; url: string; attached?: boolean };

export class ExtensionStartTrace {
  readonly startedAt: number;
  private readonly kept: ExtensionStartTraceEntry[] = [];
  private droppedCount = 0;
  private readonly now: () => number;
  private readonly secrets: readonly string[];
  private readonly workerSessions = new Set<string>();

  constructor(options: { secrets: readonly string[]; now?: () => number }) {
    this.now = options.now ?? Date.now;
    this.secrets = options.secrets.filter(secret => secret.length > 0);
    this.startedAt = this.now();
  }

  /** A Lab step. Strings in `detail` are screened like everything else. */
  mark(event: string, detail?: Record<string, string | number | boolean | null | undefined>): void {
    this.push("lab", event, detail);
  }

  /** Times one Lab step: a `<name>.start` mark, then `<name>.done` or `<name>.failed` with how long it took. */
  async timed<T>(name: string, run: () => Promise<T>, describe?: (value: T) => Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const started = this.now();
    this.mark(`${name}.start`);
    try {
      const value = await run();
      this.mark(`${name}.done`, { ms: this.now() - started, ...(describe ? describe(value) : {}) });
      return value;
    } catch (error) {
      this.mark(`${name}.failed`, { ms: this.now() - started, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Starts recording on a just-launched context. Needs the page every launched
   * persistent context opens with, for its DevTools session; it opens none.
   * Resolves once discovery is on; a context it cannot observe is marked, not thrown.
   */
  async attach(context: BrowserContext): Promise<void> {
    context.on("serviceworker", worker => this.observeWorker(worker));
    for (const worker of context.serviceWorkers()) this.observeWorker(worker);
    const first = context.pages()[0];
    if (!first) { this.mark("trace.cdp-unavailable", { reason: "no_initial_page" }); return; }
    try {
      const session = await context.newCDPSession(first);
      this.observeTargets(session);
      await session.send("Target.setDiscoverTargets", { discover: true });
      const { targetInfos } = await session.send("Target.getTargets") as { targetInfos: TargetInfo[] };
      for (const info of targetInfos) this.onTarget(session, "existing", info);
    } catch (error) {
      this.mark("trace.cdp-unavailable", { reason: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Records one page's console, errors, crash and close under `label`. */
  observePage(page: Page, label: string): void {
    this.push("page", "observed", { label, url: screenUrl(page.url()) });
    page.on("console", message => this.push("page", "console", { label, type: message.type(), text: message.text() }));
    page.on("pageerror", error => this.push("page", "error", { label, text: error.message }));
    page.on("crash", () => this.push("page", "crash", { label }));
    page.on("close", () => this.push("page", "close", { label }));
  }

  /** The entries kept so far, in order, and how many were dropped past the cap. */
  entries(): readonly ExtensionStartTraceEntry[] { return this.kept.map(entry => ({ ...entry })); }
  get dropped(): number { return this.droppedCount; }

  private observeWorker(worker: Worker): void {
    this.push("worker", "announced", { url: screenUrl(worker.url()) });
    worker.on("close", () => this.push("worker", "closed", { url: screenUrl(worker.url()) }));
  }

  private observeTargets(session: CDPSession): void {
    session.on("Target.targetCreated", ({ targetInfo }) => this.onTarget(session, "created", targetInfo as TargetInfo));
    session.on("Target.targetInfoChanged", ({ targetInfo }) => this.onTarget(session, "changed", targetInfo as TargetInfo));
    session.on("Target.targetDestroyed", ({ targetId }) => this.push("cdp", "destroyed", { target: shortId(targetId) }));
    session.on("Target.targetCrashed", ({ targetId, status, errorCode }) => this.push("cdp", "crashed", { target: shortId(targetId), status, errorCode }));
    session.on("Target.receivedMessageFromTarget", ({ sessionId, message }) => { if (this.workerSessions.has(sessionId)) this.onWorkerMessage(message); });
  }

  private onTarget(session: CDPSession, change: "existing" | "created" | "changed", info: TargetInfo): void {
    const extension = info.url.startsWith("chrome-extension:");
    if (info.type !== "service_worker" && !extension && change === "changed") return;
    if (info.type === "browser") return;
    this.push("cdp", change, { target: shortId(info.targetId), type: info.type, url: screenUrl(info.url) });
    if (info.type === "service_worker" && change !== "changed") void this.listenToWorker(session, info.targetId);
  }

  // A second, non-flattened DevTools session on the worker: Playwright owns the
  // flattened one, and the Playwright API in use here has no worker console.
  private async listenToWorker(session: CDPSession, targetId: string): Promise<void> {
    try {
      const { sessionId } = await session.send("Target.attachToTarget", { targetId, flatten: false }) as { sessionId: string };
      this.workerSessions.add(sessionId);
      for (const [id, method] of [[1, "Runtime.enable"], [2, "Log.enable"]] as const) {
        await session.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method }) });
      }
      this.push("worker", "listening", { target: shortId(targetId) });
    } catch (error) {
      this.push("worker", "listen-failed", { target: shortId(targetId), error: error instanceof Error ? error.message : String(error) });
    }
  }

  private onWorkerMessage(raw: string): void {
    let message: { method?: string; params?: Record<string, any> };
    try { message = JSON.parse(raw) as typeof message; } catch { this.push("worker", "unparsed-message"); return; }
    const params = message.params ?? {};
    if (message.method === "Runtime.consoleAPICalled") {
      const args = Array.isArray(params.args) ? params.args : [];
      this.push("worker", "console", { type: String(params.type), text: args.map((arg: Record<string, unknown>) => String(arg.value ?? arg.description ?? arg.type)).join(" ") });
    } else if (message.method === "Runtime.exceptionThrown") {
      const details = params.exceptionDetails ?? {};
      this.push("worker", "exception", { text: String(details.exception?.description ?? details.text ?? "exception") });
    } else if (message.method === "Log.entryAdded") {
      this.push("worker", "log", { level: String(params.entry?.level), source: String(params.entry?.source), text: String(params.entry?.text ?? "") });
    }
  }

  private push(source: ExtensionStartTraceEntry["source"], event: string, detail?: Record<string, string | number | boolean | null | undefined>): void {
    if (this.kept.length >= MAX_ENTRIES) { this.droppedCount += 1; return; }
    const screened: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(detail ?? {})) {
      if (value === undefined) continue;
      screened[key] = typeof value === "string" ? screenText(value, this.secrets) : value;
    }
    this.kept.push({ atMs: Math.max(0, this.now() - this.startedAt), source, event, ...(detail ? { detail: screened } : {}) });
  }
}

/** A string as the trace keeps it: no secret, token pattern, pairing code, long opaque string or URL beyond its origin. */
export function screenText(value: string, secrets: readonly string[]): string {
  const redacted = redactText(value, { secrets })
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/giu, match => screenUrl(match))
    .replace(/\b\d{6}\b/gu, "[code]")
    .replace(/[A-Za-z0-9+/_=-]{32,}/gu, "[long]");
  return redacted.length > MAX_TEXT ? `${redacted.slice(0, MAX_TEXT)}…` : redacted;
}

/** A URL reduced to its origin; an extension URL to its path under a placeholder id; `about:` kept without query. */
export function screenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "chrome-extension:") return `chrome-extension://<extension>${parsed.pathname}`;
    if (parsed.protocol === "about:") return `about:${parsed.pathname}`;
    return parsed.origin === "null" ? `${parsed.protocol}` : parsed.origin;
  } catch {
    return "[unparsed-url]";
  }
}

function shortId(targetId: string): string {
  return targetId.slice(0, 8);
}
