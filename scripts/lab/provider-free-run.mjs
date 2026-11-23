// The runner's environment for `lab attempt --scripted-model`, which reaches no
// provider: no key inherited from whoever started the Lab, and both env-file
// switches off, so nothing in this checkout's `.env` or `.env.local` is opened
// (`packages/test-runner/src/live-llm/provider-credential.ts`). The runner does
// the same on its side; this is so that even its first read has nothing to find.
//
// `lab recovery-matrix` is provider-free by definition: every case refuses to
// start while a provider credential is in its environment
// (`recovery-matrix/run/run-matrix-case.ts`). Until t968 it was handed the
// environment as it came, so a checkout whose `.env.local` holds the live keys
// could not run a single case without the person unsetting them and switching
// the env files off by hand. It gets the same environment as a scripted attempt,
// with the isolated target named (each case still runs on its own persistent
// isolated workspace).

import { withoutProviderSecrets } from "../provider-secret-environment.mjs";

/**
 * @param {readonly string[]} args the Lab arguments, as `run-lab.mjs` received them
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function providerFreeWhenScripted(args, env) {
  if (args[0] === "recovery-matrix") return { ...withoutProviderSecrets(env), FLUXIQ_PROVIDER_KEY_FILES: "none", FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_TEST_TARGET: "isolated" };
  const offline = ["fluxnode-host", "recorded-replay", "recorded-capture", "recorded-read", "offline-preflight"].includes(args[0]);
  const providerFreeAttempt = args[0] === "attempt" && (args.includes("--scripted-model") || args.includes("--recorded-model"));
  if (!offline && !providerFreeAttempt) return env;
  return { ...withoutProviderSecrets(env), FLUXIQ_PROVIDER_KEY_FILES: "none", FLUXIQ_TEST_ENV_FILES: "none" };
}
