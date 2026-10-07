import type { IncomingMessage, ServerResponse } from "node:http";
import { listScenarios } from "./registry.js";
import type { ScenarioStateStore } from "./state-store.js";

/** Authenticated producer data only: not browser/start/oracle authority. */
export async function handleScenarioControl(request: IncomingMessage, response: ServerResponse, url: URL, store: ScenarioStateStore, runToken: string): Promise<void> {
  if (request.headers.authorization !== `Bearer ${runToken}`) return send(response, 401, { error: "unauthorized" });
  const path = url.pathname;
  if (path === "/__control/health" && request.method === "GET") return send(response, 200, { status: "ready", seed: store.seed, scenarios: listScenarios().map(value => value.id), provenance: store.provenance() });
  if (path === "/__control/final-state" && request.method === "GET") {
    const id = url.searchParams.get("scenario"), snapshot = id ? store.snapshot(id) : undefined;
    return id ? send(response, snapshot ? 200 : 404, snapshot ?? { error: "scenario_not_found" }) : send(response, 200, { seed: store.seed, scenarios: store.all(), provenance: store.provenance() });
  }
  if (!["/__control/reset", "/__control/seed", "/__control/arm"].includes(path)) return send(response, 404, { error: "not_found" });
  if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" });
  let body: unknown;
  try { body = await json(request); } catch { return send(response, 400, { error: "invalid_body" }); }
  if (!record(body)) return send(response, 400, { error: "invalid_body" });
  if (path === "/__control/reset") {
    if (Object.keys(body).length) return send(response, 400, { error: "invalid_reset" });
    return send(response, 200, { status: "reset", seed: store.seed, provenance: store.reset() });
  }
  if (path === "/__control/seed") {
    if (Object.keys(body).length !== 1 || !Number.isSafeInteger(body.seed)) return send(response, 400, { error: "invalid_seed" });
    const provenance = store.reseed(body.seed as number);
    return send(response, 200, { status: "seeded", seed: store.seed, provenance });
  }
  const keys = Object.keys(body);
  if (!keys.includes("scenarioId") || !keys.includes("variantId") || keys.some(key => !["scenarioId", "variantId", "workflowId"].includes(key))
    || typeof body.scenarioId !== "string" || typeof body.variantId !== "string" || Object.hasOwn(body, "workflowId") && typeof body.workflowId !== "string") return send(response, 400, { error: "invalid_arm" });
  try {
    const result = store.arm({ scenarioId: body.scenarioId, variantId: body.variantId, ...(typeof body.workflowId === "string" ? { workflowId: body.workflowId } : {}) });
    return result.status === "changed" ? send(response, 200, { status: "armed", snapshot: result.snapshot }) : send(response, 409, { error: "arm_unconfirmed" });
  } catch (error) {
    if (error instanceof Error && error.message === "fixture.variant_unknown") return send(response, 404, { error: "variant_unknown" });
    throw error;
  }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
async function json(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of request) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); bytes += buffer.length; if (bytes > 16 * 1024) throw new Error("fixture.body_limit"); chunks.push(buffer); }
  const text = Buffer.concat(chunks).toString("utf8"); return text ? JSON.parse(text) : {};
}
function send(response: ServerResponse, status: number, value: unknown): void { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
