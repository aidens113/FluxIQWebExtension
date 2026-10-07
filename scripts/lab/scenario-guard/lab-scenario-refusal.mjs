// The Lab launcher's scenario guard: `run-lab.mjs` asks it before the live-run
// guards, the Core checks and the build, so a run on any scenario outside the
// ten realistic ones starts nothing and records nothing in the spend ledger.
//
// The list is the runner's (`packages/test-runner/src/realistic-scenarios/index.ts`),
// imported from source because the runner may not be built yet: that file
// imports nothing and uses only erasable TypeScript, which Node strips.

import { unrealisticScenarioRefusal } from "../../../packages/test-runner/src/realistic-scenarios/index.ts";

/** The subcommands that name one scenario, right after the command. */
const ONE_SCENARIO = new Set(["run", "interactive", "replay"]);

/**
 * The refusal for Lab arguments that would open a scenario outside the ten, or
 * `null` when they open none or only realistic ones. `matrix --all` is
 * admitted: the runner expands it to the realistic scenarios only. A bench's
 * scenarios come from its corpus, which the runner checks once it has loaded it.
 *
 * @param {readonly string[]} args the Lab arguments, as `run-lab.mjs` received them
 * @returns {string | null}
 */
export function labScenarioRefusal(args) {
  const [command, ...rest] = args;
  if (command !== undefined && ONE_SCENARIO.has(command)) {
    const scenarioId = rest[0];
    if (scenarioId === undefined || scenarioId.startsWith("--")) {
      return `lab ${command} takes its scenario right after the command (lab ${command} <scenario> ...), so the Lab can hold it to the ten realistic scenarios before it builds or starts anything.`;
    }
    return unrealisticScenarioRefusal([scenarioId], `lab ${command}`);
  }
  if (command === "matrix") {
    const json = option(rest, "--scenarios-json");
    if (json === undefined) return null;
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      if (error instanceof SyntaxError) return `lab matrix --scenarios-json is not JSON, so the Lab cannot hold its scenarios to the ten realistic ones.`;
      throw error;
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) return `lab matrix --scenarios-json must be a JSON string array of scenario ids.`;
    return unrealisticScenarioRefusal(parsed, "lab matrix");
  }
  return null;
}

/** @param {readonly string[]} args @param {string} name */
function option(args, name) {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}
