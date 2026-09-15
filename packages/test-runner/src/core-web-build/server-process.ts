import type { ProcessSpec } from "../process-supervisor.js";
import type { CoreWebBuild } from "./types.js";

export type CoreWebServerProcessInput = {
  name: string;
  build: Pick<CoreWebBuild, "webDirectory" | "nextExecutable">;
  port: number;
  env: NodeJS.ProcessEnv;
  logPath: string;
};

/**
 * The supervised `next start` process serving Core's web panel from a
 * published production build. The build directory is shared by every run;
 * the port, environment and log path are the run's own.
 */
export function coreWebServerProcessSpec(input: CoreWebServerProcessInput): ProcessSpec {
  return {
    name: input.name,
    command: input.build.nextExecutable,
    args: ["start", "--hostname", "127.0.0.1", "--port", String(input.port)],
    cwd: input.build.webDirectory,
    shell: process.platform === "win32",
    env: input.env,
    logPath: input.logPath,
  };
}
