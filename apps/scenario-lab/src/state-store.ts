import { getScenario, listScenarios } from "./registry.js";
import type { ScenarioId, ScenarioSnapshot } from "./types.js";

export class ScenarioStateStore {
  readonly #state = new Map<ScenarioId, object>();
  #seed: number;

  constructor(seed: number) {
    this.#seed = normalizeSeed(seed);
    this.reset();
  }

  get seed(): number { return this.#seed; }

  reseed(seed: number): void {
    this.#seed = normalizeSeed(seed);
    this.reset();
  }

  reset(): void {
    this.#state.clear();
    for (const scenario of listScenarios()) this.#state.set(scenario.id, scenario.createState(this.#seed));
  }

  snapshot(id: string): ScenarioSnapshot | undefined {
    const scenario = getScenario(id);
    if (!scenario) return undefined;
    const state = this.#state.get(scenario.id);
    if (!state) return undefined;
    return { scenarioId: scenario.id, seed: this.#seed, state: structuredClone(state) };
  }

  mutate(id: string, operation: string, payload: unknown): ScenarioSnapshot | undefined {
    const scenario = getScenario(id);
    if (!scenario) return undefined;
    const current = this.#state.get(scenario.id);
    if (!current) return undefined;
    this.#state.set(scenario.id, scenario.mutate(current, operation, payload));
    return this.snapshot(id);
  }

  all(): ScenarioSnapshot[] {
    return listScenarios().map(scenario => this.snapshot(scenario.id)).filter((value): value is ScenarioSnapshot => value !== undefined);
  }
}

function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) throw new Error("Scenario seed must be a safe integer");
  return seed;
}
