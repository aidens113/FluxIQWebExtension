// Builds the content-script bundle once per run, before any worker starts,
// with the extension's own esbuild settings (bundleExtensionEntry), into a
// directory this run owns under .harness-build/. A concurrent `pnpm build`
// deletes dist/ and rewrites build/, and a concurrent harness run builds into
// a directory of its own, so neither can change the bundle under a running
// test. Workers learn the bundle's path from the environment. The returned
// function is Playwright's global teardown; it removes this run's directory.

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleExtensionEntry } from "../../scripts/build-extension.mjs";
import { CONTENT_HARNESS_BUNDLE_ENV } from "./bundle-env.js";

const harnessBuildRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), ".harness-build");

export default async function globalSetup(): Promise<() => Promise<void>> {
  const runDir = path.join(harnessBuildRoot, `run-${process.pid}-${Date.now()}`);
  await mkdir(runDir, { recursive: true });
  process.env[CONTENT_HARNESS_BUNDLE_ENV] = await bundleExtensionEntry("content", runDir, { logLevel: "warning" });
  return async () => {
    await rm(runDir, { recursive: true, force: true });
  };
}
