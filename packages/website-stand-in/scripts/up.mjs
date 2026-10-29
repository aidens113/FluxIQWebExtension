// `site:up`: a local Core in the service profile plus the website stand-in, on
// free random ports, in a run directory of its own.
//
//   node scripts/up.mjs                 start the stack and keep it up (Ctrl-C stops it)
//   node scripts/up.mjs --round-trip    start, run scripts/round-trip.mjs, stop, exit non-zero on failure
//   node scripts/up.mjs --build-only    prepare Core's production build and the domain host module, then exit
//                                       (the heavy step: run it under the shared heavy-check lock)
//
// Core is served from Core's keyed production build (scripts/web-build), published
// under <repo>/test-runs/wb so nothing is written into the Core checkout's .next.
// Only the child processes this script started are ever stopped, by PID.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRoundTrip } from "./round-trip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const coreRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const buildCacheRoot = path.join(repoRoot, "test-runs", "wb");
const args = new Set(process.argv.slice(2));
const READY_MS = 120_000;

const children = [];
let stopping = false;

function say(line) {
  console.log(line);
}

function hostModulePath() {
  const { fluxiqHostModule } = JSON.parse(readFileSync(path.join(repoRoot, "domain", "package.json"), "utf8"));
  return path.resolve(repoRoot, "domain", fluxiqHostModule);
}

/** Only what a child needs to run at all; nothing else from the invoking shell (no provider keys, no FLUXIQ_*). */
function basicEnvironment() {
  const keep = ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramData", "ProgramFiles", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"];
  const env = {};
  for (const name of keep) if (process.env[name] !== undefined) env[name] = process.env[name];
  return env;
}

function freePort(taken) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        server.close(() => {
          if (port === 3000 || port === 4777 || taken.has(port)) attempt();
          else {
            taken.add(port);
            resolve(port);
          }
        });
      });
    };
    attempt();
  });
}

function runToEnd(command, commandArgs, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    const sink = options.logPath;
    child.stdout.on("data", (chunk) => appendFileSync(sink, chunk));
    child.stderr.on("data", (chunk) => appendFileSync(sink, chunk));
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(String(command))} ${commandArgs[0] ?? ""} exited with ${code}; see ${sink}`))));
  });
}

async function prepareCore(runLog) {
  const seam = await import(pathToFileURL(path.join(coreRoot, "scripts", "web-build", "index.mjs")).href);
  const buildEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => {
    const upper = name.toUpperCase();
    return !upper.startsWith("FLUXIQ_") && !upper.startsWith("NEXT_PUBLIC_") && upper !== "NODE_ENV" && upper !== "PORT" && !/(_API_KEY|_SECRET|_TOKEN)$/u.test(upper) && !/^(DEEPSEEK|OPENAI|ANTHROPIC|GEMINI|GOOGLE)/u.test(upper);
  }));
  mkdirSync(buildCacheRoot, { recursive: true });
  const logPath = `${runLog}.core-build.log`;
  const build = await seam.prepareWebBuild({
    repoRoot: coreRoot,
    cacheRoot: buildCacheRoot,
    env: buildEnv,
    log: (line) => appendFileSync(logPath, `${line}\n`),
    run: (command) => runToEnd(command.command, command.args, { cwd: command.cwd, env: command.env, shell: command.shell, logPath }),
    waitTimeoutMs: 40 * 60_000
  });
  return build;
}

async function ensureHostModule(runLog) {
  const host = hostModulePath();
  if (existsSync(host)) return host;
  say("domain host module is missing; building it (domain/scripts/build-web-panel-host.mjs)");
  await runToEnd(process.execPath, [path.join(repoRoot, "domain", "scripts", "build-web-panel-host.mjs")], { cwd: repoRoot, env: { ...basicEnvironment() }, logPath: `${runLog}.host-build.log` });
  if (!existsSync(host)) throw new Error(`the host build finished but ${host} is missing`);
  return host;
}

function track(name, child) {
  children.push({ name, child, pid: child.pid });
  child.once("exit", (code) => {
    if (!stopping) say(`${name} exited unexpectedly (code ${code}); see the run directory logs`);
  });
}

function killTree(pid) {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* best-effort: the process is already gone */
    }
  }
}

function stopAll() {
  stopping = true;
  for (const { pid } of children.splice(0)) if (pid) killTree(pid);
}

async function waitFor(label, probe) {
  const deadline = Date.now() + READY_MS;
  let last = "no answer";
  while (Date.now() < deadline) {
    if (stopping) throw new Error("stopped");
    try {
      const result = await probe();
      if (result === true) return;
      last = String(result);
    } catch (error) {
      last = error.cause?.code ?? error.name;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} was not ready after ${READY_MS / 1000}s (${last})`);
}

/** The instance's mail folder: <fluxiq paths.fluxiq>/platform/outbox below FLUXIQ_ROOT, found once Core has made it. */
function resolveOutbox(root, fallback) {
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      if (name === "outbox" && path.basename(dir) === "platform") return full;
      if (depth < 4 && !name.startsWith("node_modules") && statSync(full, { throwIfNoEntry: false })?.isDirectory()) stack.push({ dir: full, depth: depth + 1 });
    }
  }
  return fallback;
}

async function main() {
  const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const runDir = path.join(packageRoot, "test-runs", "site-up", stamp);
  mkdirSync(runDir, { recursive: true });
  const runLog = path.join(runDir, "up");

  const build = await prepareCore(runLog);
  const host = await ensureHostModule(runLog);
  if (args.has("--build-only")) {
    say(`Core build ready (key ${build.key}); host module ${existsSync(host) ? "ready" : "missing"}`);
    return 0;
  }

  const taken = new Set();
  const appPort = await freePort(taken);
  const provPort = await freePort(taken);
  const sitePort = await freePort(taken);
  const appOrigin = `http://127.0.0.1:${appPort}`;
  const provUrl = `http://127.0.0.1:${provPort}`;
  const tokenFile = path.join(runDir, "provisioning-token");
  writeFileSync(tokenFile, `${randomBytes(32).toString("base64url")}\n`, { mode: 0o600 });
  const fluxiqRoot = path.join(runDir, "core-root");
  mkdirSync(fluxiqRoot, { recursive: true });

  const coreEnv = {
    ...basicEnvironment(),
    FLUXIQ_PROFILE: "service",
    FLUXIQ_ROOT: fluxiqRoot,
    FLUXIQ_PUBLIC_ORIGIN: appOrigin,
    FLUXIQ_PROVISIONING_LISTEN: `127.0.0.1:${provPort}`,
    FLUXIQ_PROVISIONING_TOKEN_FILE: tokenFile,
    FLUXIQ_HOST_MODULE: host,
    FLUXIQ_CLIENT_GATEWAY_ENABLED: "false",
    NEXT_TELEMETRY_DISABLED: "1"
  };
  const coreLog = path.join(runDir, "core.log");
  const coreChild = spawn(build.nextExecutable, ["start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: build.webDirectory,
    env: { ...coreEnv, NODE_OPTIONS: "--enable-source-maps" },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  coreChild.stdout.on("data", (chunk) => appendFileSync(coreLog, chunk));
  coreChild.stderr.on("data", (chunk) => appendFileSync(coreLog, chunk));
  track("core", coreChild);

  await waitFor("Core's app", async () => (await fetch(`${appOrigin}/welcome`)).status === 200 || "welcome page not 200 yet");
  const bearer = readFileSync(tokenFile, "utf8").split(/\r?\n/u)[0].trim();
  try {
    await waitFor("Core's provisioning listener", async () => {
      const probe = await fetch(`${provUrl}/provisioning/getAccount`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` }, body: JSON.stringify({ email: "probe@example.test" }) });
      return probe.status === 404 || probe.status === 200 || `status ${probe.status}`;
    });
  } catch (error) {
    stopAll();
    throw new Error(`${error.message}. Core's server never starts the listener: startProvisioningListenerFromEnv has no caller outside tests (apps/web/src/instrumentation.ts only initializes the runtime). See reports/t801/w2.md.`);
  }

  const serverStart = path.join(packageRoot, "server", "start.mjs");
  let siteUrl = null;
  if (existsSync(serverStart)) {
    const siteEnv = {
      ...basicEnvironment(),
      SITE_PORT: String(sitePort),
      FLUXIQ_PROVISIONING_URL: provUrl,
      FLUXIQ_PROVISIONING_TOKEN_FILE: tokenFile,
      SITE_APP_ORIGIN: appOrigin,
      SITE_TERMS_VERSION: "stand-in-1",
      SITE_HUMAN_CHECK: "off"
    };
    const siteLog = path.join(runDir, "site.log");
    const siteChild = spawn(process.execPath, [serverStart], { cwd: packageRoot, env: siteEnv, stdio: ["ignore", "pipe", "pipe"] });
    siteChild.stdout.on("data", (chunk) => appendFileSync(siteLog, chunk));
    siteChild.stderr.on("data", (chunk) => appendFileSync(siteLog, chunk));
    track("site", siteChild);
    siteUrl = `http://localhost:${sitePort}`;
    await waitFor("the site", async () => (await fetch(`${siteUrl}/api/signup/config`)).status === 200 || "config not 200 yet");
  } else {
    say("server/start.mjs is not there yet: the site was not started");
  }

  const outbox = resolveOutbox(fluxiqRoot, path.join(fluxiqRoot, ".fluxiq", "platform", "outbox"));
  say(`site:   ${siteUrl ?? "(not started)"}`);
  say(`app:    ${appOrigin}`);
  say(`mail:   ${outbox}  (Core has no FLUXIQ_EMAIL_SENDER=file:<dir>; this is its fixed outbox under the run's data root)`);
  say(`run:    ${runDir}`);

  if (args.has("--round-trip")) {
    if (!siteUrl) {
      say("round trip FAIL: the site is not running");
      return 1;
    }
    const result = await runRoundTrip({ site: siteUrl, app: appOrigin, prov: provUrl, tokenFile, mail: resolveOutbox(fluxiqRoot, outbox) });
    say(result.ok ? "round trip PASS" : "round trip FAIL");
    return result.ok ? 0 : 1;
  }

  say("stop:   press Ctrl-C in this terminal (stops only the Core and site processes this run started)");
  await new Promise(() => {});
  return 0;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(130);
  });
}
process.on("exit", stopAll);

let code = 1;
try {
  code = await main();
} catch (error) {
  console.error(`site:up failed: ${error.message}`);
}
stopAll();
process.exit(code);
