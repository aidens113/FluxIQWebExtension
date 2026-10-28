import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";

/**
 * The demonstration the command names, or a `fixture.invalid` refusal before anything starts.
 *
 * Its task must be the very task the run builds: a recording of another task's honest path would
 * make the build's instruction and its evidence disagree for a reason nobody chose. A
 * demonstration that deliberately shows something other than the written task
 * (`conflictsWithInstruction`) probes that the instruction wins, and runs only when the operator
 * says so with `--demonstration-probe`.
 */
export function selectDemonstration(
  catalog: readonly ScenarioDemonstration[],
  request: Readonly<{ id: string; scenarioId: string; taskId: string; probe: boolean }>,
): ScenarioDemonstration {
  const found = catalog.find((candidate) => candidate.id === request.id);
  if (!found) throw refusal(request.id, `is not in the catalog (${catalog.map((candidate) => candidate.id).join(", ") || "it is empty"})`);
  if (found.scenarioId !== request.scenarioId) throw refusal(found.id, `belongs to scenario ${found.scenarioId}, not ${request.scenarioId}`);
  if (found.taskId !== request.taskId) throw refusal(found.id, `was written for task ${found.taskId}, not --instruction-task ${request.taskId}`);
  if (found.conflictsWithInstruction === true && !request.probe) throw refusal(found.id, "shows something other than its task's written instruction, so it runs only as a probe: add --demonstration-probe");
  return found;
}

function refusal(id: string, problem: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `Demonstration ${id} ${problem}`, { details: { demonstrationId: id } });
}
