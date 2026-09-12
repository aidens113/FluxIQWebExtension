import { AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, type AutomationStudioAdaptiveFailureClass } from "./failure-category.js";

export const SCENARIO_SCHEMA_VERSION = "0.1" as const;

/** Upper bound on pages an extract step may follow, shared by the validator and the JSON Schema. */
export const SCENARIO_EXTRACT_MAX_PAGES = 50;

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

/**
 * Operations a recording script may perform. The recording lane drives each
 * through Playwright while the extension records; `extract` is an authored
 * data-extraction step that performs no page interaction of its own.
 */
export const scenarioStepOperations = [
  "click",
  "type",
  "select",
  "scroll",
  "navigate",
  "waitForState",
  "checkpoint",
  "press",
  "check",
  "upload",
  "switchTab",
  "closeTab",
  "waitForDownload",
  "extract",
] as const;

export type ScenarioStepOperation = (typeof scenarioStepOperations)[number];

/** Follow the `next` control until it is absent or `maxPages` pages, the first included, were read. */
export type ScenarioExtractPagination = { next: string; maxPages: number };

/**
 * One recording-script step. `target` is required for click, type, select,
 * waitForState, check, upload, and extract; `path` for navigate and for
 * switchTab (the open tab whose URL path matches); `value` for type, select,
 * scroll, press (a key name), check (a boolean), upload (a file name), and
 * waitForDownload (the suggested file name). `fields` and `pagination` belong
 * to extract only: `fields` maps a field name to a selector inside each item
 * matched by `target`, `selector@attribute` reads an attribute, not text, and
 * `column:<header text>` reads the cell under that header when items are
 * table rows, so extraction survives a column reorder.
 */
export type ScenarioStep = {
  id: string;
  operation: ScenarioStepOperation;
  target?: string;
  value?: string | number | boolean;
  path?: string;
  timeoutMs?: number;
  fields?: Record<string, string>;
  pagination?: ScenarioExtractPagination;
};

export type ExpectedFact = { id: string; subject: string; predicate: string; value: unknown };
export type ExpectedEvent = { type: string; count?: number };
export type ExpectedAction = { action: string; outcome?: "succeeded" | "failed" | "rejected" };
/**
 * What an extract step must yield. `count` is the exact number of records;
 * `records` is the complete expected list, compared exactly and in order, so
 * a longer or shorter result fails. When both are given, both must hold.
 */
export type ExpectedExtraction = { step: string; count?: number; records?: Array<Record<string, string>> };
/** The failure category a negative scenario or variant must be classified as, in Core's taxonomy. */
export type ExpectedFailure = { category: AutomationStudioAdaptiveFailureClass; code?: string };
export type ScenarioGoal = { id: string; description: string; successFacts: ExpectedFact[] };

export type ScenarioExpected = {
  pageFacts?: ExpectedFact[];
  recordingEvents?: ExpectedEvent[];
  actions?: ExpectedAction[];
  finalState?: ExpectedFact[];
  allowedConsoleErrors?: string[];
  extracted?: ExpectedExtraction[];
  failure?: ExpectedFailure;
};

/**
 * Another mode of the same fixture: drift, a negative case, or an alternate
 * data shape. `arm` is applied through the fixture's `mutate(operation,
 * payload)` after recording and before the run, and the fixture decides when
 * the armed behaviour shows. A variant never changes the recording: the
 * recording lane always runs the workflow unarmed and checks the workflow's
 * own recording-time expectations (`pageFacts`, `recordingEvents`). The
 * variant's `expected` governs the armed run: each field it sets replaces the
 * workflow's field of the same name, and omitted fields are inherited
 * (`resolveScenarioWorkflow`).
 */
export type ScenarioVariant = {
  id: string;
  description: string;
  arm: { operation: string; payload?: unknown };
  expected: ScenarioExpected;
};

/**
 * A further workflow on the same fixture. The manifest's own
 * `recordingScript`, `expected`, and `variants` form its primary workflow;
 * each entry here is another corpus workflow with its own script,
 * expectations, and variants.
 */
export type ScenarioWorkflow = {
  id: string;
  description: string;
  recordingScript: ScenarioStep[];
  expected: ScenarioExpected;
  variants?: ScenarioVariant[];
};

/**
 * A value the fixture requires at replay that must never be taken from the
 * recording. `step` names the recording-script step whose recorded value is
 * the secret, and `id` names the secret the lane supplies instead: the Flow
 * lane resolves it from `FLUXIQ_TEST_SECRET_<ID>` (the id upper-cased, with
 * hyphens as underscores) and hands it to the Flow run, so a recorded
 * password is never what replays.
 */
export type ScenarioSecret = { id: string; step: string };

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
  expected: ScenarioExpected;
  variants?: ScenarioVariant[];
  workflows?: ScenarioWorkflow[];
  /** Values the Flow lane supplies at replay instead of replaying the recorded one. */
  secrets?: ScenarioSecret[];
  evidencePolicy?: Partial<ScenarioEvidencePolicy>;
};

const stringArray = { type: "array", items: { type: "string" } } as const;
const kebabId = { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", minLength: 1 } as const;

/** Portable JSON Schema for editors and non-TypeScript scenario producers. */
export const webScenarioJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://fluxiq.local/schemas/web-scenario-0.1.json",
  title: "FluxIQ Web Test Scenario",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "title", "tags", "seed", "startPath", "capabilities", "networkPolicy", "recordingScript", "expected"],
  allOf: [{
    if: { properties: { recordingScript: { maxItems: 0 } }, required: ["recordingScript"] },
    then: { required: ["playbackGoal"] },
  }],
  properties: {
    schemaVersion: { const: SCENARIO_SCHEMA_VERSION },
    id: kebabId,
    title: { type: "string", minLength: 1 },
    tags: { ...stringArray, uniqueItems: true },
    seed: { type: "integer", minimum: 0, maximum: 4294967295 },
    startPath: { type: "string", pattern: "^/" },
    capabilities: { type: "array", uniqueItems: true, items: { enum: scenarioCapabilities } },
    networkPolicy: { enum: ["loopback-only", "allowlisted-real-site"] },
    recordingScript: { type: "array", items: { $ref: "#/$defs/step" } },
    playbackGoal: { $ref: "#/$defs/goal" },
    expected: { $ref: "#/$defs/expected" },
    variants: { type: "array", items: { $ref: "#/$defs/variant" } },
    workflows: { type: "array", items: { $ref: "#/$defs/workflow" } },
    secrets: { type: "array", items: { $ref: "#/$defs/secret" } },
    evidencePolicy: { $ref: "#/$defs/evidencePolicy" },
  },
  $defs: {
    step: {
      type: "object", additionalProperties: false, required: ["id", "operation"],
      properties: {
        id: { type: "string", minLength: 1 },
        operation: { enum: scenarioStepOperations },
        target: { type: "string", minLength: 1 }, value: { type: ["string", "number", "boolean"] },
        path: { type: "string", pattern: "^/" }, timeoutMs: { type: "integer", minimum: 0 },
        fields: { type: "object", minProperties: 1, additionalProperties: { type: "string", minLength: 1 } },
        pagination: {
          type: "object", additionalProperties: false, required: ["next", "maxPages"],
          properties: { next: { type: "string", minLength: 1 }, maxPages: { type: "integer", minimum: 1, maximum: SCENARIO_EXTRACT_MAX_PAGES } },
        },
      },
    },
    expected: {
      type: "object",
      additionalProperties: false,
      properties: {
        pageFacts: { type: "array", items: { $ref: "#/$defs/fact" } },
        recordingEvents: { type: "array", items: { $ref: "#/$defs/event" } },
        actions: { type: "array", items: { $ref: "#/$defs/action" } },
        finalState: { type: "array", items: { $ref: "#/$defs/fact" } },
        allowedConsoleErrors: stringArray,
        extracted: { type: "array", items: { $ref: "#/$defs/extraction" } },
        failure: { $ref: "#/$defs/failure" },
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
    extraction: {
      type: "object", additionalProperties: false, required: ["step"],
      anyOf: [{ required: ["count"] }, { required: ["records"] }],
      properties: {
        step: { type: "string", minLength: 1 }, count: { type: "integer", minimum: 0 },
        records: { type: "array", items: { type: "object", additionalProperties: { type: "string" } } },
      },
    },
    failure: {
      type: "object", additionalProperties: false, required: ["category"],
      properties: { category: { enum: AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES }, code: { type: "string", minLength: 1 } },
    },
    secret: {
      type: "object", additionalProperties: false, required: ["id", "step"],
      properties: { id: kebabId, step: { type: "string", minLength: 1 } },
    },
    variant: {
      type: "object", additionalProperties: false, required: ["id", "description", "arm", "expected"],
      properties: {
        id: kebabId,
        description: { type: "string", minLength: 1 },
        arm: {
          type: "object", additionalProperties: false, required: ["operation"],
          properties: { operation: { type: "string", minLength: 1 }, payload: {} },
        },
        expected: { $ref: "#/$defs/expected" },
      },
    },
    workflow: {
      type: "object", additionalProperties: false, required: ["id", "description", "recordingScript", "expected"],
      properties: {
        id: kebabId,
        description: { type: "string", minLength: 1 },
        recordingScript: { type: "array", minItems: 1, items: { $ref: "#/$defs/step" } },
        expected: { $ref: "#/$defs/expected" },
        variants: { type: "array", items: { $ref: "#/$defs/variant" } },
      },
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
