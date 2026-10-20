import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The ten realistic scenario ids, read from the runner's one list
 * (`packages/test-runner/src/realistic-scenarios/index.ts`). Every Lab or
 * browser test run opens only these (user rule, 2026-09-29), and the CI jobs
 * this package selects for open a browser, so the selector may only ever hand
 * them out.
 *
 * The list is imported from source, as the Lab's own scenario guard does
 * (`scripts/lab/scenario-guard/lab-scenario-refusal.mjs`): that file imports
 * nothing and uses only erasable TypeScript, which Node strips, so the runner
 * need not be built first. Nothing in this package restates the list.
 */
export async function loadRealisticScenarioIds(repositoryRoot: string): Promise<readonly string[]> {
  const listPath = path.join(repositoryRoot, "packages", "test-runner", "src", "realistic-scenarios", "index.ts");
  try {
    await access(listPath);
  } catch (cause) {
    throw new Error(`The realistic scenario list is missing: ${listPath}`, { cause });
  }
  const list = await import(pathToFileURL(listPath).href) as { REALISTIC_SCENARIO_IDS?: unknown };
  const ids = list.REALISTIC_SCENARIO_IDS;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    throw new Error(`The realistic scenario list does not export REALISTIC_SCENARIO_IDS as a nonempty string array: ${listPath}`);
  }
  return [...ids];
}
