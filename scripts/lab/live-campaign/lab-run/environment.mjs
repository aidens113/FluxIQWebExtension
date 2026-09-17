const SECRET_PREFIX = "FLUXIQ_TEST_SECRET_";

/**
 * The environment a Lab child runs with: the caller's, with
 * npm_config_workspace_concurrency forced to 1 whatever case it was set in, so
 * a campaign never builds workspaces in parallel on this machine, and with the
 * replay secrets of the task's own scenario (`fixtureSecretEnvironment`) in
 * place of any the machine set.
 */
export function labEnvironment(env, fixtureSecrets = {}) {
  const foreign = Object.keys(fixtureSecrets).filter((key) => !key.startsWith(SECRET_PREFIX));
  if (foreign.length > 0) throw new Error(`A scenario fixture may set only ${SECRET_PREFIX}* variables, not ${foreign.join(", ")}`);
  const next = Object.fromEntries(Object.entries(env).filter(([key]) => {
    const upper = key.toUpperCase();
    return upper !== "NPM_CONFIG_WORKSPACE_CONCURRENCY" && !upper.startsWith(SECRET_PREFIX);
  }));
  return { ...next, ...fixtureSecrets, npm_config_workspace_concurrency: "1" };
}
