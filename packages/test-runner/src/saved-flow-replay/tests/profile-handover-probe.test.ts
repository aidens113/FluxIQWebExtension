import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { profileHandoverProbe } from "../profile-handover-probe.js";

async function withProfile(run: (profile: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-handover-probe-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("a profile with Chrome's lockfile and a recent Default write reports both", async () => {
  await withProfile(async profile => {
    await mkdir(path.join(profile, "Default"));
    await writeFile(path.join(profile, "lockfile"), "");
    await writeFile(path.join(profile, "Default", "History"), "");
    const written = new Date(1_000_000);
    const older = new Date(500_000);
    await utimes(path.join(profile, "lockfile"), older, older);
    await utimes(path.join(profile, "Default", "History"), written, written);
    await utimes(path.join(profile, "Default"), older, older);
    await utimes(profile, older, older);
    assert.deepEqual(await profileHandoverProbe(profile, () => 1_058_000), { lockfile: true, sinceLastWriteMs: 58_000 });
  });
});

test("a profile with no lockfile reports false, and a missing profile reports no last write", async () => {
  await withProfile(async profile => {
    const stamp = new Date(2_000_000);
    await writeFile(path.join(profile, "Local State"), "");
    await utimes(path.join(profile, "Local State"), stamp, stamp);
    await utimes(profile, new Date(1_000), new Date(1_000));
    assert.deepEqual(await profileHandoverProbe(profile, () => 2_000_500), { lockfile: false, sinceLastWriteMs: 500 });
    assert.deepEqual(await profileHandoverProbe(path.join(profile, "absent")), { lockfile: false, sinceLastWriteMs: null });
  });
});

test("a write stamped in the future reports zero, never a negative interval", async () => {
  await withProfile(async profile => {
    const stamp = new Date(5_000_000);
    await writeFile(path.join(profile, "lockfile"), "");
    await utimes(path.join(profile, "lockfile"), stamp, stamp);
    await utimes(profile, stamp, stamp);
    assert.deepEqual(await profileHandoverProbe(profile, () => 1_000), { lockfile: true, sinceLastWriteMs: 0 });
  });
});
