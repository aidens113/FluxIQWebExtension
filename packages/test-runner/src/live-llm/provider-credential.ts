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
//
// `FLUXIQ_TEST_ENV_FILES=none` therefore does not keep the key out, and was
// never meant to: the Lab's isolated live runs depend on it
// (`scripts/lab/live-isolated.mjs`, `scripts/lab/pair/campaign-environment.mjs`).
// `FLUXIQ_PROVIDER_KEY_FILES=none` is the explicit way to say "no key from any
// env file": the key then comes from the process environment or not at all,
// and a value `loadTestEnvironment` read out of a file is ignored as well. A
// provider-free probe of a command line sets both.
//
// Inside a test, no file outside the temporary directory is opened
// (`env-files/test-read-guard.ts`), and a key the test process inherited from
// the shell that started it is refused: a test hands the runner a stand-in key
// in the environment object it passes, never through its own `process.env`.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertTestMayReadEnvFile, runningUnderTestRunner } from "../env-files/index.js";
import { RunnerFailure } from "../failure.js";
import { parseEnvironmentFile, testEnvironmentValueSource } from "../target-config.js";

/** Claude's user-selected name first; Anthropic's standard name is a compatible alias. */
const CREDENTIAL_NAMES = { anthropic: ["CLAUDE_API_KEY", "ANTHROPIC_API_KEY"], deepseek: ["DEEPSEEK_API_KEY"] } as const;
const CANDIDATE_FILES = [".env", ".env.local"] as const;
/** Set to `none`, no provider key is read from any env file. */
const KEY_FILES_SWITCH = "FLUXIQ_PROVIDER_KEY_FILES";

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
 * read for this one name, whatever `FLUXIQ_TEST_ENV_FILES` says, unless
 * `FLUXIQ_PROVIDER_KEY_FILES=none`. The value is never logged, and the refusal
 * never quotes it because there is none to quote.
 */
export async function resolveLiveLlmProviderCredential(input: {
  repositoryRoot: string;
  environment: NodeJS.ProcessEnv;
  provider: keyof typeof CREDENTIAL_NAMES;
}): Promise<LiveLlmProviderCredential> {
  const names = CREDENTIAL_NAMES[input.provider];
  if (!names) throw missing(`provider ${input.provider} has no known credential name`);
  const name = names[0];
  const keyFiles = providerKeyFiles(input.environment);
  for (const candidate of names) {
    const fromEnvironment = input.environment[candidate];
    if (fromEnvironment === undefined) continue;
    // `loadTestEnvironment` folds the files into the environment and records which file each name came from.
    const fileSource = testEnvironmentValueSource(input.environment, candidate);
    if (fileSource === undefined) {
      if (runningUnderTestRunner() && fromEnvironment === process.env[candidate]) {
        throw missing(`${candidate} came from the environment of the process running the tests, which a test may never use; pass a stand-in key in the environment the test hands the runner`);
      }
      return credential(candidate, "the process environment", fromEnvironment, candidate);
    }
  }
  // Process values win across aliases. In files, the user's CLAUDE_API_KEY
  // wins over the compatible Anthropic alias even when it is in .env.local.
  for (const candidate of names) {
    const loaded = input.environment[candidate];
    const fileSource = testEnvironmentValueSource(input.environment, candidate);
    if (loaded !== undefined && fileSource !== undefined && keyFiles.includes(fileSource)) return credential(candidate, fileSource, loaded, candidate);
    for (const fileName of keyFiles) {
      assertTestMayReadEnvFile(input.repositoryRoot, fileName);
      const filePath = path.join(path.resolve(input.repositoryRoot), fileName);
      const value = await readOneName(filePath, candidate);
      if (value !== undefined) return credential(candidate, fileName, value, candidate);
    }
  }
  if (keyFiles.length === 0) throw missing(`${name} is not set in the environment, and ${KEY_FILES_SWITCH}=none keeps it from being read from ${CANDIDATE_FILES.join(" or ")}`);
  throw missing(`${name} is not set in the environment and no ${keyFiles.join(" or ")} in ${path.resolve(input.repositoryRoot)} declares it`);
}

/** The env files the key may come from: both, or none under `FLUXIQ_PROVIDER_KEY_FILES=none`. */
function providerKeyFiles(environment: NodeJS.ProcessEnv): readonly string[] {
  const choice = environment[KEY_FILES_SWITCH];
  if (choice === undefined) return CANDIDATE_FILES;
  if (choice === "none") return [];
  throw missing(`${KEY_FILES_SWITCH} must be none when set`);
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
