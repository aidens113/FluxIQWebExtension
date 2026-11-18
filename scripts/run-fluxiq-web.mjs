import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { prepareWorkspace } from "./run-fluxiq-web/index.mjs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const domainRoot = path.join(repoRoot, "domain");
// domain/package.json declares the built host once, as "fluxiqHostModule".
const { fluxiqHostModule } = JSON.parse(readFileSync(path.join(domainRoot, "package.json"), "utf8"));
const webPanelHostModule = path.resolve(domainRoot, fluxiqHostModule);

if (!existsSync(path.join(fluxiqRoot, "apps", "web", "package.json"))) {
  console.error(`Could not find FluxIQ web app at ${fluxiqRoot}`);
  process.exit(1);
}

const env = {
  ...process.env,
  FLUXIQ_ROOT: repoRoot,
  FLUXIQ_HOST_MODULE: process.env.FLUXIQ_HOST_MODULE ?? webPanelHostModule,
  FLUXIQ_CLIENT_GATEWAY_ENABLED: process.env.FLUXIQ_CLIENT_GATEWAY_ENABLED ?? "true",
  FLUXIQ_PUBLIC_CLIENT_WS_URL: process.env.FLUXIQ_PUBLIC_CLIENT_WS_URL ?? "ws://127.0.0.1:4777/client"
};

console.log(`[FluxIQ Web Automation] FLUXIQ_ROOT=${repoRoot}`);
// One command for a person: dependencies, Core's libraries and the panel host
// are brought up to date first (each step reuses what is already current), so
// setup never meets a missing package or a Core built before its source. A
// Core shared with other task worktrees is only checked; a stale one, or a
// failed step, ends the launcher with one line saying what to do.
try {
  await prepareWorkspace({ repoRoot, coreRoot: fluxiqRoot, env, log: (line) => console.log(`[FluxIQ Web Automation] ${line}`) });
} catch (error) {
  console.error(`[FluxIQ Web Automation] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
console.log("[FluxIQ Web Automation] Preparing repo-local FluxIQ runtime...");
await run("node", [path.join(repoRoot, "domain", "scripts", "setup-fluxiq.mjs")], {
  ...env,
  FLUXIQ_WEB_AUTOMATION_ROOT: repoRoot
});
// The panel a person uses is the production build: `next dev` compiles every
// page on its first visit and compiles Core from source, which made each new
// tab wait. The build cache skips the build when nothing changed. `--dev`
// keeps the hot-reloading server for work on the panel itself.
const devServer = process.argv.slice(2).includes("--dev");
if (!devServer) {
  console.log("[FluxIQ Web Automation] Building @fluxiq/web (skipped when nothing changed)...");
  await run("pnpm", ["--dir", fluxiqRoot, "--filter", "@fluxiq/web", "build"], env);
}
console.log(`[FluxIQ Web Automation] Starting @fluxiq/web (${devServer ? "development server" : "production build"}) from the core framework workspace...`);
console.log(`[FluxIQ Web Automation] FLUXIQ_HOST_MODULE=${env.FLUXIQ_HOST_MODULE}`);

const child = spawn("pnpm", ["--dir", fluxiqRoot, "--filter", "@fluxiq/web", devServer ? "dev" : "start"], {
  env,
  stdio: ["inherit", "pipe", "inherit"],
  shell: process.platform === "win32"
});

// Until someone owns this FluxIQ, the panel prints a one-time setup link at
// start. Every line is passed through as printed; the link is also framed so
// it is not lost among the start-up lines.
const SETUP_LINK = /First-time setup: open (\S+)/u;
createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
  console.log(line);
  const link = SETUP_LINK.exec(line)?.[1];
  if (link) console.log(setupBanner(link));
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

function setupBanner(link) {
  const rule = "=".repeat(Math.max(72, link.length + 4));
  const lines = ["", rule, "  FluxIQ first-time setup: open this link to choose your name and password.", "  It works once. Restart FluxIQ for a new one.", "", `  ${link}`, rule, ""];
  return lines.join("\n");
}

function run(command, args, childEnv) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      env: childEnv,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    childProcess.on("error", reject);
    childProcess.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
