import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertWebScenario, ContractValidationError, type ValidationIssue, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "./failure.js";

/**
 * `scenarioLabDist` names one Lab instance's compiled scenario lab; it defaults to the repository's own.
 *
 * Each manifest is validated twice: by the registry as it builds the manifest,
 * so a defective one throws while the registry is imported, and again here.
 * Either rejection fails as `fixture.invalid`. Before, the import's
 * `ContractValidationError` reached the run as `unknown`.
 */
export async function loadScenarioManifests(repositoryRoot: string, scenarioLabDist?: string): Promise<WebScenario[]> {
  const registryPath = path.join(scenarioLabDist ?? path.join(repositoryRoot, "apps", "scenario-lab", "dist"), "registry.js");
  try { await access(registryPath); } catch (cause) { throw new RunnerFailure("environment.missing", `Scenario Lab build is missing: ${registryPath}`, { cause }); }
  const registry = await asFixtureDefect(async () => await import(pathToFileURL(registryPath).href) as { listScenarioManifests?: () => unknown[] });
  const listScenarioManifests = registry.listScenarioManifests;
  if (typeof listScenarioManifests !== "function") throw new RunnerFailure("fixture.invalid", "Scenario Lab registry does not export listScenarioManifests()");
  return asFixtureDefect(() => listScenarioManifests().map((manifest) => { assertWebScenario(manifest); return manifest; }));
}

export async function loadScenarioManifest(repositoryRoot: string, scenarioId: string, scenarioLabDist?: string): Promise<WebScenario> {
  const manifest = (await loadScenarioManifests(repositoryRoot, scenarioLabDist)).find(candidate => candidate.id === scenarioId);
  if (!manifest) throw new RunnerFailure("fixture.invalid", `Unknown scenario: ${scenarioId}`);
  return manifest;
}

/**
 * A contract rejection becomes `fixture.invalid`. Every other failure is
 * rethrown unchanged, so a registry that cannot load keeps its own category: a
 * missing module is still `environment.missing`. The message holds only each
 * issue's path and the validator's wording. That wording names at most an
 * identifier the manifest declares, such as an action type. It never includes
 * a typed value, an expected record or a fact.
 */
async function asFixtureDefect<T>(load: () => T | Promise<T>): Promise<T> {
  try { return await load(); }
  catch (cause) {
    const issues = contractIssues(cause);
    if (!issues) throw cause;
    const defects = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new RunnerFailure("fixture.invalid", `Scenario Lab manifest failed contract validation: ${defects}`, { cause, details: { issuePaths: issues.map((issue) => issue.path) } });
  }
}

/**
 * The issues of a contract rejection. It is recognised by name as well as by
 * class: a Lab instance's scenario lab (`scenarioLabDist`) can resolve its own
 * copy of the contracts package, and that copy's error is a different class.
 */
function contractIssues(error: unknown): readonly ValidationIssue[] | undefined {
  if (!(error instanceof ContractValidationError) && !(error instanceof Error && error.name === "ContractValidationError")) return undefined;
  const { issues } = error as { issues?: unknown };
  if (!Array.isArray(issues)) return undefined;
  return issues.filter((issue): issue is ValidationIssue => typeof issue?.path === "string" && typeof issue?.message === "string");
}
