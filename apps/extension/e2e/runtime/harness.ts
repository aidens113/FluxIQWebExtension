// The T3 runtime harness: the background worker's action runner, in a real
// Chromium with the real extension loaded, driving a real Scenario Lab page.
//
// A spec opens a Lab scenario in a tab, installs this harness into the
// extension's own page, and sends the runner a command exactly as
// `runtime/command-router.ts` does. What is proven is the worker-side half of
// an action -- which tab it drives, what the browser did, and what the result
// says about it -- against Chrome's own `tabs` and `webNavigation`, which no
// unit test can stand in for: a stub answers whatever it was written to
// answer, and the defect this harness was built for was Chrome ignoring an
// update that a stub happily performed.
//
// The bundle is built here rather than by `scripts/build-extension.mjs`,
// because that script's entries are the five bundles the extension ships and a
// test entry has no business among them. The three workspace specifiers below
// are the ones its `browserSafeWorkspacePlugin` maps, restated: if that
// mapping changes, this build fails loudly rather than bundling something
// else.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { Page } from "@playwright/test";
import type { BrowserActionCommand } from "../../src/shared/protocol.js";
import type { RuntimeHarnessApi, RuntimeHarnessRun } from "./harness-entry.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "..", "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");

/** The page global `harness-entry.ts` installs. */
const HARNESS_GLOBAL = "__fluxiqRuntimeHarness";

let bundled: Promise<string> | undefined;

/** Builds the harness bundle once per worker process. */
export function runtimeHarnessBundle(): Promise<string> {
  bundled ??= buildBundle();
  return bundled;
}

async function buildBundle(): Promise<string> {
  const result = await build({
    entryPoints: [path.join(here, "harness-entry.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["chrome109"],
    logLevel: "silent",
    plugins: [{
      name: "browser-safe-workspace-imports",
      setup(context) {
        context.onResolve({ filter: /^@fluxiq-web-extension\/domain\/client$/ }, () => ({
          path: path.join(repoRoot, "domain", "src", "client", "index.ts")
        }));
        context.onResolve({ filter: /^fluxiq\/client-gateway$/ }, () => ({
          path: path.join(fluxiqRoot, "packages", "fluxiq", "src", "client-gateway", "contracts.ts")
        }));
        context.onResolve({ filter: /^fluxiq\/automation-studio\/fingerprinting$/ }, () => ({
          path: path.join(fluxiqRoot, "packages", "fluxiq", "src", "programs", "automation-studio", "fingerprinting", "index.ts")
        }));
      }
    }]
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error("runtime.harness: esbuild produced no bundle for e2e/runtime/harness-entry.ts");
  return output.text;
}

/**
 * Installs the harness into an extension page. `page.evaluate` is how the
 * bundle gets in: an extension page's content security policy refuses an
 * injected script tag, and evaluation through the debugger protocol is not
 * subject to it.
 */
export async function installRuntimeHarness(page: Page): Promise<void> {
  await page.evaluate(await runtimeHarnessBundle());
  const installed = await page.evaluate((name) => typeof (globalThis as Record<string, unknown>)[name] === "object", HARNESS_GLOBAL);
  if (!installed) throw new Error("runtime.harness: the bundle did not install its global on the extension page");
}

/**
 * Sends one command to the runner in `page`, as the command router sends it,
 * and returns what it answered.
 *
 * The command crosses into the page as `unknown`: Playwright resolves an
 * argument's type structurally, and the action command's own type is deep
 * enough to defeat that, which is a compiler limit rather than anything about
 * the value. It is the same object either way, and the reply is typed.
 */
export async function runWorkerAction(page: Page, action: BrowserActionCommand, options: { activeTabId?: number } = {}): Promise<RuntimeHarnessRun> {
  const answer = await page.evaluate((request: { name: string; command: unknown; run: unknown }) => {
    const api = (globalThis as unknown as Record<string, RuntimeHarnessApi | undefined>)[request.name];
    if (!api) throw new Error("The runtime harness is not installed on this page.");
    return api.run(request.command as BrowserActionCommand, request.run as { activeTabId?: number }) as unknown as Promise<unknown>;
  }, { name: HARNESS_GLOBAL, command: action as unknown, run: options as unknown });
  return answer as RuntimeHarnessRun;
}

/** Forgets the runner's driven tabs, and points it at `tabId` when one is named. */
export async function resetRuntimeHarness(page: Page, tabId?: number): Promise<void> {
  await page.evaluate((request: { name: string; tabId?: number }) => {
    const api = (globalThis as unknown as Record<string, RuntimeHarnessApi | undefined>)[request.name];
    if (!api) throw new Error("The runtime harness is not installed on this page.");
    api.reset(request.tabId);
  }, { name: HARNESS_GLOBAL, ...(tabId === undefined ? {} : { tabId }) });
}
