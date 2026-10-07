import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { forgetCachedServiceWorkers } from "../forget-cached-service-workers.js";

test("the profile's service-worker store goes, and nothing else in the profile does", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "fluxiq-forget-workers-"));
  try {
    await mkdir(path.join(profile, "Default", "Service Worker", "ScriptCache"), { recursive: true });
    await writeFile(path.join(profile, "Default", "Service Worker", "ScriptCache", "index"), "an old background worker");
    await writeFile(path.join(profile, "Default", "Cookies"), "a sign-in");
    await mkdir(path.join(profile, "Default", "Local Storage"));
    await forgetCachedServiceWorkers(profile);
    assert.deepEqual((await readdir(path.join(profile, "Default"))).sort(), ["Cookies", "Local Storage"]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

test("a profile that has no stored service workers, or no Default directory yet, is left as it is", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "fluxiq-forget-workers-"));
  try {
    await forgetCachedServiceWorkers(profile);
    assert.deepEqual(await readdir(profile), []);
    await mkdir(path.join(profile, "Default"));
    await forgetCachedServiceWorkers(profile);
    assert.deepEqual(await readdir(path.join(profile, "Default")), []);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
