// The per-build cost ceiling every Core the Lab starts is held to, as one
// configurable variable (the user, 2026-10-01: "the $0.1 ceiling should be an
// easily configurable variable ... even for test purposes in the lab").
//
// The configured amount comes from the Lab environment, then .env/.env.local,
// or the $0.10 test default. A run flag can only lower it. Core consumes it
// only with the explicit test scope below; normal user UI defaults are separate.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV, resolveAutomationStudioLlmRunCostCeilingUsd } from "fluxiq/automation-studio";

/** The variable Core reads (`fluxiq/automation-studio` `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV`). */
export const LAB_COST_CEILING_ENV = "FLUXIQ_LLM_RUN_COST_CEILING_USD";

/** Opt in only the Core child process owned by this Lab run. */
export const LAB_COST_CEILING_SCOPE_ENV = AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV;

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
 * One test-scoped ceiling for Core and the Lab plan. The environment wins over
 * checkout files; .env.local wins over .env. The default is $0.10. A flag may
 * lower that configured amount, but may never bypass it with a higher amount.
 */
export function labCostCeilingValue(repositoryRoot: string, args: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): string {
  const at = args.indexOf(LAB_COST_CEILING_FLAG);
  if (at >= 0) {
    const flagged = args[at + 1];
    if (flagged === undefined || flagged.startsWith("--")) throw new Error(`${LAB_COST_CEILING_FLAG} needs an amount in US dollars, such as 0.10`);
  }
  const set = env[LAB_COST_CEILING_ENV];
  let found = set !== undefined && set.trim() !== "" ? set : undefined;
  if (found === undefined) {
    for (const file of FILES) {
      const full = path.join(repositoryRoot, file);
      if (!existsSync(full)) continue;
      const value = dotenvValue(readFileSync(full, "utf8"), LAB_COST_CEILING_ENV);
      if (value !== undefined && value.trim() !== "") found = value;
    }
  }
  const scoped = (value?: string) => resolveAutomationStudioLlmRunCostCeilingUsd({
    [LAB_COST_CEILING_SCOPE_ENV]: "test",
    ...(value === undefined ? {} : { [LAB_COST_CEILING_ENV]: value })
  });
  const configured = scoped(found);
  if (at < 0) return String(configured);
  const requested = scoped(args[at + 1]);
  if (requested > configured) throw new Error(`${LAB_COST_CEILING_FLAG} cannot raise the configured Lab ceiling of $${configured.toFixed(2)}. Change ${LAB_COST_CEILING_ENV} in the Lab environment or checkout env file to configure a different ceiling.`);
  return String(requested);
}
