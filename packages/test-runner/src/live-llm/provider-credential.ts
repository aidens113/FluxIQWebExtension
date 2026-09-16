// Where a live run's provider credential comes from, and why it is read here
// rather than taken from the resolved test environment.
//
// `FLUXIQ_TEST_ENV_FILES=none` is how an isolated run refuses a machine's saved
// existing-install configuration -- its base URL, its project, its account --
// and it drops every other name in `.env.local` with them, including the
// provider key. Isolation and a real provider are not actually in conflict:
// what must stay out is the target configuration, not the credential. So this
// reader takes exactly one name out of those files, never the rest, and only
// when `--live-llm` asked for a provider at all.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../failure.js";
import { parseEnvironmentFile } from "../target-config.js";

/** The one environment name each supported provider's credential is read from. */
const CREDENTIAL_NAMES = { deepseek: "DEEPSEEK_API_KEY" } as const;
const CANDIDATE_FILES = [".env", ".env.local"] as const;

export type LiveLlmProviderCredential = Readonly<{
  /** The environment name it was found under, for a message that names what is missing. */
  name: string;
  /** Where it came from: the process environment, or which repository file. */
  source: string;
  value: string;
}>;

/**
 * The provider credential for a live run, or a refusal naming what is missing.
 * The process environment wins; otherwise the repository's own env files are
 * read for this one name, whatever `FLUXIQ_TEST_ENV_FILES` says. The value is
 * never logged, and the refusal never quotes it because there is none to quote.
 */
export async function resolveLiveLlmProviderCredential(input: {
  repositoryRoot: string;
  environment: NodeJS.ProcessEnv;
  provider: keyof typeof CREDENTIAL_NAMES;
}): Promise<LiveLlmProviderCredential> {
  const name = CREDENTIAL_NAMES[input.provider];
  if (!name) throw missing(`provider ${input.provider} has no known credential name`);
  const fromProcess = input.environment[name];
  if (fromProcess !== undefined) return credential(name, "the process environment", fromProcess, name);
  const searched: string[] = [];
  for (const fileName of CANDIDATE_FILES) {
    const filePath = path.join(path.resolve(input.repositoryRoot), fileName);
    searched.push(fileName);
    const value = await readOneName(filePath, name);
    if (value !== undefined) return credential(name, fileName, value, name);
  }
  throw missing(`${name} is not set in the environment and no ${searched.join(" or ")} in ${path.resolve(input.repositoryRoot)} declares it`);
}

async function readOneName(filePath: string, name: string): Promise<string | undefined> {
  let contents: string;
  try { contents = await readFile(filePath, "utf8"); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined;
    throw missing(`${path.basename(filePath)} could not be read while looking for ${name}`);
  }
  // Only this one name leaves the file. Every other assignment in it -- the
  // target, the base URL, the saved account -- is discarded unparsed by the
  // filter below, so an isolated run stays isolated.
  let parsed: NodeJS.ProcessEnv;
  try { parsed = parseEnvironmentFile(contents); }
  catch { throw missing(`${path.basename(filePath)} holds an invalid environment assignment`); }
  return parsed[name];
}

function credential(name: string, source: string, value: string, label: string): LiveLlmProviderCredential {
  const trimmed = value.trim();
  if (!trimmed) throw missing(`${label} is set but empty`);
  if (trimmed.length < 8 || trimmed.length > 16_384) throw missing(`${label} is not a plausible provider key`);
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) throw missing(`${label} contains control characters`);
  return Object.freeze({ name, source, value: trimmed });
}

function missing(detail: string): RunnerFailure {
  return new RunnerFailure("environment.missing", `Live LLM execution needs a provider credential: ${detail}`);
}
