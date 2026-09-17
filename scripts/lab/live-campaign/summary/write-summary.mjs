import { writeFile } from "node:fs/promises";
import path from "node:path";
import { renderSummaryMarkdown } from "./markdown.mjs";

/** Writes the campaign summary as `summary.json` and `summary.md` in `outputDir`, replacing any earlier pair. */
export async function writeSummary(outputDir, summary) {
  await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(outputDir, "summary.md"), renderSummaryMarkdown(summary));
}
