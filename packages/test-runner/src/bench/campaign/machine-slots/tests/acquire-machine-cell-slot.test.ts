import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { CampaignLeaseProcessProbe } from "../../lease.js";
import { acquireMachineCellSlot, type MachineCellSlotOptions } from "../index.js";

const GIB = 1024 ** 3;
const plenty = () => 64 * GIB;

type MutableProbe = CampaignLeaseProcessProbe & { boot: string; identities: Map<number, string | null> };

function probe(): MutableProbe {
  const value: MutableProbe = {
    boot: "boot-one",
    identities: new Map(),
    bootIdentity: async () => value.boot,
    processIdentity: async pid => value.identities.get(pid) ?? null,
  };
  return value;
}

function options(processProbe: MutableProbe, pid: number, ticketId: string, requestedAt: string, change: Partial<MachineCellSlotOptions> = {}): MachineCellSlotOptions {
  processProbe.identities.set(pid, `process-${pid}`);
  return {
    processProbe,
    processId: pid,
    randomId: () => ticketId,
    now: () => new Date(requestedAt),
    freeMemoryBytes: plenty,
    pollIntervalMs: 2,
    waitTimeoutMs: 2_000,
    ...change,
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "fluxiq-machine-slots-")));
  return path.join(root, "pool");
}

async function eventually(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error("condition did not settle");
}

async function entryCount(directory: string): Promise<number> {
  return readdir(directory).then(entries => entries.length, error => (error as NodeJS.ErrnoException).code === "ENOENT" ? 0 : Promise.reject(error));
}

test("the global pool admits at most two concurrent owners and release is idempotent", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  try {
    const first = await acquireMachineCellSlot(root, options(processProbe, 101, "ticket_owner_101", "2026-09-14T10:00:00.001Z"));
    const second = await acquireMachineCellSlot(root, options(processProbe, 102, "ticket_owner_102", "2026-09-14T10:00:00.002Z"));
    assert.notEqual(first.slotIndex, second.slotIndex);
    const thirdPromise = acquireMachineCellSlot(root, options(processProbe, 103, "ticket_owner_103", "2026-09-14T10:00:00.003Z"));
    await eventually(async () => await entryCount(path.join(root, "tickets")) === 1);
    assert.equal(await entryCount(path.join(root, "slots")), 2);
    await first.release();
    await first.release();
    const third = await thirdPromise;
    assert.equal(await entryCount(path.join(root, "slots")), 2);
    await assert.rejects(first.assertOwned, /already been released/u);
    await Promise.all([second.release(), third.release()]);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("FIFO tickets prevent a later scheduler from overtaking an earlier waiter", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  try {
    const held = await acquireMachineCellSlot(root, options(processProbe, 201, "ticket_owner_201", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const order: string[] = [];
    const earlierPromise = acquireMachineCellSlot(root, options(processProbe, 202, "ticket_owner_202", "2026-09-14T10:00:00.002Z", { capacity: 1 })).then(slot => { order.push("earlier"); return slot; });
    await eventually(async () => await entryCount(path.join(root, "tickets")) === 1);
    const laterPromise = acquireMachineCellSlot(root, options(processProbe, 203, "ticket_owner_203", "2026-09-14T10:00:00.003Z", { capacity: 1 })).then(slot => { order.push("later"); return slot; });
    await eventually(async () => await entryCount(path.join(root, "tickets")) === 2);
    await held.release();
    const earlier = await earlierPromise;
    assert.deepEqual(order, ["earlier"]);
    await earlier.release();
    const later = await laterPromise;
    assert.deepEqual(order, ["earlier", "later"]);
    await later.release();
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("the memory gate retains four GiB and budgets three GiB for a new slot", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  try {
    await assert.rejects(acquireMachineCellSlot(root, options(processProbe, 301, "ticket_owner_301", "2026-09-14T10:00:00.001Z", {
      freeMemoryBytes: () => 7 * GIB - 1,
      waitTimeoutMs: 20,
    })), /wait timed out/u);
    assert.equal(await entryCount(path.join(root, "slots")), 0);
    assert.equal(await entryCount(path.join(root, "tickets")), 0);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("an active slot remains in the memory budget when the next ticket reaches queue rank zero", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  let freeBytes = 64 * GIB;
  try {
    const first = await acquireMachineCellSlot(root, options(processProbe, 351, "ticket_owner_351", "2026-09-14T10:00:00.001Z", { freeMemoryBytes: () => freeBytes }));
    freeBytes = 9 * GIB;
    const secondPromise = acquireMachineCellSlot(root, options(processProbe, 352, "ticket_owner_352", "2026-09-14T10:00:00.002Z", { freeMemoryBytes: () => freeBytes }));
    await eventually(async () => await entryCount(path.join(root, "tickets")) === 1);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(await entryCount(path.join(root, "slots")), 1, "9 GiB cannot admit a second slot because two admitted slots require 10 GiB");
    freeBytes = 10 * GIB;
    const second = await secondPromise;
    assert.equal(await entryCount(path.join(root, "slots")), 2);
    await Promise.all([first.release(), second.release()]);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("dead, rebooted, and PID-reused owners are recovered with identity fencing", async t => {
  for (const recovery of ["dead", "reboot", "pid-reuse"] as const) await t.test(recovery, async () => {
    const root = await temporaryRoot();
    const processProbe = probe();
    try {
      const old = await acquireMachineCellSlot(root, options(processProbe, 401, `ticket_old_${recovery.padEnd(8, "x")}`, "2026-09-14T10:00:00.001Z", { capacity: 1 }));
      if (recovery === "dead") processProbe.identities.set(401, null);
      if (recovery === "reboot") processProbe.boot = "boot-two";
      if (recovery === "pid-reuse") processProbe.identities.set(401, "replacement-process");
      const replacementPid = recovery === "pid-reuse" ? 401 : 402;
      const replacementOptions = options(processProbe, replacementPid, `ticket_new_${recovery.padEnd(8, "x")}`, "2026-09-14T10:00:00.002Z", { capacity: 1 });
      if (recovery === "pid-reuse") processProbe.identities.set(401, "replacement-process");
      const replacement = await acquireMachineCellSlot(root, replacementOptions);
      assert.equal(replacement.slotIndex, 0);
      assert.equal(await entryCount(path.join(root, "history")), 1);
      await replacement.release();
      await assert.rejects(old.release, /ENOENT|ownership/u);
    } finally {
      await rm(path.dirname(root), { recursive: true, force: true });
    }
  });
});

test("unreadable ownership fails closed instead of stealing a slot", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  try {
    const slot = path.join(root, "slots", "slot-0");
    await mkdir(slot, { recursive: true });
    await writeFile(path.join(slot, "owner.json"), "{not-json", "utf8");
    await assert.rejects(acquireMachineCellSlot(root, options(processProbe, 501, "ticket_owner_501", "2026-09-14T10:00:00.001Z", { capacity: 1 })), /owner is unreadable; refusing unsafe recovery/u);
    assert.equal(await entryCount(path.join(root, "slots")), 1);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("unsafe roots, configuration, identities, and ticket ids are rejected", async () => {
  const processProbe = probe();
  await assert.rejects(acquireMachineCellSlot("relative-pool", options(processProbe, 601, "ticket_owner_601", "2026-09-14T10:00:00.001Z")), /absolute path/u);
  await assert.rejects(acquireMachineCellSlot(path.parse(process.cwd()).root, options(processProbe, 602, "ticket_owner_602", "2026-09-14T10:00:00.001Z")), /filesystem root/u);
  const root = await temporaryRoot();
  try {
    await assert.rejects(acquireMachineCellSlot(root, options(processProbe, 603, "ticket_owner_603", "2026-09-14T10:00:00.001Z", { capacity: 0 })), /capacity is invalid/u);
    await assert.rejects(acquireMachineCellSlot(root, options(processProbe, 604, "ticket_owner_604", "2026-09-14T10:00:00.001Z", { reserveBytes: Number.MAX_SAFE_INTEGER, bytesPerSlot: 2 })), /memory configuration is unsafe/u);
    await assert.rejects(acquireMachineCellSlot(root, options(processProbe, 605, "bad", "2026-09-14T10:00:00.001Z")), /ticket id is unsafe/u);
    processProbe.identities.set(606, null);
    await assert.rejects(acquireMachineCellSlot(root, { ...options(processProbe, 606, "ticket_owner_606", "2026-09-14T10:00:00.001Z"), processProbe: { bootIdentity: processProbe.bootIdentity, processIdentity: async () => null } }), /Cannot establish/u);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});
