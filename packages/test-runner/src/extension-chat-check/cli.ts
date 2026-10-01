// `node dist/extension-chat-check/cli.js [--browser chrome|firefox] [--scenario <id>] [--page <path>] [--no-ask] [--build] [--evidence <dir>]`
// `node dist/extension-chat-check/cli.js --prepare-core-web-build`
//
// The headed, provider-free check of the extension chat's relay
// (`run-chat-check.ts`). Provider credentials are removed from this process
// before anything it starts can inherit them. Prints one JSON line per browser
// and exits 0 only when every check of every browser held.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareCoreWebBuild } from "../core-web-build/index.js";
import { withoutProviderSecrets } from "../environment.js";
import { ProcessSupervisor } from "../process-supervisor.js";
import { runExtensionChatCheck, type ChatCheckResult } from "./run-chat-check.js";
import type { ChatBrowser } from "./types.js";

const scrubbed = withoutProviderSecrets(process.env);
for (const key of Object.keys(process.env)) if (!(key in scrubbed)) delete process.env[key];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const fluxiqRepositoryRoot = path.resolve(repositoryRoot, "..", "!FluxIQ");
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => { const at = args.indexOf(name); return at >= 0 && args[at + 1] ? args[at + 1]! : fallback; };

if (args.includes("--prepare-core-web-build")) {
  const began = Date.now();
  const logDirectory = path.join(repositoryRoot, "test-runs", ".chat-check-work");
  await mkdir(logDirectory, { recursive: true });
  const build = await prepareCoreWebBuild({ fluxiqRepositoryRoot, supervisor: new ProcessSupervisor(), logPath: path.join(logDirectory, "core-web-build.log") });
  process.stdout.write(`${JSON.stringify({ prepared: true, build, ms: Date.now() - began })}\n`);
} else {
  const requested = option("--browser", "chrome");
  const browsers: ChatBrowser[] = requested === "both" ? ["chrome", "firefox"] : requested === "firefox" ? ["firefox"] : ["chrome"];
  const evidenceRoot = option("--evidence", "C:/Users/osrs_/FluxStuff/evidence/t198");
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const results: ChatCheckResult[] = [];
  for (const browser of browsers) {
    const result = await runExtensionChatCheck({
      repositoryRoot,
      fluxiqRepositoryRoot,
      browser,
      scenarioId: option("--scenario", "social-network-feed"),
      pagePath: option("--page", "friends/requests/"),
      ask: !args.includes("--no-ask"),
      build: args.includes("--build"),
      evidenceDirectory: path.join(evidenceRoot, `${stamp}-${browser}`),
      log: line => process.stderr.write(`${line}\n`),
    });
    results.push(result);
    const checks = { ...(result.relay?.checks ?? {}), ...(result.ask?.checks ?? {}), ...(result.build?.checks ?? {}) };
    process.stdout.write(`${JSON.stringify({ browser, stage: result.stage, panelMode: result.panelMode, failure: result.failure?.split("\n")[0] ?? null, checks, evidence: result.evidenceDirectory })}\n`);
  }
  const held = results.every(result => result.failure === null && result.relay !== null && (!args.includes("--build") || result.build !== null) && Object.values({ ...result.relay.checks, ...(result.ask?.checks ?? {}), ...(result.build?.checks ?? {}) }).every(Boolean));
  process.exitCode = held ? 0 : 2;
}
