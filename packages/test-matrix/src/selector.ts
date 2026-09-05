export const scenarioCatalog = [
  { id: "basic-form", tags: ["forms", "recording", "playback", "smoke"] },
  { id: "dynamic-list", tags: ["mutation", "recording", "identity"] },
  { id: "navigation", tags: ["navigation", "history", "recording"] },
  { id: "long-document", tags: ["scroll", "targeting", "visual"] },
  { id: "iframe-checkout", tags: ["iframe", "targeting", "visual"] },
  { id: "ambiguous-targets", tags: ["targeting", "accessibility"] },
  { id: "delayed-ui", tags: ["timing", "retry", "targeting"] },
  { id: "failure-surfaces", tags: ["failure", "policy", "targeting"] },
  { id: "reconnect", tags: ["gateway", "resilience", "worker"] },
  { id: "sensitive-input", tags: ["security", "redaction", "recording"] },
] as const;

export type ScenarioId = (typeof scenarioCatalog)[number]["id"];
export type RequiredGate = "static" | "browser-smoke" | "changed-scenarios" | "full-matrix";
export type ChangeSelection = {
  changedPaths: string[];
  scenarioIds: ScenarioId[];
  tags: string[];
  requiredGates: RequiredGate[];
  reasons: Array<{ path: string; rule: string }>;
};

type SelectionRule = {
  name: string;
  test: (path: string) => boolean;
  tags?: readonly string[];
  scenarios?: readonly ScenarioId[];
  gates: readonly RequiredGate[];
};

const allScenarioIds = scenarioCatalog.map(({ id }) => id);
const sourceExtension = (path: string) => path.startsWith("apps/extension/src/");

const rules: SelectionRule[] = [
  { name: "scenario-fixture", test: (path) => path.startsWith("apps/scenario-lab/src/scenarios/"), tags: ["fixture"], gates: ["static", "changed-scenarios"] },
  { name: "content-targeting", test: (path) => path.startsWith("apps/extension/src/content/") || path.startsWith("apps/extension/src/runtime/"), tags: ["targeting", "playback"], gates: ["static", "browser-smoke", "changed-scenarios"] },
  { name: "gateway-worker", test: (path) => path.startsWith("apps/extension/src/background/") || path.startsWith("apps/extension/src/shared/"), tags: ["gateway", "resilience", "worker", "recording"], gates: ["static", "browser-smoke", "changed-scenarios"] },
  { name: "extension-ui", test: (path) => path.startsWith("apps/extension/src/sidepanel/") || path.startsWith("apps/extension/src/popup/"), scenarios: ["basic-form"], gates: ["static", "browser-smoke", "changed-scenarios"] },
  { name: "extension-build", test: (path) => path.startsWith("apps/extension/scripts/") || /^apps\/extension\/manifest(?:\.|-)/.test(path) || path === "apps/extension/package.json", scenarios: allScenarioIds, gates: ["static", "browser-smoke", "full-matrix"] },
  { name: "recording-domain", test: (path) => path.startsWith("domain/src/recording/") || path.startsWith("domain/src/io/"), tags: ["recording", "redaction"], gates: ["static", "browser-smoke", "changed-scenarios"] },
  { name: "action-domain", test: (path) => path.startsWith("domain/src/actions/") || path.startsWith("domain/src/output-nodes/") || path.startsWith("domain/src/runtime/"), tags: ["playback", "targeting", "failure"], gates: ["static", "browser-smoke", "changed-scenarios"] },
  { name: "facility", test: (path) => path.startsWith("packages/test-runner/") || path.startsWith("packages/test-contracts/") || path.startsWith("apps/extension/e2e/"), scenarios: allScenarioIds, gates: ["static", "browser-smoke", "full-matrix"] },
  { name: "dependency-topology", test: (path) => ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(path) || path.startsWith("scripts/"), scenarios: allScenarioIds, gates: ["static", "browser-smoke", "full-matrix"] },
  { name: "docs-only", test: (path) => path.startsWith("docs/") || path === "README.md" || path === "AGENTS.md", gates: ["static"] },
  { name: "extension-fallback", test: sourceExtension, scenarios: allScenarioIds, gates: ["static", "browser-smoke", "full-matrix"] },
];

const normalizePath = (path: string) => path.trim().replaceAll("\\", "/").replace(/^\.\//, "");

function scenarioFromFixturePath(path: string): ScenarioId | undefined {
  const id = path.split("/")[4];
  return scenarioCatalog.some((scenario) => scenario.id === id) ? id as ScenarioId : undefined;
}

export function selectChangedCapabilities(paths: readonly string[]): ChangeSelection {
  const changedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))].sort();
  const selectedScenarios = new Set<ScenarioId>();
  const selectedTags = new Set<string>();
  const requiredGates = new Set<RequiredGate>(["static"]);
  const reasons: ChangeSelection["reasons"] = [];

  for (const path of changedPaths) {
    let matched = false;
    for (const rule of rules) {
      if (!rule.test(path)) continue;
      matched = true;
      reasons.push({ path, rule: rule.name });
      rule.tags?.forEach((tag) => selectedTags.add(tag));
      rule.scenarios?.forEach((scenario) => selectedScenarios.add(scenario));
      rule.gates.forEach((gate) => requiredGates.add(gate));
      if (rule.name === "scenario-fixture") {
        const fixture = scenarioFromFixturePath(path);
        if (fixture) selectedScenarios.add(fixture);
        else allScenarioIds.forEach((scenario) => selectedScenarios.add(scenario));
      }
      break;
    }
    if (!matched) {
      reasons.push({ path, rule: "safe-unknown" });
      allScenarioIds.forEach((scenario) => selectedScenarios.add(scenario));
      ["browser-smoke", "full-matrix"].forEach((gate) => requiredGates.add(gate as RequiredGate));
    }
  }

  for (const scenario of scenarioCatalog) {
    if (scenario.tags.some((tag) => selectedTags.has(tag))) selectedScenarios.add(scenario.id);
  }
  if (selectedScenarios.size > 0 && !requiredGates.has("full-matrix")) requiredGates.add("changed-scenarios");

  return {
    changedPaths,
    scenarioIds: [...selectedScenarios].sort(),
    tags: [...selectedTags].sort(),
    requiredGates: [...requiredGates].sort(),
    reasons,
  };
}
