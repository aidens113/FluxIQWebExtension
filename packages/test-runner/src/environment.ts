import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RunAllocation } from "./allocation.js";

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

export function buildFluxIQEnvironment(allocation: RunAllocation, paths: TopologyPaths, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const hostModulePath = paths.hostModulePath ?? webPanelHostModulePath(paths.repositoryRoot);
  return {
    ...withoutProviderSecrets(base),
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
