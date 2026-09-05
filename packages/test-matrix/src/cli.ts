#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { selectChangedCapabilities } from "./selector.js";

type Options = { paths: string[]; githubOutput?: string };

async function parseOptions(argv: string[]): Promise<Options> {
  const paths: string[] = [];
  let githubOutput: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--paths-file") {
      const file = argv[index + 1];
      if (!file) throw new Error("--paths-file requires a path");
      paths.push(...(await readFile(file, "utf8")).split(/\r?\n/u));
      index += 1;
    } else if (argument === "--github-output") {
      githubOutput = argv[index + 1] ?? process.env.GITHUB_OUTPUT;
      if (!githubOutput) throw new Error("--github-output requires a path or GITHUB_OUTPUT");
      if (argv[index + 1]) index += 1;
    } else if (argument?.startsWith("-")) {
      throw new Error(`unknown option: ${argument}`);
    } else if (argument) paths.push(argument);
  }
  return githubOutput ? { paths, githubOutput } : { paths };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = await parseOptions(argv);
  const selection = selectChangedCapabilities(options.paths);
  process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
  if (options.githubOutput) {
    const gates = new Set(selection.requiredGates);
    await appendFile(options.githubOutput, [
      `scenario_ids=${JSON.stringify(selection.scenarioIds)}`,
      `required_gates=${JSON.stringify(selection.requiredGates)}`,
      `run_browser_smoke=${String(gates.has("browser-smoke"))}`,
      `run_changed_scenarios=${String(gates.has("changed-scenarios") || gates.has("full-matrix"))}`,
      `run_full_matrix=${String(gates.has("full-matrix"))}`,
      "",
    ].join("\n"), "utf8");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`test-matrix: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
