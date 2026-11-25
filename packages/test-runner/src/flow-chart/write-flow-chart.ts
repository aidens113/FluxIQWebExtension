import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFlowChartSvg } from "./build-flow-chart-svg.js";
import type { ChartFlow, ChartRead } from "./chart/index.js";
import { readChartFlow } from "./read/index.js";
import { renderChartPng } from "./render-chart-png.js";

/**
 * Writes `flow.svg` and `flow.png` for a run directory, from its step files (`source` names the directory to read when it is not the one written to, or is the Flow itself).
 * Never throws and never slows a run with a retry: a failure writes `flow-chart-error.txt` instead. Returns the line
 * for the attempt report: the file's name and whether it shows the saved Flow or the draft, or why there is no image.
 */
export async function writeFlowChart(runDirectory: string, source: string | ChartRead | ChartFlow | null = runDirectory): Promise<string> {
  try {
    const charted = typeof source === "string" || (source !== null && "runDirectory" in source) ? await readChartFlow(source) : source;
    if (charted === null) return "Flow chart: none written, the attempt never got a draft of a Flow";
    const svg = buildFlowChartSvg(charted);
    await writeFile(path.join(runDirectory, "flow.svg"), svg);
    await writeFile(path.join(runDirectory, "flow.png"), await renderChartPng(svg));
    return `Flow chart: flow.png (and flow.svg) shows ${charted.attempt === undefined ? "" : `attempt ${charted.attempt}, `}the ${charted.source}, ${charted.nodes.length} node${charted.nodes.length === 1 ? "" : "s"}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(path.join(runDirectory, "flow-chart-error.txt"), `${message}\n`).catch(/* best-effort: the attempt carries on without the error file */ () => undefined);
    return `Flow chart: not written, see flow-chart-error.txt (${message})`;
  }
}
