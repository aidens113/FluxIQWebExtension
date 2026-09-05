#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { auditPromotionBoundary } from "./audit.js";
import { findPackageConsumers, readCandidateSources } from "./repository-scan.js";

async function main(argv = process.argv.slice(2)): Promise<void> {
  const repositoryRoot = path.resolve(valueAfter(argv, "--repository") ?? process.cwd());
  const coreRoot = path.resolve(valueAfter(argv, "--core") ?? path.join(repositoryRoot, "..", "!FluxIQ"));
  const candidateRoot = path.resolve(valueAfter(argv, "--candidate") ?? path.join(repositoryRoot, "packages", "test-contracts"));
  const packageName = valueAfter(argv, "--package") ?? "@fluxiq-web-extension/test-contracts";
  const output = valueAfter(argv, "--output");
  const sources = await readCandidateSources(candidateRoot);
  if (sources.length === 0) throw new Error(`no candidate sources found under ${candidateRoot}`);
  const consumers = [
    ...await findPackageConsumers(repositoryRoot, "fluxiq-web-extension", packageName, candidateRoot),
    ...await findPackageConsumers(coreRoot, "fluxiq-core", packageName),
  ];
  const report = auditPromotionBoundary({
    candidate: { name: packageName, path: slash(path.relative(repositoryRoot, candidateRoot)), sources },
    consumers,
    auditedRepositories: [slash(repositoryRoot), slash(coreRoot)],
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    const outputPath = path.resolve(output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, "utf8");
  }
  process.stdout.write(json);
  if (argv.includes("--require-eligible") && report.recommendation !== "promote-eligible") process.exitCode = 2;
}

function valueAfter(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}
const slash = (value: string) => value.replaceAll("\\", "/");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`boundary-audit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
