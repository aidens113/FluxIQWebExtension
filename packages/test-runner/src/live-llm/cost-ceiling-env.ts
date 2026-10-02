// The per-build cost ceiling every Core the Lab starts is held to, as one
// configurable variable (the user, 2026-10-01: "the $0.1 ceiling should be an
// easily configurable variable ... even for test purposes in the lab").
//
// Core reads `FLUXIQ_LLM_RUN_COST_CEILING_USD` when it loads (default $0.10;
// a bad value stops it at start). The Lab passes the value it finds, in this
// order: the run's `--llm-cost-ceiling-usd` flag, the Lab's own environment,
// then `.env` and `.env.local` in the checkout -- the same files the provider
// key is read from (`scripts/lab/pair/provider-key.mjs`). Unset everywhere,
// nothing is passed and Core uses its default. This is the developer's and the
// Lab's knob; the product's spending limit is a separate user-facing setting.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** The variable Core reads (`fluxiq/automation-studio` `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV`). */
export const LAB_COST_CEILING_ENV = "FLUXIQ_LLM_RUN_COST_CEILING_USD";

/** The flag that sets it for one run. */
export const LAB_COST_CEILING_FLAG = "--llm-cost-ceiling-usd";

const FILES = [".env", ".env.local"];

/** The value of `name` in a dotenv file's text, or `undefined`. */
function dotenvValue(text: string, name: string): string | undefined {
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (match?.[1] !== name) continue;
    const value = match[2] ?? "";
    return value.replace(/^(['"])(.*)\1$/u, "$2");
  }
  return undefined;
}

/**
 * The ceiling to pass to Core, as Core will read it, or `undefined` when none is
 * configured: the flag, then the environment, then `.env` and `.env.local`
 * under `repositoryRoot` (a later file wins, as the provider key does).
 */
export function labCostCeilingValue(repositoryRoot: string, args: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const at = args.indexOf(LAB_COST_CEILING_FLAG);
  if (at >= 0) {
    const flagged = args[at + 1];
    if (flagged === undefined || flagged.startsWith("--")) throw new Error(`${LAB_COST_CEILING_FLAG} needs an amount in US dollars, such as 0.10`);
    return flagged;
  }
  const set = env[LAB_COST_CEILING_ENV];
  if (set !== undefined && set.trim() !== "") return set;
  let found: string | undefined;
  for (const file of FILES) {
    const full = path.join(repositoryRoot, file);
    if (!existsSync(full)) continue;
    const value = dotenvValue(readFileSync(full, "utf8"), LAB_COST_CEILING_ENV);
    if (value !== undefined && value.trim() !== "") found = value;
  }
  return found;
}
