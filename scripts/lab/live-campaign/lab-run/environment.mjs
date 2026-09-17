/**
 * The environment a Lab child runs with: the caller's, with
 * npm_config_workspace_concurrency forced to 1 whatever case it was set in, so
 * a campaign never builds workspaces in parallel on this machine.
 */
export function labEnvironment(env) {
  const next = Object.fromEntries(Object.entries(env).filter(([key]) => key.toLowerCase() !== "npm_config_workspace_concurrency"));
  return { ...next, npm_config_workspace_concurrency: "1" };
}
