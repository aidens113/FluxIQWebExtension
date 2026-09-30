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
    env: withSourceMappedStacks(input.env),
    logPath: input.logPath,
  };
}

const ENABLE_SOURCE_MAPS = "--enable-source-maps";

/**
 * The run's environment with Node told to read the build's source maps.
 *
 * The production build minifies Core into chunks under `.next/server/chunks/`,
 * so a stack from it names `qO` in a two-megabyte file. Three live builds
 * (`run-muncqlr0-3348202b`, `run-munda7ub-d9214e3b`, `run-mune0xh1-2470406a`)
 * ended on the same untyped throw, and Core's failure record could say only
 * `thrown.Error`: the frame it looks for is a path inside Automation Studio,
 * and a chunk has none. Turbopack writes a `.map` beside every chunk; with this
 * flag Node maps each frame back to its source file and line, so the record's
 * `thrown.at:` code and every stack in `core.log` name the line that threw.
 * Added to whatever `NODE_OPTIONS` the run already carries, never in its place.
 */
function withSourceMappedStacks(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const options = env.NODE_OPTIONS?.trim() ?? "";
  if (options.split(/\s+/u).includes(ENABLE_SOURCE_MAPS)) return env;
  return { ...env, NODE_OPTIONS: options ? `${options} ${ENABLE_SOURCE_MAPS}` : ENABLE_SOURCE_MAPS };
}
