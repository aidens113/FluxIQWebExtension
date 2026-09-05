import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { getScenario, listScenarios } from "./registry.js";
import { navigationPage } from "./scenarios/navigation/scenario.js";
import { iframePage } from "./scenarios/iframe-checkout/scenario.js";
import { ScenarioStateStore } from "./state-store.js";

const LOOPBACK_HOST = "127.0.0.1";
const CONTROL_PREFIX = "/__control";
const MAX_BODY_BYTES = 16 * 1024;

export type ScenarioLabOptions = {
  runToken: string;
  seed?: number;
  port?: number;
  host?: "127.0.0.1";
};

export type RunningScenarioLab = {
  origin: string;
  frameOrigin: string;
  port: number;
  runToken: string;
  close(): Promise<void>;
};

export async function startScenarioLab(options: ScenarioLabOptions): Promise<RunningScenarioLab> {
  validateRunToken(options.runToken);
  const host = options.host ?? LOOPBACK_HOST;
  if (host !== LOOPBACK_HOST) throw new Error("Scenario lab may bind only to 127.0.0.1");
  const store = new ScenarioStateStore(options.seed ?? 1);
  const frameServer = createServer((request, response) => {
    void handleRequest(request, response, options.runToken, store).catch(error => {
      if (!response.headersSent) sendJson(response, 500, { error: "fixture_error" });
      else response.destroy();
      if (process.env.SCENARIO_LAB_DEBUG === "1") console.error(error);
    });
  });
  await listen(frameServer, 0, host);
  const frameAddress = frameServer.address();
  if (!frameAddress || typeof frameAddress === "string") throw new Error("Scenario frame server did not obtain a TCP port");
  const frameOrigin = `http://${host}:${frameAddress.port}`;
  const server = createServer((request, response) => {
    void handleRequest(request, response, options.runToken, store, frameOrigin).catch(error => {
      if (!response.headersSent) sendJson(response, 500, { error: "fixture_error" });
      else response.destroy();
      if (process.env.SCENARIO_LAB_DEBUG === "1") console.error(error);
    });
  });

  try {
    await listen(server, options.port ?? 0, host);
  } catch (error) {
    await close(frameServer);
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Scenario lab did not obtain a TCP port");
  return {
    origin: `http://${host}:${address.port}`,
    frameOrigin,
    port: address.port,
    runToken: options.runToken,
    close: async () => { await Promise.all([close(server), close(frameServer)]); },
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, runToken: string, store: ScenarioStateStore, alternateOrigin?: string): Promise<void> {
  setSecurityHeaders(response);
  if (!isAllowedHost(request.headers.host)) return sendJson(response, 421, { error: "loopback_host_required" });
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (url.pathname.startsWith(CONTROL_PREFIX)) {
    if (!isAuthorized(request, runToken)) return sendJson(response, 401, { error: "unauthorized" });
    return handleControl(request, response, url, store);
  }

  if (url.pathname.startsWith("/api/")) {
    if (!isAuthorized(request, runToken)) return sendJson(response, 401, { error: "unauthorized" });
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
    const [, , scenarioId, operation] = url.pathname.split("/");
    if (!scenarioId || !operation) return sendJson(response, 404, { error: "not_found" });
    const result = store.mutate(scenarioId, operation, await readJson(request));
    return result ? sendJson(response, 200, result) : sendJson(response, 404, { error: "scenario_not_found" });
  }

  if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { error: "method_not_allowed" });
  if (url.pathname === "/scenarios/navigation/redirect") {
    response.writeHead(302, { location: "/scenarios/navigation/redirected", "cache-control": "no-store" });
    response.end();
    return;
  }
  if (url.pathname === "/scenarios/iframe-checkout/cross-frame") {
    response.setHeader("content-security-policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*");
  }
  const html = renderRoute(url.pathname, runToken, store, alternateOrigin);
  if (!html) return sendJson(response, 404, { error: "not_found" });
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(request.method === "HEAD" ? undefined : html);
}

async function handleControl(request: IncomingMessage, response: ServerResponse, url: URL, store: ScenarioStateStore): Promise<void> {
  if (url.pathname === `${CONTROL_PREFIX}/health` && request.method === "GET") {
    return sendJson(response, 200, { status: "ready", seed: store.seed, scenarios: listScenarios().map(value => value.id) });
  }
  if (url.pathname === `${CONTROL_PREFIX}/final-state` && request.method === "GET") {
    const scenarioId = url.searchParams.get("scenario");
    if (!scenarioId) return sendJson(response, 200, { seed: store.seed, scenarios: store.all() });
    const snapshot = store.snapshot(scenarioId);
    return snapshot ? sendJson(response, 200, snapshot) : sendJson(response, 404, { error: "scenario_not_found" });
  }
  if (url.pathname === `${CONTROL_PREFIX}/reset` && request.method === "POST") {
    store.reset();
    return sendJson(response, 200, { status: "reset", seed: store.seed });
  }
  if (url.pathname === `${CONTROL_PREFIX}/seed` && request.method === "POST") {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.seed !== "number" || !Number.isSafeInteger(body.seed)) {
      return sendJson(response, 400, { error: "invalid_seed" });
    }
    store.reseed(body.seed);
    return sendJson(response, 200, { status: "seeded", seed: store.seed });
  }
  sendJson(response, 404, { error: "not_found" });
}

function renderRoute(pathname: string, runToken: string, store: ScenarioStateStore, alternateOrigin?: string): string | undefined {
  if (pathname === "/") {
    const links = listScenarios().map(scenario => `<li><a href="${scenario.startPath}">${scenario.title}</a></li>`).join("");
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Scenario lab</title><body><main><h1>Scenario lab</h1><ul>${links}</ul></main></body></html>`;
  }
  if (["/scenarios/navigation/start", "/scenarios/navigation/second", "/scenarios/navigation/history", "/scenarios/navigation/redirected"].includes(pathname)) {
    const name = pathname.split("/").at(-1) ?? "start";
    return navigationPage(name, runToken);
  }
  if (pathname === "/scenarios/iframe-checkout/same-frame") return iframePage("same", runToken);
  if (pathname === "/scenarios/iframe-checkout/cross-frame") return iframePage("cross", runToken);
  const match = /^\/scenarios\/([^/]+)\/?$/.exec(pathname);
  const id = match?.[1];
  if (!id) return undefined;
  const scenario = getScenario(id);
  const snapshot = store.snapshot(id);
  return scenario && snapshot ? scenario.render(snapshot.state, {
    runToken,
    seed: store.seed,
    ...(alternateOrigin ? { alternateOrigin } : {}),
  }) : undefined;
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("content-security-policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'self' http://127.0.0.1:*; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  // The iframe fixture intentionally uses a second loopback port. `same-site`
  // permits that distinct origin while still excluding non-loopback sites.
  response.setHeader("cross-origin-resource-policy", "same-site");
}

function isAllowedHost(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":", 1)[0];
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
  return request.headers.authorization === `Bearer ${token}`;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("Request body exceeds fixture limit");
  }
  if (!body) return {};
  try { return JSON.parse(body) as unknown; } catch { throw new Error("Invalid JSON request body"); }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => { server.off("error", reject); resolve(); });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function validateRunToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new Error("Run token must be 16-128 URL-safe characters");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const runToken = process.env.SCENARIO_LAB_RUN_TOKEN;
  if (!runToken) throw new Error("SCENARIO_LAB_RUN_TOKEN is required");
  const port = parseInteger(process.env.SCENARIO_LAB_PORT, 0);
  const seed = parseInteger(process.env.SCENARIO_LAB_SEED, 1);
  const lab = await startScenarioLab({ runToken, port, seed });
  console.log(JSON.stringify({ status: "ready", origin: lab.origin, port: lab.port }));
  const shutdown = () => { void lab.close().then(() => process.exit(0)); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65_535) throw new Error(`Invalid integer: ${value}`);
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
