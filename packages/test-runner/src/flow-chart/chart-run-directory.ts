import { mkdir } from "node:fs/promises";
import { writeFlowChart } from "./write-flow-chart.js";

/**
 * `lab flow-chart <run dir> [--out DIR]`: charts an existing run directory after the fact and prints what it wrote.
 * The run directory is only read; the images go beside it unless `--out` names another folder.
 */
export async function chartRunDirectory(runDirectory: string, outDirectory: string = runDirectory): Promise<number> {
  await mkdir(outDirectory, { recursive: true });
  const line = await writeFlowChart(outDirectory, runDirectory);
  process.stdout.write(`[flow-chart] ${runDirectory} -> ${outDirectory}: ${line}\n`);
  return line.includes("not written, see") ? 1 : 0;
}
