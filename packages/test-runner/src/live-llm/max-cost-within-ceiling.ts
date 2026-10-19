// `--llm-max-cost-usd` may only lower the per-build ceiling the run's Core
// resolves (`liveLlmBuildCostCeilingUsd`); a typed number above it is refused
// rather than clamped. The plan used to take the lower of the two in silence:
// on 2026-10-18 twelve launches typed `--llm-max-cost-usd 0.25` without the
// variable that raises Core's ceiling, were held to Core's lower default, and
// two builds stopped on a ceiling nobody had typed.
//
// Read from the run's own arguments, not the parsed profile, because the
// profile gives an unset flag the Lab contract's largest amount and so cannot
// tell "not typed" from "typed high". An unusable value is the command
// parser's to refuse (`../commands.ts`).

import { RunnerFailure } from "../failure.js";
import { LAB_COST_CEILING_ENV, LAB_COST_CEILING_FLAG } from "./cost-ceiling-env.js";

const FLAG = "--llm-max-cost-usd";

/**
 * Refuses, before anything is allocated or started, a `--llm-max-cost-usd`
 * in `args` above `ceilingUsd`, the per-build ceiling the run's Core resolves.
 * Equal or lower amounts, and an absent flag, pass.
 */
export function assertLlmMaxCostWithinCeiling(args: readonly string[], ceilingUsd: number): void {
  const at = args.indexOf(FLAG);
  if (at < 0) return;
  const requested = Number(args[at + 1]);
  if (!Number.isFinite(requested) || requested <= ceilingUsd) return;
  throw new RunnerFailure("fixture.invalid", `Live LLM execution refused: ${FLAG} ${requested} is above the per-build cost ceiling of $${ceilingUsd} this run's Core resolves, and would be held to $${ceilingUsd} without saying so. To raise the ceiling, set ${LAB_COST_CEILING_ENV}=${requested} in the Lab's environment or the checkout's .env/.env.local (${LAB_COST_CEILING_FLAG} can only lower it); otherwise pass ${FLAG} at or below ${ceilingUsd}, or leave it out.`);
}
