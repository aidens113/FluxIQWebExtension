import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { advanceScenarioCounter as next } from "./state-counter.js";
import { getScenario, listScenarios } from "./registry.js";
import type { ScenarioId, ScenarioSnapshot } from "./types.js";

type Variant = ScenarioSnapshot["variant"];
type Arm = { variantId: string; workflowId: string | null; operation: string; payload?: unknown };
/** Actual fixture publisher. Producer sequencing never grants command/start authority. */
export class ScenarioStateStore {
  #state: Map<ScenarioId, object>;
  readonly #epoch = randomUUID();
  #seed: number;
  #generation = 1;
  #sequence = 0;
  #publishing = false;
  #variants = new Map<ScenarioId, Variant>();
  constructor(seed: number) { this.#seed = normalizeSeed(seed); this.#state = this.prepare(this.#seed); }
  get seed(): number { return this.#seed; }
  provenance(): ScenarioSnapshot["provenance"] {
    return Object.freeze({ schemaVersion: "fixture.state.v1", ownerEpoch: this.#epoch, resetGeneration: this.#generation, mutationSequence: this.#sequence });
  }
  reset(): ScenarioSnapshot["provenance"] { return this.transaction(() => this.replace(this.#seed)); }
  reseed(seed: number): ScenarioSnapshot["provenance"] { return this.transaction(() => this.replace(normalizeSeed(seed))); }
  snapshot(id: string): ScenarioSnapshot | undefined {
    const scenario = getScenario(id), state = scenario && this.#state.get(scenario.id);
    if (!scenario || !state) return undefined;
    return { scenarioId: scenario.id, seed: this.#seed, state: structuredClone(state), provenance: this.provenance(), variant: structuredClone(this.#variants.get(scenario.id) ?? { status: "baseline" }) };
  }
  mutate(id: string, operation: string, payload: unknown): ScenarioSnapshot | undefined {
    return this.transaction(() => this.publish(id, operation, payload));
  }
  arm(input: { scenarioId: string; variantId: string; workflowId?: string }): { status: "changed" | "no_change"; snapshot: ScenarioSnapshot } {
    return this.transaction(() => {
    const scenario = getScenario(input.scenarioId);
    if (!scenario) throw new Error("fixture.variant_unknown");
    const selected = arms(scenario.id).filter(arm => arm.variantId === input.variantId && arm.workflowId === (input.workflowId ?? null));
    if (selected.length !== 1) throw new Error("fixture.variant_unknown");
    const arm = selected[0]!, before = this.#sequence;
    const snapshot = this.publish(scenario.id, arm.operation, arm.payload, arm)!;
    return { status: this.#sequence === before ? "no_change" : "changed", snapshot };
    });
  }
  all(): ScenarioSnapshot[] { return listScenarios().map(scenario => this.snapshot(scenario.id)!); }
  private transaction<T>(operation: () => T): T {
    if (this.#publishing) throw new Error("fixture.reentrant_publication");
    this.#publishing = true;
    try { return operation(); } finally { this.#publishing = false; }
  }
  private prepare(seed: number): Map<ScenarioId, object> {
    return new Map(listScenarios().map(scenario => [scenario.id, stateCopy(scenario.createState(seed))]));
  }
  private replace(seed: number): ScenarioSnapshot["provenance"] {
    const generation = next(this.#generation), sequence = next(this.#sequence), staged = this.prepare(seed);
    this.#state = staged; this.#seed = seed; this.#generation = generation; this.#sequence = sequence; this.#variants.clear();
    return this.provenance();
  }
  private publish(id: string, operation: string, payload: unknown, selected?: Arm): ScenarioSnapshot | undefined {
    const scenario = getScenario(id), current = scenario && this.#state.get(scenario.id);
    if (!scenario || !current) return undefined;
    const sequence = next(this.#sequence), copiedPayload = structuredClone(payload);
    const changed = stateCopy(scenario.mutate(stateCopy(current), operation, structuredClone(copiedPayload)));
    if (isDeepStrictEqual(current, changed)) return this.snapshot(id);
    const matches = selected ? [selected] : arms(scenario.id).filter(arm => arm.operation === operation && isDeepStrictEqual(arm.payload, copiedPayload));
    const variant: Variant = matches.length === 1 ? { status: "armed", variantId: matches[0]!.variantId, workflowId: matches[0]!.workflowId, armSequence: sequence } : { status: "unknown" };
    this.#state.set(scenario.id, changed); this.#sequence = sequence; this.#variants.set(scenario.id, variant);
    return this.snapshot(id);
  }
}
function normalizeSeed(seed: number): number { if (!Number.isSafeInteger(seed)) throw new Error("Scenario seed must be a safe integer"); return seed; }
function stateCopy(value: object): object { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("fixture.state_invalid"); return structuredClone(value); }
function arms(id: ScenarioId): Arm[] {
  const manifest = getScenario(id)!.manifest;
  return [...(manifest.variants ?? []).map(variant => ({ variantId: variant.id, workflowId: null, ...variant.arm })),
    ...(manifest.workflows ?? []).flatMap(workflow => (workflow.variants ?? []).map(variant => ({ variantId: variant.id, workflowId: workflow.id, ...variant.arm })))];
}
