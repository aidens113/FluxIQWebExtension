// The runner's environment for `lab attempt --scripted-model`, which reaches no
// provider: no key inherited from whoever started the Lab, and both env-file
// switches off, so nothing in this checkout's `.env` or `.env.local` is opened
// (`packages/test-runner/src/live-llm/provider-credential.ts`). The runner does
// the same on its side; this is so that even its first read has nothing to find.

import { withoutProviderSecrets } from "../provider-secret-environment.mjs";

/**
 * @param {readonly string[]} args the Lab arguments, as `run-lab.mjs` received them
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function providerFreeWhenScripted(args, env) {
  if (args[0] !== "attempt" || !args.includes("--scripted-model")) return env;
  return { ...withoutProviderSecrets(env), FLUXIQ_PROVIDER_KEY_FILES: "none", FLUXIQ_TEST_ENV_FILES: "none" };
}
