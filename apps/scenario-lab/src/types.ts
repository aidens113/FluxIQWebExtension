export const scenarioIds = [
  "basic-form", "dynamic-list", "navigation", "long-document", "iframe-checkout",
  "ambiguous-targets", "delayed-ui", "failure-surfaces", "reconnect", "sensitive-input",
  "llm-target-drift", "instruction-only-form",
  "product-catalog", "data-table", "infinite-feed", "modal-flows", "multi-tab",
  "file-transfer", "auth-gate", "identity-drift", "intermediate-state", "keyboard-forms",
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
  /**
   * Extra documents under `/scenarios/<id>/<subpath>`: pages, redirects,
   * frame documents, downloads. Return `undefined` for a 404.
   */
  route?(state: TState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined;
};

/** A GET or HEAD for `/scenarios/<id>/<subpath>`; the start page itself goes to `render`. */
export type ScenarioRouteRequest = { subpath: string; query: URLSearchParams; method: "GET" | "HEAD" };

/**
 * A scenario-owned response. `content-type` defaults to HTML and `body` to
 * empty. On GET, `mutation` is applied through the scenario's `mutate()`
 * after the response is computed, so a route can record that it was hit.
 */
export type ScenarioRouteResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
  mutation?: { operation: string; payload?: unknown };
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
