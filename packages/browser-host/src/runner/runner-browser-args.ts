import type { RunnerSettings } from "./runner-settings.js";

/**
 * The browser arguments of a runner in its container. The container is the
 * sandbox (no capabilities, no new privileges, its own network namespace and
 * user), and Chromium's own sandbox needs the user namespaces it lacks, so
 * Chromium's is off. A rehearsal's public name, which only the host machine
 * knows, is mapped to the host that serves it; Chromium resolves every
 * `.localhost` name to itself otherwise.
 */
export function runnerBrowserArgs(settings: Pick<RunnerSettings, "coreApiUrl" | "resolveOriginTo">): string[] {
  const args = ["--no-sandbox", "--disable-gpu"];
  if (settings.resolveOriginTo !== null) args.push(`--host-resolver-rules=MAP ${new URL(settings.coreApiUrl).hostname} ${settings.resolveOriginTo}`);
  return args;
}
