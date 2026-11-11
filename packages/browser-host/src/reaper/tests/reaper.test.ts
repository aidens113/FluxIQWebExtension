import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createReaperClient } from "../reaper/index.js";

const LIMIT = AbortSignal.timeout.bind(AbortSignal, 60_000);

/** A process that does nothing but hold `directory` as its --user-data-dir, as a browser's command line does. */
function holdProfile(directory: string) {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", `--user-data-dir=${directory}`], { stdio: "ignore", windowsHide: true });
}

test("when the engine's link to the reaper goes, the reaper kills what holds a registered profile and removes the fresh one", async () => {
  const fresh = await mkdtemp(path.join(os.tmpdir(), "fx-reaper-fresh-"));
  const named = await mkdtemp(path.join(os.tmpdir(), "fx-reaper-named-"));
  await writeFile(path.join(fresh, "Cookies"), "x");
  const holdsFresh = holdProfile(fresh);
  const holdsNamed = holdProfile(named);
  const unregistered = await mkdtemp(path.join(os.tmpdir(), "fx-reaper-unregistered-"));
  const bystander = holdProfile(unregistered);
  const reaper = createReaperClient();
  try {
    await Promise.all([reaper.register(fresh, true), reaper.register(named, false)]);
    reaper.disconnect();
    await Promise.all([once(holdsFresh, "exit", { signal: LIMIT() }), once(holdsNamed, "exit", { signal: LIMIT() })]);
    await waitUntil(() => !existsSync(fresh));
    assert.equal(existsSync(fresh), false, "the fresh profile is removed");
    assert.equal(existsSync(named), true, "a named profile is kept");
    assert.equal(bystander.exitCode, null, "a process on an unregistered profile is left alone");
  } finally {
    for (const child of [holdsFresh, holdsNamed, bystander]) child.kill();
    await rm(fresh, { recursive: true, force: true });
    await rm(named, { recursive: true, force: true });
    await rm(unregistered, { recursive: true, force: true });
  }
});

async function waitUntil(condition: () => boolean, timeoutMs = 30_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > end) throw new Error("condition not met in time");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
