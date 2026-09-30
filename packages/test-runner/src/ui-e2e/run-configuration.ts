// The workspace one `pnpm ui:e2e` run gives its journeys: a run-scoped root
// under `$FLUXIQ_TEST_RUNS_DIR/ui-e2e/<run-id>/` holding the store, both
// browser profiles and a pinned copy of the extension build; panel and gateway
// ports drawn by `allocateUiE2ePorts` (never 3000/4711, never the demo defaults
// 3300/4877); and an identity fresh to this run. Nothing is read from an env
// file's credentials or reused from `test-runs/web-extension-demo`.
//
// The journeys still start their own Core and browsers through `session.ts`
// on this configuration; every journey of one run shares its store, which is
// what lets the restart journey find the Flows the earlier ones saved.
import { randomBytes } from "node:crypto";
import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { type DemoWorkspaceConfiguration, resolveDemoWorkspaceConfiguration } from "../demo-workspace/index.js";
import { RunnerFailure } from "../failure.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import { allocateUiE2ePorts, freshUiE2eIdentity, uiE2eRunRoot } from "./topology.js";

export type UiE2eRunConfigurationOptions = Readonly<{
  repositoryRoot: string;
  /** Read for FLUXIQ_TEST_RUNS_DIR, FLUXIQ_CORE_ROOT, FLUXIQ_DEMO_EXTENSION_DIR and FLUXIQ_DEMO_HEADLESS only. */
  environment: NodeJS.ProcessEnv;
  runId?: string;
}>;

export type UiE2eRunConfiguration = Readonly<{
  runId: string;
  root: string;
  config: DemoWorkspaceConfiguration;
  ports: Readonly<{ web: number; gateway: number }>;
  prepareMs: number;
}>;

/** The run id when none is given: the UTC second it started and a short random suffix. */
export function newUiE2eRunId(now: Date = new Date()): string {
  return `r${now.toISOString().replace(/[-:]/gu, "").replace(/\..*$/u, "").toLowerCase()}-${randomBytes(2).toString("hex")}`;
}

/** Creates the run root, pins the extension build and allocates the ports; fails `ui_e2e.rig.*` when it cannot. */
export async function prepareUiE2eRunConfiguration(options: UiE2eRunConfigurationOptions): Promise<UiE2eRunConfiguration> {
  const began = Date.now();
  const { environment } = options;
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const runsDirectory = path.resolve(environment.FLUXIQ_TEST_RUNS_DIR ?? path.join(repositoryRoot, "test-runs"));
  const runId = options.runId ?? newUiE2eRunId();
  const root = uiE2eRunRoot(runsDirectory, runId);
  const extensionSource = path.resolve(environment.FLUXIQ_DEMO_EXTENSION_DIR?.trim() || path.join(repositoryRoot, "apps", "extension", "dist", "chrome"));
  await access(path.join(extensionSource, "manifest.json")).catch(() => {
    throw new RunnerFailure("environment.missing", "The unpacked extension build is missing; build @fluxiq-web-extension/extension first", { details: { reasonCode: "ui_e2e.rig.extension_missing" } });
  });
  await mkdir(path.dirname(root), { recursive: true });
  await mkdir(root, { recursive: false, mode: 0o700 });
  if (process.platform === "win32") await hardenWindowsPrivatePath(root, "directory");
  // `withDemoBrowser` copies its source into `<root>/extension-under-test` per session; the source is pinned here once, so a rebuild mid-run changes nothing.
  const pinnedExtension = path.join(root, "extension-source");
  await cp(extensionSource, pinnedExtension, { recursive: true, errorOnExist: true, force: false });
  const [web, gateway] = await allocateUiE2ePorts(2) as [number, number];
  const identity = freshUiE2eIdentity();
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, {
    FLUXIQ_TEST_RUNS_DIR: runsDirectory,
    ...(environment.FLUXIQ_CORE_ROOT ? { FLUXIQ_CORE_ROOT: environment.FLUXIQ_CORE_ROOT } : {}),
    // Headed unless the caller opts in explicitly: the Lab runs no headless browser.
    FLUXIQ_DEMO_HEADLESS: environment.FLUXIQ_DEMO_HEADLESS?.trim() || "false",
    FLUXIQ_TEST_USERNAME: identity.username,
    FLUXIQ_TEST_PASSWORD: identity.password,
    FLUXIQ_TEST_PIN: identity.pin,
  }, {
    origin: `http://127.0.0.1:${web}`,
    gatewayUrl: `ws://127.0.0.1:${gateway}/client`,
    workspaceDirectory: root,
    extensionSourceDirectory: pinnedExtension,
  });
  return { runId, root, config, ports: { web, gateway }, prepareMs: Date.now() - began };
}
