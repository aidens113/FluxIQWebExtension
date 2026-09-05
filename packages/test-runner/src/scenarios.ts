import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertWebScenario, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "./failure.js";

export async function loadScenarioManifests(repositoryRoot: string): Promise<WebScenario[]> {
  const registryPath = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "registry.js");
  try { await access(registryPath); } catch (cause) { throw new RunnerFailure("environment.missing", `Scenario Lab build is missing: ${registryPath}`, { cause }); }
  const registry = await import(pathToFileURL(registryPath).href) as { listScenarioManifests?: () => unknown[] };
  if (typeof registry.listScenarioManifests !== "function") throw new RunnerFailure("fixture.invalid", "Scenario Lab registry does not export listScenarioManifests()");
  const manifests = registry.listScenarioManifests();
  const checked: WebScenario[] = [];
  for (const manifest of manifests) { assertWebScenario(manifest); checked.push(manifest); }
  return checked;
}

export async function loadScenarioManifest(repositoryRoot: string, scenarioId: string): Promise<WebScenario> {
  const manifest = (await loadScenarioManifests(repositoryRoot)).find(candidate => candidate.id === scenarioId);
  if (!manifest) throw new RunnerFailure("fixture.invalid", `Unknown scenario: ${scenarioId}`);
  return manifest;
}

export function scenarioRequiresCore(scenario: WebScenario): boolean {
  return Boolean(scenario.expected.recordingEvents?.length || scenario.expected.actions?.length || scenario.playbackGoal);
}
