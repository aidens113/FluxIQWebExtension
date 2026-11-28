// Screenshots are evidence beside a journey: numbered PNGs with an index sidecar, and a failed capture is
// recorded as skipped instead of failing anything.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { Page } from "@playwright/test";
import { shotsDirectory } from "../extension-shots.js";
import { journeyShots } from "../screenshots.js";

const page = (fail: boolean): Page => ({
  screenshot: async (options: { path: string }) => {
    if (fail) throw new Error("closed");
    await writeFile(options.path, "png");
  },
}) as unknown as Page;

test("shots are numbered, written and indexed; a failed capture is skipped, not thrown", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ui-e2e-shots-"));
  try {
    const shots = journeyShots(directory);
    const first = await shots.shoot("Extension first open", "extension", page(false));
    assert.equal(first.file, path.join(directory, "01-extension-first-open.png"));
    assert.equal((await shots.shoot("settings", "extension", page(true))).skipped, "closed");
    const index = JSON.parse(await readFile(path.join(directory, "index.json"), "utf8")) as Array<{ name: string; file: string | null; skipped?: string }>;
    assert.deepEqual(index.map(item => [item.name, item.file === null ? "skipped" : "taken"]), [["Extension first open", "taken"], ["settings", "skipped"]]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a journey's shots go under the run's workspace directory", () => {
  assert.equal(shotsDirectory(path.join("runs", "w"), "first-run"), path.join("runs", "w", "ui-e2e-screenshots", "first-run"));
});
