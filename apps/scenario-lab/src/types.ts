export const scenarioIds = [
  "basic-form", "dynamic-list", "navigation", "long-document", "iframe-checkout",
  "ambiguous-targets", "delayed-ui", "failure-surfaces", "reconnect", "sensitive-input",
  "llm-target-drift", "instruction-only-form",
] as const;

export type ScenarioId = (typeof scenarioIds)[number];

export type ScenarioDefinition<TState extends object = object> = {
  id: ScenarioId;
  title: string;
  startPath: string;
  seed: number;
  manifest: WebScenario;
  createState(seed: number): TState;
  render(state: TState, context: RenderContext): string;
  mutate(state: TState, operation: string, payload: unknown): TState;
};

export type ScenarioManifestInput = Omit<WebScenario, "schemaVersion" | "networkPolicy" | "evidencePolicy"> & {
  evidencePolicy?: WebScenario["evidencePolicy"];
};

export function createScenarioManifest(input: ScenarioManifestInput): WebScenario {
  const manifest: WebScenario = {
    ...input,
    schemaVersion: "0.1",
    networkPolicy: "loopback-only",
    evidencePolicy: {
      screenshots: "events",
      trace: "failure",
      video: "failure",
      sampleFps: 0,
      reviewRequired: false,
      ...input.evidencePolicy,
    },
  };
  assertWebScenario(manifest);
  return manifest;
}

export function defineScenario<TState extends object>(definition: ScenarioDefinition<TState>): ScenarioDefinition<TState> {
  assertWebScenario(definition.manifest);
  const mismatches = (["id", "title", "startPath", "seed"] as const).filter((key) => definition[key] !== definition.manifest[key]);
  if (mismatches.length > 0) throw new Error(`Scenario definition and manifest disagree: ${mismatches.join(", ")}`);
  return definition;
}

export type RenderContext = {
  runToken: string;
  seed: number;
  alternateOrigin?: string;
};

export type ScenarioSnapshot = {
  scenarioId: ScenarioId;
  seed: number;
  state: object;
};
import { assertWebScenario, type WebScenario } from "@fluxiq-web-extension/test-contracts";
