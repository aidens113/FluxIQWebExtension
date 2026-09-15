// Core's web process serves a published production build: `next start` on the
// run's own port, with the run's own environment and log.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebServerProcessSpec } from "../server-process.js";

test("Core serves the published build with `next start` on the run's own port, environment and log", () => {
  const env = { FLUXIQ_ROOT: path.join("runs", "run-1", "fluxiq-root"), PORT: "43127" };
  const build = { webDirectory: path.join("runs", ".core-web-build", "0".repeat(24), "b-0123456789ab", "apps", "web"), nextExecutable: path.join("core", "apps", "web", "node_modules", ".bin", "next.cmd") };
  const spec = coreWebServerProcessSpec({ name: "fluxiq-web", build, port: 43127, env, logPath: path.join("runs", "run-1", "logs", "core.log") });
  assert.deepEqual(spec, {
    name: "fluxiq-web",
    command: build.nextExecutable,
    args: ["start", "--hostname", "127.0.0.1", "--port", "43127"],
    cwd: build.webDirectory,
    shell: process.platform === "win32",
    env,
    logPath: path.join("runs", "run-1", "logs", "core.log"),
  });
  assert.equal(spec.env, env, "the run's environment is passed through unchanged");
});
