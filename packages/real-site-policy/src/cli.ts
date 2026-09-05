#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { evaluateRealSitePolicy } from "./policy.js";

async function main(argv = process.argv.slice(2)): Promise<void> {
  const policyPath = argv[0];
  if (!policyPath || argv.length !== 1) throw new Error("usage: fluxiq-real-site-policy <policy.json>");
  let input: unknown;
  try { input = JSON.parse(await readFile(policyPath, "utf8")) as unknown; }
  catch (error) { throw new Error(`cannot parse policy JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const decision = evaluateRealSitePolicy(input);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.allowed) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch((error: unknown) => {
  process.stderr.write(`real-site-policy: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
