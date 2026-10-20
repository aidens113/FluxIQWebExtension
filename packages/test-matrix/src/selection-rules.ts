/**
 * Which changed repository paths select which scenarios, and which CI gates
 * they require. For each changed path the first rule whose `test` matches
 * applies; a path no rule matches selects the whole corpus.
 *
 * `tags` are scenario tags as the Scenario Lab manifests carry them
 * (`WebScenario.tags`). The catalog is read from the registry, so a rule can
 * only select by a tag some registered manifest carries;
 * `tests/selection-rules.test.ts` fails when one does not. `scenarios` names
 * catalog scenario ids, or `"all"` for every catalog scenario. The catalog is
 * the ten realistic scenarios only, because every job these gates start opens
 * a browser (user rule, 2026-09-29).
 */
export type RequiredGate = "static" | "browser-smoke" | "changed-scenarios" | "full-matrix";

export type SelectionRule = {
  name: string;
  test: (path: string) => boolean;
  tags?: readonly string[];
  scenarios?: readonly string[] | "all";
  gates: readonly RequiredGate[];
};

// The catalog holds only the ten realistic scenarios (`scenario-catalog.ts`),
// so every tag below is one their manifests carry. Targeting covers what makes
// an element hard to find or act on; the gateway covers what crosses tabs or
// needs a permission; recording covers what a recorded step reads or fills.
// "smoke" is the one realistic scenario an extension UI change runs.
const smokeScenario = "everything-store";
const targetingTags = ["shadow-dom", "iframe", "generated-classes", "overlays", "modal", "consent-overlay", "lazy-load", "infinite-scroll", "honeypot"] as const;
const gatewayTags = ["new-tab", "multi-tab", "permission", "consequential", "rate-limit"] as const;
const recordingTags = ["forms", "search", "filters", "pagination", "variants", "variant-picker", "checkout", "extraction"] as const;
// "changed-scenarios" is added by the selector whenever a rule selects a
// scenario, and only then, so a change that selects none runs no browser job.
const runtimeGates = ["static", "browser-smoke"] as const;
const fullGates = ["static", "browser-smoke", "full-matrix"] as const;

export const selectionRules: readonly SelectionRule[] = [
  { name: "scenario-fixture", test: (path) => path.startsWith("apps/scenario-lab/src/scenarios/"), gates: ["static"] },
  { name: "content-targeting", test: (path) => path.startsWith("apps/extension/src/content/") || path.startsWith("apps/extension/src/runtime/"), tags: targetingTags, gates: runtimeGates },
  { name: "gateway-worker", test: (path) => path.startsWith("apps/extension/src/background/") || path.startsWith("apps/extension/src/shared/"), tags: gatewayTags, scenarios: [smokeScenario], gates: runtimeGates },
  { name: "extension-ui", test: (path) => path.startsWith("apps/extension/src/sidepanel/") || path.startsWith("apps/extension/src/popup/"), scenarios: [smokeScenario], gates: runtimeGates },
  { name: "extension-build", test: (path) => path.startsWith("apps/extension/scripts/") || /^apps\/extension\/manifest(?:\.|-)/.test(path) || path === "apps/extension/package.json", scenarios: "all", gates: fullGates },
  { name: "recording-domain", test: (path) => path.startsWith("domain/src/recording/") || path.startsWith("domain/src/io/"), tags: recordingTags, scenarios: [smokeScenario], gates: runtimeGates },
  { name: "action-domain", test: (path) => path.startsWith("domain/src/actions/") || path.startsWith("domain/src/output-nodes/") || path.startsWith("domain/src/runtime/"), tags: [...targetingTags, ...gatewayTags, "purchase"], gates: runtimeGates },
  { name: "facility", test: (path) => path.startsWith("packages/test-runner/") || path.startsWith("packages/test-contracts/") || path.startsWith("apps/extension/e2e/"), scenarios: "all", gates: fullGates },
  { name: "dependency-topology", test: (path) => ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(path) || path.startsWith("scripts/"), scenarios: "all", gates: fullGates },
  { name: "docs-only", test: (path) => path.startsWith("docs/") || path === "README.md" || path === "AGENTS.md", gates: ["static"] },
  { name: "extension-fallback", test: (path) => path.startsWith("apps/extension/src/"), scenarios: "all", gates: fullGates },
];
