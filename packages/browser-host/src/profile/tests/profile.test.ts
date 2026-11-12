import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFreshProfile, createNamedProfile, namedProfileDirectory, removeProfile } from "../index.js";

test("a fresh profile is a new directory under the temp root, distinct per call, and removable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fx-profile-test-"));
  try {
    const a = await createFreshProfile("host-1", root);
    const b = await createFreshProfile("host-1", root);
    assert.notEqual(a, b);
    assert.equal(path.dirname(a), root);
    assert.match(path.basename(a), /^fluxiq-host-host-1-/u);
    await writeFile(path.join(a, "Cookies"), "x");
    await removeProfile(a);
    assert.equal(existsSync(a), false);
    assert.equal(existsSync(b), true);
    await removeProfile(a);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a named profile lives at <dataDir>/browser-hosts/<name>/<hostId>, is created once and kept", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fx-named-test-"));
  try {
    const expected = path.join(dataDir, "browser-hosts", "work", "host-2");
    assert.equal(namedProfileDirectory(dataDir, "work", "host-2"), expected);
    assert.equal(await createNamedProfile(dataDir, "work", "host-2"), expected);
    await writeFile(path.join(expected, "marker"), "kept");
    assert.equal(await createNamedProfile(dataDir, "work", "host-2"), expected);
    assert.equal(existsSync(path.join(expected, "marker")), true);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("a name or host id that is not one plain path segment is refused", async () => {
  for (const bad of ["..", ".", "a/b", "a\\b", "", "x y"]) {
    assert.throws(() => namedProfileDirectory("d", bad, "host-1"), { code: "browser_host.bad_name" });
    await assert.rejects(createFreshProfile(bad), { code: "browser_host.bad_name" });
  }
});
