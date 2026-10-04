import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_ENV, AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_SCOPE_ENV } from "fluxiq/automation-studio";
import type { RunAllocation } from "./allocation.js";
import { LAB_COST_CEILING_ENV, LAB_COST_CEILING_SCOPE_ENV, LAB_DEFAULT_MODEL_ENV, labBuildCallLimitEnvironment, labCostCeilingValue, labDefaultModelValue } from "./live-llm/index.js";

/**
 * Provider credentials belong to the test driver. Child processes receive an
 * opaque key reference through FluxIQ state, never the source credential.
 * Keep this list explicit so unrelated runner tokens and application settings
 * are not accidentally removed.
 */
export const PROVIDER_SECRET_ENVIRONMENT_VARIABLES = Object.freeze([
  "ANTHROPIC_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
  "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_KEY", "BEDROCK_API_KEY", "COHERE_API_KEY",
  "DEEPSEEK_API_KEY", "FIREWORKS_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY",
  "GROQ_API_KEY", "HF_TOKEN", "HUGGINGFACEHUB_API_TOKEN", "LLM_API_KEY",
  "MISTRAL_API_KEY", "OLLAMA_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY",
  "PERPLEXITY_API_KEY", "TOGETHER_API_KEY", "VERTEX_AI_API_KEY", "XAI_API_KEY",
] as const);

const PROVIDER_SECRET_ENVIRONMENT_KEYS = new Set<string>(PROVIDER_SECRET_ENVIRONMENT_VARIABLES);

export function withoutProviderSecrets(base: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(base).filter((entry): entry is [string, string] => entry[1] !== undefined && !PROVIDER_SECRET_ENVIRONMENT_KEYS.has(entry[0].toUpperCase())));
}
export type TopologyPaths = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  hostModulePath?: string;
  /** The resolved live plan, supplied before startup; absent for an unplanned run. */
  buildCallLimit?: number;
  /**
   * Where Core writes one folder per model and tool step of the run, as
   * `FLUXIQ_LLM_STEP_LOG_DIR` (`runtime/llm/step-log/` in Core). A live LLM run
   * gives its central `lab-runs/<date>/<runId>/steps/` (`lab-runs/`); any other
   * run gives none, and Core logs no steps.
   */
  stepLogDirectory?: string;
};

export function buildScenarioEnvironment(allocation: RunAllocation, seed: number, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...withoutProviderSecrets(base),
    SCENARIO_LAB_RUN_TOKEN: allocation.controllerToken,
    SCENARIO_LAB_PORT: String(allocation.scenarioPort),
    SCENARIO_LAB_SEED: String(seed),
  };
}

/**
 * The FluxIQ web panel host module of the repository at `repositoryRoot`.
 * `domain/package.json` declares its path once, as `fluxiqHostModule`
 * (relative to the domain package): the host build writes that file and every
 * launcher reads the same field. The declaration is read from this checkout.
 */
export function webPanelHostModulePath(repositoryRoot: string): string {
  const manifest = new URL("../../../domain/package.json", import.meta.url);
  const { fluxiqHostModule } = JSON.parse(readFileSync(manifest, "utf8")) as { fluxiqHostModule?: unknown };
  if (typeof fluxiqHostModule !== "string" || !fluxiqHostModule.trim()) {
    throw new Error(`${fileURLToPath(manifest)} must declare "fluxiqHostModule", the path of the built web panel host`);
  }
  return path.resolve(repositoryRoot, "domain", fluxiqHostModule);
}

/**
 * The Core process of a Lab run. Its build trace is on unless the launcher
 * says otherwise: `FLUXIQ_BUILD_PROGRESS_TRACE` makes every build -- started by
 * the Lab's own call or typed into the extension's chat -- write its decisions,
 * tools, result codes and endings into `logs/core.log`, content-free
 * (`runtime/llm/evidence-progress/progress-trace.ts` in Core). It used to be on
 * only when whoever launched the Lab exported it, so the first chat-driven live
 * runs (t227, 2026-10-01) left a `core.log` of six lines and could not be
 * debugged.
 *
 * `FLUXIQ_LLM_STEP_LOG_DIR` is set from `paths.stepLogDirectory` and from
 * nothing else: a value inherited from whoever launched the Lab is dropped, so
 * a run that was given no folder logs no steps, and four lanes never write
 * their steps into one folder.
 *
 * `FLUXIQ_LLM_DEFAULT_MODEL` is likewise set from the run's `--llm-model` and
 * from nothing else (`./live-llm/default-model-env.ts`): the model a new Flow's
 * build runs on, which is the one a build typed into the extension's chat gets.
 * An inherited value is dropped, so a run without the flag gives Core nothing
 * and Core builds on its own default.
 */
export function buildFluxIQEnvironment(allocation: RunAllocation, paths: TopologyPaths, base: NodeJS.ProcessEnv = process.env, args: readonly string[] = process.argv): NodeJS.ProcessEnv {
  const hostModulePath = paths.hostModulePath ?? webPanelHostModulePath(paths.repositoryRoot);
  // The Lab-only ceiling, configured by environment/env files and only lowered by a run flag.
  // Explicit test scope applies it to this child; ordinary user UI defaults stay independent.
  const costCeiling = labCostCeilingValue(paths.repositoryRoot, args, base);
  // Core's default model, from the run's --llm-model only; refused here when Core would refuse it at start.
  const defaultModel = labDefaultModelValue(args);
  const { FLUXIQ_LLM_STEP_LOG_DIR: _inheritedStepLogDirectory, [LAB_DEFAULT_MODEL_ENV]: _inheritedDefaultModel, [AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_ENV]: _inheritedCallLimit, [AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_SCOPE_ENV]: _inheritedCallScope, ...inherited } = withoutProviderSecrets(base);
  return {
    FLUXIQ_BUILD_PROGRESS_TRACE: "1",
    ...inherited,
    [LAB_COST_CEILING_ENV]: costCeiling,
    [LAB_COST_CEILING_SCOPE_ENV]: "test",
    ...labBuildCallLimitEnvironment(paths.buildCallLimit),
    ...(defaultModel === undefined ? {} : { [LAB_DEFAULT_MODEL_ENV]: defaultModel }),
    ...(paths.stepLogDirectory ? { FLUXIQ_LLM_STEP_LOG_DIR: paths.stepLogDirectory } : {}),
    PORT: String(allocation.webPort),
    FLUXIQ_ROOT: allocation.fluxiqRoot,
    FLUXIQ_IMPORTER_ROOT: allocation.fluxiqRoot,
    FLUXIQ_HOST_ROOT: allocation.fluxiqRoot,
    FLUXIQ_DATA_DIR: allocation.storageDir,
    FLUXIQ_DATABASES_DIR: allocation.storageDir,
    FLUXIQ_HOST_MODULE: hostModulePath,
    FLUXIQ_CLIENT_GATEWAY_ENABLED: "true",
    FLUXIQ_CLIENT_GATEWAY_HOST: "127.0.0.1",
    FLUXIQ_CLIENT_GATEWAY_PORT: String(allocation.gatewayPort),
    FLUXIQ_CLIENT_GATEWAY_PATH: "/client",
    FLUXIQ_PUBLIC_CLIENT_WS_URL: `ws://127.0.0.1:${allocation.gatewayPort}/client`,
  };
}
