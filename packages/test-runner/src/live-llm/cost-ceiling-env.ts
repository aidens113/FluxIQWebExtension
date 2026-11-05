// The per-build cost ceiling every Core the Lab starts is held to, as one
// configurable variable (the user, 2026-10-01: "the $0.1 ceiling should be an
// easily configurable variable ... even for test purposes in the lab").
//
// The configured amount comes from the Lab environment, then .env/.env.local.
// With nothing configured it is, in order: what an answer-first run names with
// `--llm-max-cost-usd` (an attempt's budget is the smaller of its own and this
// ceiling, so a run that names its budget has nothing else to remember), the $5
// Claude live-test default, then Core's test default, $0.10. `--llm-cost-ceiling-usd`
// can only lower it. Core consumes it only with the explicit test scope below; normal
// user UI defaults are separate.
//
// `FLUXIQ_TEST_ENV_FILES=none` with `FLUXIQ_PROVIDER_KEY_FILES=none` is a provider-free
// run's way of saying no env file of this checkout is any of its business
// (`./provider-credential.ts`), so with both set no file is opened here either.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV, resolveAutomationStudioLlmRunCostCeilingUsd } from "fluxiq/automation";
import { CLAUDE_LIVE_BUILD_COST_USD, DEFAULT_LLM_PROVIDER } from "@fluxiq-web-extension/test-contracts";
import { assertTestMayReadEnvFile } from "../env-files/index.js";
import { LAB_AUTHORING_MODE_FLAG, labAuthorsAnswerFirst } from "./authoring-mode-env.js";

/** The variable Core reads (`fluxiq/automation` `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV`). */
export const LAB_COST_CEILING_ENV = "FLUXIQ_LLM_RUN_COST_CEILING_USD";

/** Opt in only the Core child process owned by this Lab run. */
export const LAB_COST_CEILING_SCOPE_ENV = AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV;

/** The flag that sets it for one run. */
export const LAB_COST_CEILING_FLAG = "--llm-cost-ceiling-usd";

const FILES = [".env", ".env.local"];

const MAX_COST_FLAG = "--llm-max-cost-usd";

/** A provider-free run's two switches, both off: it may open no env file of the checkout. */
function readsNoEnvFiles(env: NodeJS.ProcessEnv): boolean {
  return env.FLUXIQ_TEST_ENV_FILES === "none" && env.FLUXIQ_PROVIDER_KEY_FILES === "none";
}

/**
 * The budget an answer-first run named, which stands as its ceiling when nothing is
 * configured. Without both flags there is none, so every other run's value stays what
 * it was. A value no resolver would take is left for Core's resolver to refuse.
 */
function answerFirstNamedBudget(args: readonly string[]): string | undefined {
  const mode = args.indexOf(LAB_AUTHORING_MODE_FLAG);
  if (mode < 0 || !labAuthorsAnswerFirst(args[mode + 1])) return undefined;
  const at = args.indexOf(MAX_COST_FLAG);
  const named = at < 0 ? undefined : args[at + 1];
  return named === undefined || named.startsWith("--") ? undefined : named;
}

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
 * checkout files; .env.local wins over .env. With neither, an answer-first run
 * that names `--llm-max-cost-usd` is held to that amount, Claude live runs default
 * to $5, and other runs retain Core's test default. `--llm-cost-ceiling-usd` may
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
  if (found === undefined && !readsNoEnvFiles(env)) {
    for (const file of FILES) {
      const full = path.join(repositoryRoot, file);
      if (!existsSync(full)) continue;
      // A test reads only an env file it wrote; a checkout's holds this machine's configuration and key.
      assertTestMayReadEnvFile(repositoryRoot, file);
      const value = dotenvValue(readFileSync(full, "utf8"), LAB_COST_CEILING_ENV);
      if (value !== undefined && value.trim() !== "") found = value;
    }
  }
  const scoped = (value?: string) => resolveAutomationStudioLlmRunCostCeilingUsd({
    [LAB_COST_CEILING_SCOPE_ENV]: "test",
    ...(value === undefined ? {} : { [LAB_COST_CEILING_ENV]: value })
  });
  const providerAt = args.indexOf("--llm-provider");
  const provider = providerAt < 0 ? DEFAULT_LLM_PROVIDER : args[providerAt + 1];
  const fallback = answerFirstNamedBudget(args) ?? (args.includes("--live-llm") && provider === "anthropic" ? String(CLAUDE_LIVE_BUILD_COST_USD) : undefined);
  const configured = scoped(found ?? fallback);
  if (at < 0) return String(configured);
  const requested = scoped(args[at + 1]);
  if (requested > configured) throw new Error(`${LAB_COST_CEILING_FLAG} cannot raise the configured Lab ceiling of $${configured.toFixed(2)}. Change ${LAB_COST_CEILING_ENV} in the Lab environment or checkout env file to configure a different ceiling.`);
  return String(requested);
}
