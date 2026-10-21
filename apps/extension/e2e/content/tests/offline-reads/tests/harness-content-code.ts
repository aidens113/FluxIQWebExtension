// The extension's content code as the snapshot page runs it in this spec: the
// content and page-world bundles the content harness's global setup built with
// the extension's own esbuild settings, and the background's own
// `executeAction` builder (the domain's `executeActionMessage`).

import { readFile } from "node:fs/promises";
import type { SnapshotContentCode } from "../../../../../../../packages/test-runner/src/offline-snapshot-page/index.js";
import { executeActionMessage } from "@fluxiq-web-extension/domain/client";
import { CONTENT_HARNESS_BUNDLE_ENV, CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV } from "../../../bundle-env.js";

export async function harnessContentCode(): Promise<SnapshotContentCode> {
  return {
    contentScript: await readFile(requiredEnv(CONTENT_HARNESS_BUNDLE_ENV), "utf8"),
    pageWorldScript: await readFile(requiredEnv(CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV), "utf8"),
    actionMessage: executeActionMessage
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run the specs through e2e/playwright.content.config.ts.`);
  return value;
}
