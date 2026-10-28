/** The process settings an offline-first proof turns on, and what each held before. */
const SETTINGS = ["FLUXIQ_CLIENT_GATEWAY_TRACE", "FLUXIQ_LLM_STEP_LOG_DIR", "FLUXIQ_OFFLINE_TRIALS"] as const;

/**
 * Turns on what a build's offline-first trials need in this process (trace
 * plan P6, t769), as the Lab does for every Core it starts: gateway tracing
 * (`FLUXIQ_CLIENT_GATEWAY_TRACE=1`, read once when Core's runtime is built, so
 * this must run before `startInstalledBuild`), the step log in `stepsDirectory`
 * (an absolute path), and offline trials left on (`FLUXIQ_OFFLINE_TRIALS`
 * unset). Answers the function that puts every setting back as it was.
 */
export function useOfflineTrialEnvironment(stepsDirectory: string): () => void {
  const before = Object.fromEntries(SETTINGS.map(name => [name, process.env[name]]));
  process.env.FLUXIQ_CLIENT_GATEWAY_TRACE = "1";
  process.env.FLUXIQ_LLM_STEP_LOG_DIR = stepsDirectory;
  delete process.env.FLUXIQ_OFFLINE_TRIALS;
  return () => {
    for (const name of SETTINGS) {
      const value = before[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}
