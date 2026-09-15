import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { CampaignLeaseProcessProbe } from "../../lease.js";
import { acquireMachineCellSlot, type MachineCellSlotOptions, type PidPresence } from "../index.js";

const GIB = 1024 ** 3;
const plenty = () => 64 * GIB;
const presenceOf = (processProbe: MutableProbe, pid: number): PidPresence => typeof processProbe.identities.get(pid) === "string" ? "present" : "absent";

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
    pidPresence: candidatePid => presenceOf(processProbe, candidatePid),
    ...change,
  };
}

function counting(processProbe: MutableProbe, calls: number[]): CampaignLeaseProcessProbe {
  return {
    bootIdentity: processProbe.bootIdentity,
    processIdentity: async pid => { calls.push(pid); return processProbe.processIdentity(pid); },
  };
}

/** Drives the wait loop poll by poll on a fake monotonic clock, failing fast past `limit` polls. */
function scriptedPolls(stepMs: number, limit: number, onPoll: (poll: number) => unknown = () => undefined) {
  const state = { polls: 0, clock: 0 };
  const hooks = {
    waitTimeoutMs: 120_000,
    monotonicNowMs: () => state.clock,
    sleep: async () => {
      state.polls += 1;
      state.clock += stepMs;
      if (state.polls > limit) throw new Error(`slot wait needed more than ${limit} polls`);
      await onPoll(state.polls);
      await new Promise<void>(resolve => setImmediate(resolve));
    },
  };
  return { state, hooks };
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

test("a queued waiter probes each owner once and runs no probe while the queue stands still", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, 701, "ticket_owner_701", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(0, 200, async poll => { if (poll === 200) await holder.release(); });
    const waiter = await acquireMachineCellSlot(root, options(processProbe, 702, "ticket_owner_702", "2026-09-14T10:00:00.002Z", { capacity: 1, processProbe: counting(processProbe, calls), ...hooks }));
    assert.equal(state.polls, 200);
    assert.deepEqual(calls, [702, 701], "one probe of the waiter's own identity at enqueue, one when the holder is first seen, none across 200 polls");
    await waiter.release();
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a present owner is re-probed at most once per minute", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, 711, "ticket_owner_711", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(10_000, 15, async poll => { if (poll === 15) await holder.release(); });
    const waiter = await acquireMachineCellSlot(root, options(processProbe, 712, "ticket_owner_712", "2026-09-14T10:00:00.002Z", { capacity: 1, processProbe: counting(processProbe, calls), ...hooks }));
    assert.equal(state.clock, 150_000);
    assert.deepEqual(calls, [712, 711, 712, 711, 712, 711], "enqueue and first sight, then one probe per owner at 60 s and 120 s");
    await waiter.release();
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a crashed owner is recovered on the next poll, not after the re-verification interval", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, 721, "ticket_owner_721", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(100, 3, poll => { if (poll === 3) processProbe.identities.set(721, null); });
    const waiter = await acquireMachineCellSlot(root, options(processProbe, 722, "ticket_owner_722", "2026-09-14T10:00:00.002Z", { capacity: 1, processProbe: counting(processProbe, calls), ...hooks }));
    assert.equal(state.polls, 3);
    assert.deepEqual(calls.filter(pid => pid === 721), [721, 721], "first sight, then the confirmation before archiving");
    assert.equal(await entryCount(path.join(root, "history")), 1);
    await waiter.release();
    await assert.rejects(holder.release, /ENOENT|ownership/u);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a PID reused by a different process is detected within one re-verification interval", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, 731, "ticket_owner_731", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(1_000, 60, poll => { if (poll === 1) processProbe.identities.set(731, "replacement-process"); });
    const waiter = await acquireMachineCellSlot(root, options(processProbe, 732, "ticket_owner_732", "2026-09-14T10:00:00.002Z", { capacity: 1, processProbe: counting(processProbe, calls), ...hooks }));
    assert.equal(state.clock, 60_000, "the reused PID stays present, so only the one-minute re-probe can expose it");
    assert.deepEqual(calls.filter(pid => pid === 731), [731, 731]);
    assert.equal(await entryCount(path.join(root, "history")), 1);
    await waiter.release();
    await assert.rejects(holder.release, /ENOENT|ownership/u);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a live owner is never archived, even when the spawn-free check reports its PID gone", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, 741, "ticket_owner_741", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(10_000, 30, async poll => { if (poll === 30) await holder.release(); });
    const waiter = await acquireMachineCellSlot(root, options(processProbe, 742, "ticket_owner_742", "2026-09-14T10:00:00.002Z", {
      capacity: 1,
      processProbe: counting(processProbe, calls),
      pidPresence: pid => pid === 741 ? "absent" : presenceOf(processProbe, pid),
      ...hooks,
    }));
    assert.equal(state.clock, 300_000);
    assert.equal(calls.filter(pid => pid === 741).length, 30, "every absent report is confirmed by a full probe");
    assert.equal(await entryCount(path.join(root, "history")), 0);
    await waiter.release();
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("without an injected presence check the wait loop uses the spawn-free signal 0 check", async () => {
  const root = await temporaryRoot();
  const processProbe = probe();
  const calls: number[] = [];
  try {
    const holder = await acquireMachineCellSlot(root, options(processProbe, process.pid, "ticket_owner_self", "2026-09-14T10:00:00.001Z", { capacity: 1 }));
    const { state, hooks } = scriptedPolls(0, 50, async poll => { if (poll === 50) await holder.release(); });
    const waiterOptions = options(processProbe, 752, "ticket_owner_752", "2026-09-14T10:00:00.002Z", { capacity: 1, processProbe: counting(processProbe, calls), ...hooks });
    delete waiterOptions.pidPresence;
    const waiter = await acquireMachineCellSlot(root, waiterOptions);
    assert.equal(state.polls, 50);
    assert.deepEqual(calls.filter(pid => pid === process.pid), [process.pid], "this test process is present, so its slot is probed once");
    await waiter.release();
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});
