import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  acquireCampaignLease,
  CampaignLeaseHeldError,
  type CampaignLeaseProcessProbe,
} from "../campaign-lease.js";

const PID = 4101;

async function temporaryRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "fluxiq-campaign-lease-"));
}

function probe(boot: string, identities: Readonly<Record<number, string | null>>): CampaignLeaseProcessProbe {
  return {
    bootIdentity: async () => boot,
    processIdentity: async (pid) => identities[pid] ?? null,
  };
}

const options = (boot = "boot-one", identity = "process-one") => ({
  processId: PID,
  processProbe: probe(boot, { [PID]: identity }),
  randomId: () => `leaseid-${boot}-${identity}`.replace(/[^A-Za-z0-9_-]/gu, "-").padEnd(16, "x"),
  now: () => new Date("2026-09-14T12:00:00.000Z"),
  sleep: async () => undefined,
});

test("a concurrent live owner is refused and the first owner remains authoritative", async () => {
  const root = await temporaryRoot();
  try {
    const first = await acquireCampaignLease(root, options());
    await assert.rejects(acquireCampaignLease(root, { ...options(), randomId: () => "second-live-lease" }), CampaignLeaseHeldError);
    await first.assertOwned();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a dead process is recovered and its complete owner record is preserved", async () => {
  const root = await temporaryRoot();
  try {
    const dead = await acquireCampaignLease(root, options());
    const recovered = await acquireCampaignLease(root, {
      ...options("boot-one", "process-two"),
      processId: 4102,
      processProbe: probe("boot-one", { [PID]: null, 4102: "process-two" }),
    });
    await recovered.assertOwned();
    await assert.rejects(dead.assertOwned(), /ownership was lost/u);
    const archived = JSON.parse(await readFile(path.join(root, "lease-history", dead.owner.leaseId, "owner.json"), "utf8"));
    assert.deepEqual(archived, dead.owner);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a lease from an earlier boot is recovered even when its PID exists", async () => {
  const root = await temporaryRoot();
  try {
    const old = await acquireCampaignLease(root, options("boot-old", "same-process"));
    const current = await acquireCampaignLease(root, {
      ...options("boot-new", "same-process"),
      processProbe: probe("boot-new", { [PID]: "same-process" }),
    });
    await current.assertOwned();
    await access(path.join(root, "lease-history", old.owner.leaseId, "owner.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PID reuse is recovered when the process creation identity changed", async () => {
  const root = await temporaryRoot();
  try {
    const old = await acquireCampaignLease(root, options("same-boot", "old-process"));
    const current = await acquireCampaignLease(root, {
      ...options("same-boot", "new-process"),
      processProbe: probe("same-boot", { [PID]: "new-process" }),
    });
    await current.assertOwned();
    await access(path.join(root, "lease-history", old.owner.leaseId, "owner.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normal release is idempotent and permits immediate reacquisition", async () => {
  const root = await temporaryRoot();
  try {
    const first = await acquireCampaignLease(root, options());
    await first.release();
    await first.release();
    const second = await acquireCampaignLease(root, { ...options(), randomId: () => "replacement-lease" });
    await second.assertOwned();
    await second.release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("racing contenders produce exactly one owner and never displace it", async () => {
  const root = await temporaryRoot();
  try {
    const contenders = Array.from({ length: 8 }, (_, index) => acquireCampaignLease(root, {
      ...options(),
      randomId: () => `racing-contender-${index}`,
    }));
    const results = await Promise.allSettled(contenders);
    const winners = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof acquireCampaignLease>>> => result.status === "fulfilled");
    assert.equal(winners.length, 1);
    assert.ok(results.filter((result) => result.status === "rejected").every((result) => result.reason instanceof CampaignLeaseHeldError));
    await winners[0]!.value.assertOwned();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

