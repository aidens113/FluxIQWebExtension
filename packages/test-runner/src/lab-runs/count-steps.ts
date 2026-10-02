import { readdir } from "node:fs/promises";

/** A step folder Core writes: `NNNN-<kind>`, `NNNN-tool-<toolId>` or `NNNN-test-<toolId>`. */
const STEP_FOLDER = /^\d{4,}-/u;

/** How many step folders a run's `steps/` holds now; none when it does not exist. */
export async function countSteps(stepsDirectory: string): Promise<number> {
  try {
    return (await readdir(stepsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory() && STEP_FOLDER.test(entry.name)).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}
