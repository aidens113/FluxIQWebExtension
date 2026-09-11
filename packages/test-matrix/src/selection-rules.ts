/**
 * Which changed repository paths select which scenarios, and which CI gates
 * they require. For each changed path the first rule whose `test` matches
 * applies; a path no rule matches selects the whole corpus.
 *
 * `tags` are scenario tags as the Scenario Lab manifests carry them
 * (`WebScenario.tags`). The catalog is read from the registry, so a rule can
 * only select by a tag some registered manifest carries;
 * `tests/selection-rules.test.ts` fails when one does not. `scenarios` names
 * registered scenario ids, or `"all"` for every registered scenario.
 */
export type RequiredGate = "static" | "browser-smoke" | "changed-scenarios" | "full-matrix";

export type SelectionRule = {
  name: string;
  test: (path: string) => boolean;
  tags?: readonly string[];
  scenarios?: readonly string[] | "all";
  gates: readonly RequiredGate[];
};

// Manifests carry no "recording" or "playback" tag, so the recording rules
// name the manifest tags of the scenarios that record: dynamic-list's
// "identity", navigation's "navigation" and "history", sensitive-input's
// "redaction" and "security". "smoke" is basic-form, which every
// runtime-facing change runs.
const targetingTags = ["smoke", "targeting", "ambiguity", "coordinates", "scroll", "iframe", "wait", "retry", "failure", "target-drift"] as const;
const recordingTags = ["smoke", "identity", "navigation", "history", "redaction", "security"] as const;
const runtimeGates = ["static", "browser-smoke", "changed-scenarios"] as const;
const fullGates = ["static", "browser-smoke", "full-matrix"] as const;

export const selectionRules: readonly SelectionRule[] = [
  { name: "scenario-fixture", test: (path) => path.startsWith("apps/scenario-lab/src/scenarios/"), gates: ["static", "changed-scenarios"] },
  { name: "content-targeting", test: (path) => path.startsWith("apps/extension/src/content/") || path.startsWith("apps/extension/src/runtime/"), tags: targetingTags, gates: runtimeGates },
  { name: "gateway-worker", test: (path) => path.startsWith("apps/extension/src/background/") || path.startsWith("apps/extension/src/shared/"), tags: ["gateway", "resilience", "smoke", "identity", "navigation", "redaction"], gates: runtimeGates },
  { name: "extension-ui", test: (path) => path.startsWith("apps/extension/src/sidepanel/") || path.startsWith("apps/extension/src/popup/"), scenarios: ["basic-form"], gates: runtimeGates },
  { name: "extension-build", test: (path) => path.startsWith("apps/extension/scripts/") || /^apps\/extension\/manifest(?:\.|-)/.test(path) || path === "apps/extension/package.json", scenarios: "all", gates: fullGates },
  { name: "recording-domain", test: (path) => path.startsWith("domain/src/recording/") || path.startsWith("domain/src/io/"), tags: recordingTags, gates: runtimeGates },
  { name: "action-domain", test: (path) => path.startsWith("domain/src/actions/") || path.startsWith("domain/src/output-nodes/") || path.startsWith("domain/src/runtime/"), tags: [...targetingTags, "safety", "llm", "diagnosis"], gates: runtimeGates },
  { name: "facility", test: (path) => path.startsWith("packages/test-runner/") || path.startsWith("packages/test-contracts/") || path.startsWith("apps/extension/e2e/"), scenarios: "all", gates: fullGates },
  { name: "dependency-topology", test: (path) => ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(path) || path.startsWith("scripts/"), scenarios: "all", gates: fullGates },
  { name: "docs-only", test: (path) => path.startsWith("docs/") || path === "README.md" || path === "AGENTS.md", gates: ["static"] },
  { name: "extension-fallback", test: (path) => path.startsWith("apps/extension/src/"), scenarios: "all", gates: fullGates },
];
