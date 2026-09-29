import { randomUUID } from "node:crypto";
import type { BrowserContext, Route, WebSocketRoute, Worker } from "@playwright/test";
import { RunnerFailure } from "./failure.js";

/**
 * Schemes that pass the guard without an origin check, because a request for
 * one is answered inside the browser and never opens a network connection:
 *
 * - `chrome-extension:` is served from an installed extension's package on
 *   disk. Every lane pins the installed set with `--disable-extensions-except`
 *   and `--load-extension`, so the only packages that answer are the one under
 *   test and Chromium's own component extensions, none of which is remote.
 * - `data:` carries its whole body in the URL itself.
 * - `about:` names a browser-internal document (`about:blank`, `about:srcdoc`).
 * - `blob:` names an object a script in the same browser already holds in
 *   memory; creating one needs the bytes to be present, so it cannot fetch.
 *
 * None of them can carry data off the machine, and blocking them would break
 * the extension's own pages and ordinary fixture behaviour. `file:`,
 * `chrome:` and every other scheme stay refused.
 */
const INTERNAL_PROTOCOLS = new Set(["chrome-extension:", "data:", "about:", "blob:"]);

/**
 * The destination a service-worker proof fetches. `.invalid` is reserved and
 * never resolves anywhere, so the canary cannot leave the machine even when
 * the guard fails to see it; the guard recognises it by exact URL.
 */
const SERVICE_WORKER_CANARY_ORIGIN = "http://fluxiq-network-guard-canary.invalid";
const SERVICE_WORKER_CANARY_TIMEOUT_MS = 5_000;

/**
 * Playwright 1.51.1 routes a service worker's requests through
 * `context.route` only when this variable is set in the Playwright process as
 * the worker attaches (`playwright-core/lib/server/chromium/crServiceWorker.js:38`).
 * Without it the guard never sees the extension's background, which is a
 * service worker: measured on 2026-09-28, an unguarded background fetched
 * `http://example.com/` with status 200 while the guard saw nothing. It is
 * set when this module loads, which every guarded lane does through a static
 * import before it launches a browser, and the proof in
 * `installDeterministicNetworkGuard` fails the run if it ever stops working.
 */
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

export type DeterministicNetworkPolicy = {
  scenarioOrigins: readonly string[];
  fluxiqOrigins: readonly string[];
  gatewayOrigins?: readonly string[];
  /**
   * Proves an unlisted loopback page origin belongs to the Scenario Lab, which
   * serves cross-origin frames from a second port it picks at startup. A proven
   * origin joins the allowlist for the rest of the run; an unproven one is a
   * violation like any other destination.
   */
  verifyScenarioOrigin?: (origin: string) => Promise<boolean>;
};

export type NetworkViolation = {
  /**
   * `service-worker` means a worker's traffic was proven invisible to the
   * guard: its requests could reach any destination without being checked.
   */
  kind: "request" | "websocket" | "service-worker";
  destination: string;
  resourceType?: string;
};

export class DeterministicNetworkViolationError extends RunnerFailure {
  constructor(readonly violations: readonly NetworkViolation[]) {
    super("runtime.behavior", `Deterministic browser network policy blocked ${violations.length} unexpected destination(s): ${violations.slice(0, 5).map(item => `${item.kind}:${item.destination}`).join(", ")}`);
    this.name = "DeterministicNetworkViolationError";
  }
}

export type DeterministicNetworkGuard = {
  violations(): readonly NetworkViolation[];
  assertNoViolations(): void;
  /** Resolves once every service-worker proof started so far has finished. */
  serviceWorkersProven(): Promise<void>;
};

export async function installDeterministicNetworkGuard(
  context: BrowserContext,
  policy: DeterministicNetworkPolicy,
): Promise<DeterministicNetworkGuard> {
  const allowed = compilePolicy(policy);
  const violations: NetworkViolation[] = [];
  const proofs = new Map<string, Promise<boolean>>();
  const isAllowedRequest = async (url: string): Promise<boolean> => {
    if (isAllowedWithCompiledPolicy(url, allowed)) return true;
    const origin = loopbackPageOrigin(url);
    if (!origin || !policy.verifyScenarioOrigin) return false;
    let proof = proofs.get(origin);
    if (!proof) { proof = policy.verifyScenarioOrigin(origin).catch(() => false); proofs.set(origin, proof); }
    if (!await proof) return false;
    allowed.pageOrigins.add(origin);
    return true;
  };
  const canaries = new Map<string, boolean>();
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    if (canaries.has(request.url())) { canaries.set(request.url(), true); await route.abort("blockedbyclient"); return; }
    if (await isAllowedRequest(request.url())) await route.continue();
    else {
      violations.push({ kind: "request", destination: sanitizedDestination(request.url()), resourceType: request.resourceType() });
      await route.abort("blockedbyclient");
    }
  });
  await context.routeWebSocket(/.*/u, async (route: WebSocketRoute) => {
    if (isAllowedWithCompiledPolicy(route.url(), allowed)) route.connectToServer();
    else {
      violations.push({ kind: "websocket", destination: sanitizedDestination(route.url()) });
      await route.close({ code: 1008, reason: "Blocked by deterministic network policy" });
    }
  });
  // Every service worker in the context -- the extension's background above
  // all -- must be proven visible to the route above. The worker fetches a
  // one-off canary; if the route never saw it, the worker's traffic bypasses
  // the guard and that is recorded as a violation, so the lane fails instead
  // of running uncontained. A worker that goes away before it can be asked is
  // not a finding: its successor attaches as a new worker and is proven then.
  const workerProofs = new Set<Promise<void>>();
  const proveWorker = (worker: Worker): void => {
    const proof = (async () => {
      const canary = `${SERVICE_WORKER_CANARY_ORIGIN}/${randomUUID()}`;
      canaries.set(canary, false);
      try {
        await worker.evaluate(
          async ({ url, timeoutMs }) => { await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch(/* best-effort: the canary is meant to fail; only whether the route saw it matters */ () => undefined); },
          { url: canary, timeoutMs: SERVICE_WORKER_CANARY_TIMEOUT_MS },
        );
      } catch {
        // best-effort: the worker closed before it could be asked; its successor attaches as a new worker and is proven on its own event.
        canaries.delete(canary);
        return;
      }
      const seen = canaries.get(canary);
      canaries.delete(canary);
      if (!seen) violations.push({ kind: "service-worker", destination: workerOrigin(worker.url()) });
    })();
    workerProofs.add(proof);
    void proof.finally(() => workerProofs.delete(proof));
  };
  context.on("serviceworker", proveWorker);
  for (const worker of context.serviceWorkers()) proveWorker(worker);
  return {
    violations: () => violations.map(item => ({ ...item })),
    assertNoViolations: () => { if (violations.length) throw new DeterministicNetworkViolationError(violations.map(item => ({ ...item }))); },
    serviceWorkersProven: async () => { await Promise.all([...workerProofs]); },
  };
}

export function isAllowedDeterministicDestination(url: string, policy: DeterministicNetworkPolicy): boolean {
  return isAllowedWithCompiledPolicy(url, compilePolicy(policy));
}

export function scenarioNetworkOrigins(origin: string): string[] {
  const primary = exactOrigin(origin, ["http:", "https:"], "scenario origin");
  const parsed = new URL(primary);
  const result = [primary];
  if (parsed.hostname === "127.0.0.1") { parsed.hostname = "localhost"; result.push(parsed.origin); }
  else if (parsed.hostname === "localhost") { parsed.hostname = "127.0.0.1"; result.push(parsed.origin); }
  return result;
}

type CompiledPolicy = { pageOrigins: Set<string>; gatewayOrigins: ReadonlySet<string> };

function loopbackPageOrigin(input: string): string | undefined {
  try {
    const url = new URL(input);
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "127.0.0.1" || url.hostname === "localhost") ? url.origin : undefined;
  } catch { return undefined; }
}

function compilePolicy(policy: DeterministicNetworkPolicy): CompiledPolicy {
  return {
    pageOrigins: new Set([
      ...policy.scenarioOrigins.map(value => exactOrigin(value, ["http:", "https:"], "scenario origin")),
      ...policy.fluxiqOrigins.map(value => exactOrigin(value, ["http:", "https:"], "FluxIQ origin")),
    ]),
    gatewayOrigins: new Set((policy.gatewayOrigins ?? []).map(value => exactOrigin(value, ["ws:", "wss:"], "gateway origin"))),
  };
}

function isAllowedWithCompiledPolicy(input: string, policy: CompiledPolicy): boolean {
  let url: URL;
  try { url = new URL(input); } catch { return false; }
  if (INTERNAL_PROTOCOLS.has(url.protocol)) return true;
  if (url.protocol === "http:" || url.protocol === "https:") return policy.pageOrigins.has(url.origin);
  if (url.protocol === "ws:" || url.protocol === "wss:") return policy.gatewayOrigins.has(url.origin);
  return false;
}

function exactOrigin(input: string, protocols: readonly string[], label: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error(`${label} must be an absolute URL`); }
  if (!protocols.includes(url.protocol) || url.username || url.password) throw new Error(`${label} must be a credential-free ${protocols.join("/")} origin`);
  return url.origin;
}

/** A worker's scheme and host, which names the extension or site it belongs to and nothing it carries. */
function workerOrigin(input: string): string {
  try { const url = new URL(input); return `${url.protocol}//${url.host}`; } catch { return "[invalid-url]"; }
}

function sanitizedDestination(input: string): string {
  try {
    const url = new URL(input);
    if (INTERNAL_PROTOCOLS.has(url.protocol)) return url.protocol;
    return `${url.origin}${url.pathname}`;
  } catch { return "[invalid-url]"; }
}
