import { RunnerFailure } from "../failure.js";

type Provenance = { schemaVersion: "fixture.state.v1"; ownerEpoch: string; resetGeneration: number; mutationSequence: number };
type ResetPacket = { status: "reset"; seed: number; provenance: Provenance };
export type LabResetFetch = (url: string, init: { method: "POST" | "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; body: ReadableStream<Uint8Array> | null }>;

/** Bounded authenticated producer observation only, never a browser/start proof. */
export async function resetScenarioLab(origin: string, runToken: string, fetchLab: LabResetFetch = fetch): Promise<ResetPacket> {
  const base = new URL(origin).origin;
  try {
    const request = (path: string, method: "POST" | "GET") => fetchLab(`${base}/__control/${path}`, { method, headers: { authorization: `Bearer ${runToken}` }, signal: AbortSignal.timeout(5_000) });
    const response = await request("reset", "POST"), packet = await read(response);
    if (!exact(packet, ["status", "seed", "provenance"]) || packet.status !== "reset" || !Number.isSafeInteger(packet.seed) || !provenance(packet.provenance)) throw new Error("fixture.reset_packet_invalid");
    const reset = packet as ResetPacket, health = await read(await request("health", "GET"));
    if (!exact(health, ["status", "seed", "scenarios", "provenance"]) || health.status !== "ready" || health.seed !== reset.seed || !provenance(health.provenance)
      || health.provenance.ownerEpoch !== reset.provenance.ownerEpoch || health.provenance.resetGeneration !== reset.provenance.resetGeneration || health.provenance.mutationSequence < reset.provenance.mutationSequence
      || !Array.isArray(health.scenarios) || !health.scenarios.length || new Set(health.scenarios).size !== health.scenarios.length || health.scenarios.some(id => typeof id !== "string" || !id)) throw new Error("fixture.reset_owner_changed");
    return Object.freeze({ status: "reset", seed: reset.seed, provenance: Object.freeze({ ...reset.provenance }) });
  } catch { throw new RunnerFailure("fixture.invalid", "Scenario Lab reset producer could not be confirmed"); }
}
async function read(response: Awaited<ReturnType<LabResetFetch>>): Promise<Record<string, unknown>> {
  if (!response.ok || response.status !== 200 || !response.body) throw new Error("fixture.control_unavailable");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 16 * 1024) { await reader.cancel(); throw new Error("fixture.control_limit"); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("fixture.control_invalid");
  return parsed as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function provenance(value: unknown): value is Provenance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["schemaVersion", "ownerEpoch", "resetGeneration", "mutationSequence"]) && item.schemaVersion === "fixture.state.v1"
    && typeof item.ownerEpoch === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(item.ownerEpoch)
    && Number.isSafeInteger(item.resetGeneration) && Number(item.resetGeneration) > 0 && Number.isSafeInteger(item.mutationSequence) && Number(item.mutationSequence) >= 0;
}
