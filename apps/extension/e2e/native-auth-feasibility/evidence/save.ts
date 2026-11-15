import { mkdir, writeFile } from "node:fs/promises";
import type { ProbeEvidence } from "../model.js";

type EvidenceOutput = { outputDir: string; outputPath(name: string): string; attach(name: string, options: { path: string; contentType: string }): Promise<void> };

/** Persist only the closed projection; a list reporter need not retain Buffer attachments. */
export async function saveNativeProbeEvidence(output: EvidenceOutput, evidence: readonly ProbeEvidence[]): Promise<void> {
  await mkdir(output.outputDir, { recursive: true });
  const file = output.outputPath("native-auth-observations.json");
  await writeFile(file, JSON.stringify(evidence), "utf8");
  await output.attach("native-auth-observations.json", { path: file, contentType: "application/json" });
}
