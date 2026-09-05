export const SCENARIO_SCHEMA_VERSION = "0.1" as const;

export const scenarioCapabilities = [
  "navigation",
  "forms",
  "scroll",
  "mutation",
  "iframe",
  "popup",
  "download",
] as const;

export type ScenarioCapability = (typeof scenarioCapabilities)[number];
export type NetworkPolicy = "loopback-only" | "allowlisted-real-site";

export type ScenarioStep = {
  id: string;
  operation: "click" | "type" | "select" | "scroll" | "navigate" | "waitForState" | "checkpoint";
  target?: string;
  value?: string | number | boolean;
  path?: string;
  timeoutMs?: number;
};

export type ExpectedFact = { id: string; subject: string; predicate: string; value: unknown };
export type ExpectedEvent = { type: string; count?: number };
export type ExpectedAction = { action: string; outcome?: "succeeded" | "failed" | "rejected" };
export type ScenarioGoal = { id: string; description: string; successFacts: ExpectedFact[] };

export type ScenarioEvidencePolicy = {
  screenshots: "none" | "checkpoints" | "events";
  trace: "off" | "failure" | "always";
  video: "off" | "failure" | "always";
  sampleFps: number;
  reviewRequired: boolean;
};

export type WebScenario = {
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  id: string;
  title: string;
  tags: string[];
  seed: number;
  startPath: string;
  capabilities: ScenarioCapability[];
  networkPolicy: NetworkPolicy;
  recordingScript: ScenarioStep[];
  playbackGoal?: ScenarioGoal;
  expected: {
    pageFacts?: ExpectedFact[];
    recordingEvents?: ExpectedEvent[];
    actions?: ExpectedAction[];
    finalState?: ExpectedFact[];
    allowedConsoleErrors?: string[];
  };
  evidencePolicy?: Partial<ScenarioEvidencePolicy>;
};

const stringArray = { type: "array", items: { type: "string" } } as const;

/** Portable JSON Schema for editors and non-TypeScript scenario producers. */
export const webScenarioJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://fluxiq.local/schemas/web-scenario-0.1.json",
  title: "FluxIQ Web Test Scenario",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "title", "tags", "seed", "startPath", "capabilities", "networkPolicy", "recordingScript", "expected"],
  properties: {
    schemaVersion: { const: SCENARIO_SCHEMA_VERSION },
    id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", minLength: 1 },
    title: { type: "string", minLength: 1 },
    tags: { ...stringArray, uniqueItems: true },
    seed: { type: "integer", minimum: 0, maximum: 4294967295 },
    startPath: { type: "string", pattern: "^/" },
    capabilities: { type: "array", uniqueItems: true, items: { enum: scenarioCapabilities } },
    networkPolicy: { enum: ["loopback-only", "allowlisted-real-site"] },
    recordingScript: { type: "array", minItems: 1, items: { $ref: "#/$defs/step" } },
    playbackGoal: { $ref: "#/$defs/goal" },
    expected: {
      type: "object",
      additionalProperties: false,
      properties: {
        pageFacts: { type: "array", items: { $ref: "#/$defs/fact" } },
        recordingEvents: { type: "array", items: { $ref: "#/$defs/event" } },
        actions: { type: "array", items: { $ref: "#/$defs/action" } },
        finalState: { type: "array", items: { $ref: "#/$defs/fact" } },
        allowedConsoleErrors: stringArray,
      },
    },
    evidencePolicy: { $ref: "#/$defs/evidencePolicy" },
  },
  $defs: {
    step: {
      type: "object", additionalProperties: false, required: ["id", "operation"],
      properties: {
        id: { type: "string", minLength: 1 },
        operation: { enum: ["click", "type", "select", "scroll", "navigate", "waitForState", "checkpoint"] },
        target: { type: "string", minLength: 1 }, value: { type: ["string", "number", "boolean"] },
        path: { type: "string", pattern: "^/" }, timeoutMs: { type: "integer", minimum: 0 },
      },
    },
    fact: {
      type: "object", additionalProperties: false, required: ["id", "subject", "predicate", "value"],
      properties: { id: { type: "string", minLength: 1 }, subject: { type: "string", minLength: 1 }, predicate: { type: "string", minLength: 1 }, value: {} },
    },
    event: {
      type: "object", additionalProperties: false, required: ["type"],
      properties: { type: { type: "string", minLength: 1 }, count: { type: "integer", minimum: 0 } },
    },
    action: {
      type: "object", additionalProperties: false, required: ["action"],
      properties: { action: { type: "string", minLength: 1 }, outcome: { enum: ["succeeded", "failed", "rejected"] } },
    },
    goal: {
      type: "object", additionalProperties: false, required: ["id", "description", "successFacts"],
      properties: { id: { type: "string", minLength: 1 }, description: { type: "string", minLength: 1 }, successFacts: { type: "array", items: { $ref: "#/$defs/fact" } } },
    },
    evidencePolicy: {
      type: "object", additionalProperties: false,
      properties: {
        screenshots: { enum: ["none", "checkpoints", "events"] }, trace: { enum: ["off", "failure", "always"] },
        video: { enum: ["off", "failure", "always"] }, sampleFps: { type: "number", minimum: 0, maximum: 1 }, reviewRequired: { type: "boolean" },
      },
    },
  },
} as const;
