import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { requireExtension } from "../require-extension.js";

test("a directory holding the manifest Chromium is pointed at passes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-require-extension-"));
  try {
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({ manifest_version: 3 }), "utf8");
    await assert.doesNotReject(() => requireExtension(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * The manifest, not the directory. A build that made the directory and then
 * failed leaves an empty one behind, and the run used to get as far as
 * Playwright's own launch failure -- which names neither the Lab's extension
 * build nor the path it looked in.
 */
test("a missing extension, and a directory with no manifest, are both refused as environment.missing naming the path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-require-extension-"));
  try {
    const absent = path.join(root, "never-built");
    const refusal = (expected: string) => (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && error.message === `Built E2E extension is missing: ${expected}`;
    await assert.rejects(() => requireExtension(absent), refusal(absent));
    const empty = path.join(root, "empty");
    await mkdir(empty);
    await assert.rejects(() => requireExtension(empty), refusal(empty));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
