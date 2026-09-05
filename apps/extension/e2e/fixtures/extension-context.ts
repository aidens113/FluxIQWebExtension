import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, test as base, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard } from "./network-policy.js";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const defaultExtensionPath = path.join(extensionRoot, "dist", "e2e-chromium");

export type ExtensionMetadata = {
  id: string;
  name: string;
  version: string;
  artifactPath: string;
  artifactSha256: string;
};

export type ExtensionSession = {
  context: BrowserContext;
  worker: Worker;
  extensionPage: Page;
  profilePath: string;
  metadata: ExtensionMetadata;
  networkGuard: DeterministicNetworkGuard;
};

type ExtensionFixtures = {
  extensionSession: ExtensionSession;
};

export const test = base.extend<ExtensionFixtures>({
  extensionSession: async ({}, use, testInfo) => {
    const session = await launchExtensionSession(testInfo.testId);
    await testInfo.attach("extension-build.json", {
      body: Buffer.from(JSON.stringify(session.metadata, null, 2)),
      contentType: "application/json"
    });
    try {
      await use(session);
    } finally {
      let networkError: unknown;
      try { session.networkGuard.assertClean(); } catch (error) { networkError = error; }
      await closeExtensionSession(session);
      if (networkError) throw networkError;
    }
  }
});

export { expect } from "@playwright/test";

export async function launchExtensionSession(label = "run"): Promise<ExtensionSession> {
  const artifactPath = path.resolve(process.env.FLUXIQ_E2E_EXTENSION_PATH ?? defaultExtensionPath);
  const manifest = await readExtensionManifest(artifactPath);
  const artifactSha256 = await hashDirectory(artifactPath);
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  const profilePath = await mkdtemp(path.join(tmpdir(), `fluxiq-e2e-${safeLabel}-${randomUUID()}-`));

  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      colorScheme: "light",
      args: [
        `--disable-extensions-except=${artifactPath}`,
        `--load-extension=${artifactPath}`,
        "--no-first-run",
        "--disable-default-apps",
        "--disable-background-networking",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"
      ]
    });
    const networkGuard = await installDeterministicNetworkGuard(context);
    const worker = await waitForServiceWorker(context);
    const id = extensionIdFromWorker(worker);
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${id}/sidepanel/index.html`);

    return {
      context,
      worker,
      extensionPage,
      profilePath,
      networkGuard,
      metadata: {
        id,
        name: manifest.name,
        version: manifest.version,
        artifactPath,
        artifactSha256
      }
    };
  } catch (error) {
    await context?.close().catch(() => undefined);
    await rm(profilePath, { recursive: true, force: true });
    throw error;
  }
}

export async function closeExtensionSession(session: ExtensionSession): Promise<void> {
  await session.context.close();
  await rm(session.profilePath, { recursive: true, force: true });
  try {
    await stat(session.profilePath);
    throw new Error(`extension.cleanup: Chromium profile still exists: ${session.profilePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function restartServiceWorker(session: ExtensionSession): Promise<Worker> {
  const original = session.worker;
  const targetPage = session.extensionPage;
  const cdp = await session.context.newCDPSession(targetPage);
  const targets = await cdp.send("Target.getTargets");
  const target = targets.targetInfos.find((item) => item.type === "service_worker" && item.url.startsWith(`chrome-extension://${session.metadata.id}/`));
  if (!target) throw new Error("extension.worker: active MV3 service-worker target was not found");

  const closeResult = await cdp.send("Target.closeTarget", { targetId: target.targetId });
  if (!closeResult.success) throw new Error("extension.worker: Chromium refused to close the MV3 target");
  await targetPage.evaluate(async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await chrome.runtime.sendMessage({ type: "fluxiq.getStatus" });
        if (response?.ok) return;
      } catch {
        // The worker is between instances. Retrying the real runtime message wakes it.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("MV3 worker did not answer a readiness message after restart");
  });
  // Playwright 1.51 may retain the same Worker wrapper when Chromium replaces
  // the underlying MV3 target. The closed CDP target plus a successful runtime
  // response is the lifecycle assertion; prefer a newly surfaced wrapper when
  // the version exposes one, otherwise refresh the retained wrapper.
  session.worker = session.context.serviceWorkers().find((worker) => worker !== original)
    ?? session.context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://"))
    ?? original;
  return session.worker;
}

async function waitForServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://"));
  return existing ?? context.waitForEvent("serviceworker", { timeout: 10_000 });
}

function extensionIdFromWorker(worker: Worker): string {
  const url = new URL(worker.url());
  if (url.protocol !== "chrome-extension:" || !url.hostname) {
    throw new Error(`extension.install: unexpected MV3 worker URL: ${worker.url()}`);
  }
  return url.hostname;
}

async function readExtensionManifest(artifactPath: string): Promise<{ name: string; version: string }> {
  const manifestPath = path.join(artifactPath, "manifest.json");
  let source: string;
  try {
    source = await readFile(manifestPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `environment.missing: E2E extension artifact not found at ${manifestPath}. ` +
        "Build the current source into apps/extension/dist/e2e-chromium before running Playwright."
      );
    }
    throw error;
  }
  const manifest = JSON.parse(source) as { manifest_version?: number; name?: string; version?: string };
  if (manifest.manifest_version !== 3 || typeof manifest.name !== "string" || typeof manifest.version !== "string") {
    throw new Error(`extension.install: invalid MV3 manifest at ${manifestPath}`);
  }
  return { name: manifest.name, version: manifest.version };
}

async function hashDirectory(directory: string): Promise<string> {
  const hash = createHash("sha256");
  for (const relative of await listFiles(directory)) {
    hash.update(relative.replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path.join(directory, relative)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort((left, right) => left.localeCompare(right));
}
