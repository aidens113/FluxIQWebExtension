// A metadata-only strict scoreboard; this command starts no model or browser.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectOfflineScoreboard } from "@fluxiq-web-extension/test-runner/offline-scoreboard";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--evidence" || !args[1]) throw new Error("Usage: node scripts/lab/offline-scoreboard.mjs --evidence test-runs/<label>");
const evidenceDirectory = path.resolve(repositoryRoot, args[1]);
const relative = path.relative(path.join(repositoryRoot, "test-runs"), evidenceDirectory);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("The scoreboard evidence must be in a run-scoped test-runs directory");
const scoreboard = await collectOfflineScoreboard({ repositoryRoot, fluxiqRepositoryRoot: path.resolve(repositoryRoot, "../!FluxIQ"), evidenceDirectory });
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(path.join(evidenceDirectory, "scoreboard.json"), JSON.stringify(scoreboard, null, 2));
const lines = ["| Site | Task | Verdict | Cause |", "| --- | --- | --- | --- |", ...scoreboard.rows.map((row) => `| ${row.scenarioId} | ${row.taskId} | ${row.verdict} | ${row.reasons.join(", ") || "four right, three continuations, zero later logical calls"} |`)];
await writeFile(path.join(evidenceDirectory, "scoreboard.md"), `${lines.join("\n")}\n`);
process.stdout.write(`${JSON.stringify({ success: scoreboard.rows.filter((row) => row.verdict === "SUCCESS").length, tasks: scoreboard.rows.length, gaps: scoreboard.gaps.length, externalUsd: 0, report: path.join(evidenceDirectory, "scoreboard.json") })}\n`);
process.exitCode = scoreboard.rows.every((row) => row.verdict === "SUCCESS") ? 0 : 1;
