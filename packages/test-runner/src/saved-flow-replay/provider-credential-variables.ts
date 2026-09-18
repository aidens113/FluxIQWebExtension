// The first half of "no model could have been reached": the replay process
// itself holds no provider credential. The Lab driver is the only process that
// ever reads one (`environment.ts`), so a driver without one has nothing to
// hand Core, the browser or the extension, and a replay started with one is
// refused rather than trusted not to use it.

import { PROVIDER_SECRET_ENVIRONMENT_VARIABLES } from "../environment.js";

const PROVIDER_VARIABLES: ReadonlySet<string> = new Set(PROVIDER_SECRET_ENVIRONMENT_VARIABLES);

/**
 * The provider credential variables set, to anything but blank, in any of
 * `environments`, by name only and sorted. Names are matched case-insensitively,
 * as `withoutProviderSecrets` strips them. A value is never read beyond whether
 * it is blank, so the result is safe to publish.
 */
export function providerCredentialVariables(...environments: readonly NodeJS.ProcessEnv[]): string[] {
  const present = new Set<string>();
  for (const environment of environments) {
    for (const [name, value] of Object.entries(environment)) {
      if (value !== undefined && value.trim() !== "" && PROVIDER_VARIABLES.has(name.toUpperCase())) present.add(name.toUpperCase());
    }
  }
  return [...present].sort();
}
