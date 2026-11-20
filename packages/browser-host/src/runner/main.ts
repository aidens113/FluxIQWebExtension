// `fluxiq-runner`, the command of a dedicated environment's runner image:
//   fluxiq-runner serve   the container's main process (see serveRunner)
//   fluxiq-runner enrol   the enrolment relay the environment driver execs at each start
import { mkdir } from "node:fs/promises";
import { launchHost } from "../launch-host.js";
import { relayEnrolment } from "./relay-enrolment.js";
import { runnerSettings } from "./runner-settings.js";
import { serveRunner } from "./serve-runner.js";
import { trustAuthority } from "./trust-authority.js";

const [command] = process.argv.slice(2);
const socketPath = process.env["FLUXIQ_RUNNER_SOCKET"]?.trim() || "/run/fluxiq/enrol.sock";

if (command === "enrol") {
  process.exitCode = await relayEnrolment(socketPath, { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
  process.stdin.destroy();
} else if (command === "serve") {
  const settings = runnerSettings();
  // The home folder is in the container's tmpfs, empty at every start: the browser's caches and trust database live there.
  const home = process.env["HOME"] || "/tmp/home";
  await mkdir(home, { recursive: true, mode: 0o700 });
  if (settings.authority !== null) await trustAuthority(home, settings.authority);
  const runner = await serveRunner(settings, launchHost);
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => void runner.stop());
  process.stdout.write(`fluxiq-runner: environment ${settings.environmentId} is waiting for its enrolment.\n`);
  process.exit(await runner.ended);
} else {
  process.stderr.write("usage: fluxiq-runner serve | enrol\n");
  process.exitCode = 2;
}
