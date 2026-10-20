import type { ScenarioCatalog } from "./scenario-catalog.js";
import { selectionRules, type RequiredGate } from "./selection-rules.js";

export type ChangeSelection = {
  changedPaths: string[];
  scenarioIds: string[];
  tags: string[];
  requiredGates: RequiredGate[];
  reasons: Array<{ path: string; rule: string }>;
};

// Every tag some rule selects by. A registered scenario carrying none of them
// is unclassified: no rule can say which changes affect it, so every
// tag-selecting rule selects it, as an unknown path selects the whole corpus.
// It narrows once its manifest and a rule share a tag.
const capabilityTags = new Set(selectionRules.flatMap((rule) => rule.tags ?? []));

const normalizePath = (path: string) => path.trim().replaceAll("\\", "/").replace(/^\.\//, "");

/**
 * What a change under `apps/scenario-lab/src/scenarios/` selects: a catalog
 * scenario's own directory selects that scenario; a file directly in the
 * scenarios directory (shared tasks and the barrel) selects the whole catalog;
 * any other directory belongs to a scenario no browser job may open (or to the
 * shared unit-test helpers), whose unit tests run in the static gate, so it
 * selects none.
 */
function scenariosFromFixturePath(path: string, catalog: ScenarioCatalog): readonly string[] {
  const segments = path.split("/");
  if (segments.length <= 5) return catalog.map(({ id }) => id);
  const id = segments[4];
  return catalog.some((scenario) => scenario.id === id) ? [id!] : [];
}

export function selectChangedCapabilities(paths: readonly string[], catalog: ScenarioCatalog): ChangeSelection {
  const allScenarioIds = catalog.map(({ id }) => id);
  const changedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))].sort();
  const selectedScenarios = new Set<string>();
  const selectedTags = new Set<string>();
  const requiredGates = new Set<RequiredGate>(["static"]);
  const reasons: ChangeSelection["reasons"] = [];

  for (const path of changedPaths) {
    const rule = selectionRules.find((candidate) => candidate.test(path));
    if (!rule) {
      reasons.push({ path, rule: "safe-unknown" });
      allScenarioIds.forEach((scenario) => selectedScenarios.add(scenario));
      requiredGates.add("browser-smoke");
      requiredGates.add("full-matrix");
      continue;
    }
    reasons.push({ path, rule: rule.name });
    rule.tags?.forEach((tag) => selectedTags.add(tag));
    (rule.scenarios === "all" ? allScenarioIds : rule.scenarios)?.forEach((scenario) => selectedScenarios.add(scenario));
    rule.gates.forEach((gate) => requiredGates.add(gate));
    if (rule.name === "scenario-fixture") scenariosFromFixturePath(path, catalog).forEach((scenario) => selectedScenarios.add(scenario));
  }

  if (selectedTags.size > 0) {
    for (const scenario of catalog) {
      const unclassified = !scenario.tags.some((tag) => capabilityTags.has(tag));
      if (unclassified || scenario.tags.some((tag) => selectedTags.has(tag))) selectedScenarios.add(scenario.id);
    }
  }
  // Only scenarios the catalog holds (the ten realistic ones) are ever handed out.
  const catalogIds = new Set(allScenarioIds);
  for (const scenario of selectedScenarios) if (!catalogIds.has(scenario)) selectedScenarios.delete(scenario);
  if (selectedScenarios.size > 0 && !requiredGates.has("full-matrix")) requiredGates.add("changed-scenarios");

  return {
    changedPaths,
    scenarioIds: [...selectedScenarios].sort(),
    tags: [...selectedTags].sort(),
    requiredGates: [...requiredGates].sort(),
    reasons,
  };
}
