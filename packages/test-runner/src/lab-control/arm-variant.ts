import type { ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

export type LabFetch = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

const URL_SEGMENT = /^[A-Za-z0-9._~-]+$/u;

/**
 * Arms a variant through the fixture's `mutate(operation, payload)`, which the
 * Lab exposes as an authenticated `POST /api/<scenario>/<operation>`. Only a
 * lane that runs a Flow arms a variant, before that run; the recording lane
 * always records the workflow unarmed.
 */
export async function armScenarioVariant(origin: string, runToken: string, scenarioId: string, variant: ScenarioVariant, fetchLab: LabFetch = fetch): Promise<void> {
  const operation = variant.arm.operation;
  if (!URL_SEGMENT.test(scenarioId) || !URL_SEGMENT.test(operation)) throw new RunnerFailure("fixture.invalid", `Variant ${variant.id} arm operation is not a single path segment`);
  const response = await fetchLab(`${new URL(origin).origin}/api/${scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${runToken}`, "content-type": "application/json" },
    body: JSON.stringify(variant.arm.payload ?? {}),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new RunnerFailure("fixture.invalid", `Scenario Lab did not arm variant ${variant.id}`, { details: { status: response.status } });
}
