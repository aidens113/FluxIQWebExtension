// Core's web process serves a published production build: `next start` on the
// run's own port, with the run's own environment and log, and stacks mapped
// back to Core's sources.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebServerProcessSpec } from "../server-process.js";

const build = { webDirectory: path.join("runs", ".core-web-build", "0".repeat(24), "b-0123456789ab", "apps", "web"), nextExecutable: path.join("core", "apps", "web", "node_modules", ".bin", "next.cmd") };
const spec = (env: NodeJS.ProcessEnv) => coreWebServerProcessSpec({ name: "fluxiq-web", build, port: 43127, env, logPath: path.join("runs", "run-1", "logs", "core.log") });

test("Core serves the published build with `next start` on the run's own port, environment and log", () => {
  const env = { FLUXIQ_ROOT: path.join("runs", "run-1", "fluxiq-root"), PORT: "43127" };
  assert.deepEqual(spec(env), {
    name: "fluxiq-web",
    command: build.nextExecutable,
    args: ["start", "--hostname", "127.0.0.1", "--port", "43127"],
    cwd: build.webDirectory,
    shell: process.platform === "win32",
    env: { ...env, NODE_OPTIONS: "--enable-source-maps" },
    logPath: path.join("runs", "run-1", "logs", "core.log"),
  });
  assert.equal(env.hasOwnProperty("NODE_OPTIONS"), false, "the run's own environment is not changed");
});

// Three live builds ended on a throw whose record said only `thrown.Error`,
// because a minified chunk's frames name no Core file.
test("the server maps its stacks to Core's sources, beside any Node options the run already had", () => {
  assert.equal(spec({ NODE_OPTIONS: "--max-old-space-size=4096" }).env?.NODE_OPTIONS, "--max-old-space-size=4096 --enable-source-maps");
  const already = { NODE_OPTIONS: "--enable-source-maps --trace-warnings" };
  assert.equal(spec(already).env, already, "an environment that already asks for it is passed through as it is");
  assert.equal(spec({ NODE_OPTIONS: "   " }).env?.NODE_OPTIONS, "--enable-source-maps");
});
