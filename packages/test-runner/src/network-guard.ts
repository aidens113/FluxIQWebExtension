import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import { RunnerFailure } from "./failure.js";

const INTERNAL_PROTOCOLS = new Set(["chrome-extension:", "data:", "about:", "blob:"]);

export type DeterministicNetworkPolicy = {
  scenarioOrigins: readonly string[];
  fluxiqOrigins: readonly string[];
  gatewayOrigins?: readonly string[];
};

export type NetworkViolation = {
  kind: "request" | "websocket";
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
};

export async function installDeterministicNetworkGuard(
  context: BrowserContext,
  policy: DeterministicNetworkPolicy,
): Promise<DeterministicNetworkGuard> {
  const allowed = compilePolicy(policy);
  const violations: NetworkViolation[] = [];
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    if (isAllowedWithCompiledPolicy(request.url(), allowed)) await route.continue();
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
  return {
    violations: () => violations.map(item => ({ ...item })),
    assertNoViolations: () => { if (violations.length) throw new DeterministicNetworkViolationError(violations.map(item => ({ ...item }))); },
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

type CompiledPolicy = { pageOrigins: ReadonlySet<string>; gatewayOrigins: ReadonlySet<string> };

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

function sanitizedDestination(input: string): string {
  try {
    const url = new URL(input);
    if (INTERNAL_PROTOCOLS.has(url.protocol)) return url.protocol;
    return `${url.origin}${url.pathname}`;
  } catch { return "[invalid-url]"; }
}
