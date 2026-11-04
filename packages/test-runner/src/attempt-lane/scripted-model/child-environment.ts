import { withoutProviderSecrets } from "../../environment.js";
import { SCRIPTED_MODEL_ORIGIN_ENV } from "./route-model-call.js";

/** The preload, as the `file:` address `--import` takes on every platform. */
const PRELOAD = new URL("./fetch-preload.js", import.meta.url).href;

/** A provider-free run's process environment: no key from anywhere, and no env file of this checkout opened (`../../live-llm/provider-credential.ts`). */
export function providerFreeEnvironment(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...withoutProviderSecrets(base), FLUXIQ_PROVIDER_KEY_FILES: "none", FLUXIQ_TEST_ENV_FILES: "none" };
}

/** What a scripted run hands its topology: the provider-free environment, with every child's `fetch` wrapped to reach `origin`. */
export function scriptedModelChildEnvironment(base: NodeJS.ProcessEnv, origin: string): NodeJS.ProcessEnv {
  const inherited = base.NODE_OPTIONS?.trim();
  return { ...providerFreeEnvironment(base), [SCRIPTED_MODEL_ORIGIN_ENV]: origin, NODE_OPTIONS: `${inherited ? `${inherited} ` : ""}--import ${PRELOAD}` };
}
