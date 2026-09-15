import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDurableJson } from "../../durable-file.js";
import { defaultCampaignLeaseProcessProbe, type CampaignLeaseProcessProbe } from "../lease.js";
import { createCachedOwnerLiveness, type CachedOwnerLiveness } from "./cached-owner-liveness.js";
import { pidPresence, type PidPresence } from "./pid-presence.js";

const SCHEMA_VERSION = "0.1" as const;
const SAFE_ID = /^[A-Za-z0-9_-]{16,96}$/u;
const CONTENTION_CODES = new Set(["EACCES", "EBUSY", "EEXIST", "ENOTEMPTY", "EPERM"]);
const GIB = 1024 ** 3;
// How long an owner whose PID is still present is trusted after its last full
// identity probe, which starts powershell.exe on Windows and so cannot run on
// every 100 ms poll. The interval bounds one rare case only: an owner that
// crashed, and whose PID another process took before the next poll, keeps its
// slot or queue position for at most this long. A crashed owner whose PID is
// not reused is recovered on the next poll. Owners release in `finally`, so a
// crash is already the exception, and one minute is small beside cells that
// run for minutes and the 30-minute wait timeout, while it cuts steady-state
// probing from every poll to one probe per owner per minute per waiter.
const OWNER_REVERIFY_INTERVAL_MS = 60_000;

export type MachineCellSlotOwner = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  ticketId: string;
  pid: number;
  bootIdentitySha256: string;
  processIdentitySha256: string;
  requestedAt: string;
}>;

export type MachineCellSlot = Readonly<{
  owner: MachineCellSlotOwner;
  slotIndex: number;
  assertOwned(): Promise<void>;
  release(): Promise<void>;
}>;

export type MachineCellSlotOptions = {
  capacity?: number;
  reserveBytes?: number;
  bytesPerSlot?: number;
  pollIntervalMs?: number;
  waitTimeoutMs?: number;
  processId?: number;
  processProbe?: CampaignLeaseProcessProbe;
  freeMemoryBytes?: () => number | Promise<number>;
  now?: () => Date;
  randomId?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  /** Spawn-free check of whether any process holds a PID; defaults to signal 0. */
  pidPresence?: (pid: number) => PidPresence;
  /** Monotonic millisecond clock for owner re-verification; defaults to `performance.now()`. */
  monotonicNowMs?: () => number;
};

/** Acquires one FIFO, machine-wide isolated-cell slot from a filesystem pool. */
export async function acquireMachineCellSlot(rootDirectory: string, options: MachineCellSlotOptions = {}): Promise<MachineCellSlot> {
  const root = safeRoot(rootDirectory);
  const configuration = configurationOf(options);
  const probe = options.processProbe ?? defaultCampaignLeaseProcessProbe;
  const pid = options.processId ?? process.pid;
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Machine cell slot process id must be a positive safe integer");
  const ticketId = (options.randomId ?? (() => randomBytes(18).toString("base64url")))();
  if (!SAFE_ID.test(ticketId)) throw new Error("Machine cell slot ticket id is unsafe");
  const now = options.now ?? (() => new Date());
  const requested = now();
  if (Number.isNaN(requested.getTime())) throw new Error("Machine cell slot clock returned an invalid date");
  const bootIdentity = await probe.bootIdentity();
  const processIdentity = await probe.processIdentity(pid);
  if (!bootIdentity || !processIdentity) throw new Error("Cannot establish the current process identity for a machine cell slot");
  const owner: MachineCellSlotOwner = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    ticketId,
    pid,
    bootIdentitySha256: digest(bootIdentity),
    processIdentitySha256: digest(processIdentity),
    requestedAt: requested.toISOString(),
  });
  // Every poll still reads every owner and still runs stale recovery; only the
  // cost of deciding liveness changes. See OWNER_REVERIFY_INTERVAL_MS.
  const liveness = createCachedOwnerLiveness({
    verify: candidate => ownerIsLive(candidate, probe, bootIdentity),
    presence: options.pidPresence ?? (candidatePid => pidPresence(candidatePid)),
    monotonicNowMs: options.monotonicNowMs ?? (() => performance.now()),
    reverifyIntervalMs: OWNER_REVERIFY_INTERVAL_MS,
  });
  // This ticket's identity was probed just above, so its first poll need not repeat that.
  liveness.markVerified(owner);

  const ticketsDirectory = inside(root, "tickets");
  const slotsDirectory = inside(root, "slots");
  const historyDirectory = inside(root, "history");
  const candidatesDirectory = inside(root, "candidates");
  await mkdir(root, { recursive: true });
  await Promise.all([ticketsDirectory, slotsDirectory, historyDirectory, candidatesDirectory].map(directory => mkdir(directory, { recursive: true })));
  const candidateDirectory = inside(candidatesDirectory, ticketId);
  const ticketDirectory = inside(ticketsDirectory, ticketId);
  await mkdir(candidateDirectory, { recursive: false });
  let published = false;
  try {
    await createDurableJson(path.join(candidateDirectory, "owner.json"), owner);
    await rename(candidateDirectory, ticketDirectory);
    published = true;
    const sleep = options.sleep ?? (milliseconds => new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
    const deadline = Date.now() + configuration.waitTimeoutMs;
    for (;;) {
      await recoverStaleEntries(ticketsDirectory, slotsDirectory, historyDirectory, configuration.capacity, liveness);
      const active = await readSlots(slotsDirectory, configuration.capacity);
      const tickets = await readOwners(ticketsDirectory, "ticket");
      const ordered = tickets.sort(compareOwners);
      const rank = ordered.findIndex(item => item.owner.ticketId === ticketId);
      if (rank < 0) throw new Error("Machine cell slot ticket ownership was lost");
      const available = configuration.capacity - active.length;
      if (rank < available) {
        const freeBytes = await (options.freeMemoryBytes ?? (() => os.freemem()))();
        if (!Number.isSafeInteger(freeBytes) || freeBytes < 0) throw new Error("Machine cell slot memory probe returned an invalid byte count");
        const requiredBytes = configuration.reserveBytes + configuration.bytesPerSlot * (active.length + rank + 1);
        if (freeBytes >= requiredBytes) {
          for (let slotIndex = 0; slotIndex < configuration.capacity; slotIndex += 1) {
            const slotDirectory = inside(slotsDirectory, `slot-${slotIndex}`);
            try {
              await rename(ticketDirectory, slotDirectory);
              return slotHandle(slotDirectory, owner, slotIndex);
            } catch (error) {
              if (errorCode(error) === "ENOENT") break;
              if (!CONTENTION_CODES.has(errorCode(error) ?? "")) throw error;
            }
          }
        }
      }
      if (Date.now() >= deadline) throw new Error("Machine cell slot wait timed out");
      await sleep(configuration.pollIntervalMs);
    }
  } finally {
    await removeDirectory(candidateDirectory).catch(() => undefined);
    if (published) await removeOwnedTicket(ticketDirectory, ticketId).catch(() => undefined);
  }
}

function configurationOf(options: MachineCellSlotOptions) {
  const capacity = integer(options.capacity ?? 2, "capacity", 1, 8);
  const reserveBytes = integer(options.reserveBytes ?? 4 * GIB, "reserveBytes", 1, Number.MAX_SAFE_INTEGER);
  const bytesPerSlot = integer(options.bytesPerSlot ?? 3 * GIB, "bytesPerSlot", 1, Number.MAX_SAFE_INTEGER);
  const pollIntervalMs = integer(options.pollIntervalMs ?? 100, "pollIntervalMs", 1, 10_000);
  const waitTimeoutMs = integer(options.waitTimeoutMs ?? 30 * 60_000, "waitTimeoutMs", pollIntervalMs, 24 * 60 * 60_000);
  if (!Number.isSafeInteger(reserveBytes + bytesPerSlot * capacity)) throw new Error("Machine cell slot memory configuration is unsafe");
  return { capacity, reserveBytes, bytesPerSlot, pollIntervalMs, waitTimeoutMs };
}

function integer(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Machine cell slot ${name} is invalid`);
  return value;
}

function safeRoot(value: string): string {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) throw new Error("Machine cell slot root must be an absolute path");
  const root = path.resolve(value);
  if (root === path.parse(root).root) throw new Error("Machine cell slot root cannot be a filesystem root");
  return root;
}

function inside(root: string, segment: string): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(segment)) throw new Error("Machine cell slot path segment is unsafe");
  const resolved = path.resolve(root, segment);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Machine cell slot path escaped its root");
  return resolved;
}

type LocatedOwner = Readonly<{ directory: string; owner: MachineCellSlotOwner }>;

async function readOwners(directory: string, label: string): Promise<LocatedOwner[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const owners: LocatedOwner[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_ID.test(entry.name)) throw new Error(`Machine cell slot ${label} directory is unsafe or unreadable`);
    const ownerDirectory = inside(directory, entry.name);
    try {
      const owner = await readStableOwner(ownerDirectory);
      if (owner) owners.push({ directory: ownerDirectory, owner });
    } catch (error) {
      throw new Error(`Machine cell slot ${label} owner is unreadable; refusing unsafe recovery`, { cause: error });
    }
  }
  return owners;
}

async function readSlots(directory: string, capacity: number): Promise<LocatedOwner[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const owners: LocatedOwner[] = [];
  for (const entry of entries) {
    const match = /^slot-(\d+)$/u.exec(entry.name);
    if (!entry.isDirectory() || !match || Number(match[1]) >= capacity) throw new Error("Machine cell slot directory is unsafe or unreadable");
    const ownerDirectory = inside(directory, entry.name);
    try {
      const owner = await readStableOwner(ownerDirectory);
      if (owner) owners.push({ directory: ownerDirectory, owner });
    } catch (error) {
      throw new Error("Machine cell slot owner is unreadable; refusing unsafe recovery", { cause: error });
    }
  }
  return owners;
}

async function readStableOwner(ownerDirectory: string): Promise<MachineCellSlotOwner | undefined> {
  const ownerFile = path.join(ownerDirectory, "owner.json");
  try {
    return parseOwner(JSON.parse(await readFile(ownerFile, "utf8")));
  } catch (firstError) {
    // A directory can disappear between readdir and readFile when its owner
    // releases or claims it. Re-read once: stable malformed data fails closed,
    // while an atomically vanished entry is ordinary contention.
    try {
      return parseOwner(JSON.parse(await readFile(ownerFile, "utf8")));
    } catch (secondError) {
      if (errorCode(secondError) === "ENOENT") return undefined;
      throw firstError;
    }
  }
}

async function recoverStaleEntries(ticketsDirectory: string, slotsDirectory: string, historyDirectory: string, capacity: number, liveness: CachedOwnerLiveness): Promise<void> {
  const entries = [...await readOwners(ticketsDirectory, "ticket"), ...await readSlots(slotsDirectory, capacity)];
  for (const entry of entries) {
    // Only the full identity probe inside `liveness` can report an owner not live.
    if (await liveness.isLive(entry.owner)) continue;
    const kind = path.basename(entry.directory).startsWith("slot-") ? "slot" : "ticket";
    const archived = inside(historyDirectory, `${kind}-${entry.owner.ticketId}`);
    try {
      await rename(entry.directory, archived);
    } catch (error) {
      if (errorCode(error) !== "ENOENT" && !CONTENTION_CODES.has(errorCode(error) ?? "")) throw error;
    }
  }
}

async function ownerIsLive(owner: Pick<MachineCellSlotOwner, "pid" | "bootIdentitySha256" | "processIdentitySha256">, probe: CampaignLeaseProcessProbe, bootIdentity: string): Promise<boolean> {
  if (owner.bootIdentitySha256 !== digest(bootIdentity)) return false;
  const processIdentity = await probe.processIdentity(owner.pid);
  return processIdentity !== null && owner.processIdentitySha256 === digest(processIdentity);
}

function slotHandle(slotDirectory: string, owner: MachineCellSlotOwner, slotIndex: number): MachineCellSlot {
  let released = false;
  const assertOwned = async () => {
    if (released) throw new Error("Machine cell slot has already been released");
    const current = parseOwner(JSON.parse(await readFile(path.join(slotDirectory, "owner.json"), "utf8")));
    if (current.ticketId !== owner.ticketId) throw new Error("Machine cell slot ownership was lost");
  };
  return Object.freeze({
    owner,
    slotIndex,
    assertOwned,
    release: async () => {
      if (released) return;
      await assertOwned();
      await removeDirectory(slotDirectory);
      released = true;
    },
  });
}

async function removeOwnedTicket(ticketDirectory: string, ticketId: string): Promise<void> {
  try {
    const owner = parseOwner(JSON.parse(await readFile(path.join(ticketDirectory, "owner.json"), "utf8")));
    if (owner.ticketId === ticketId) await removeDirectory(ticketDirectory);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

function parseOwner(value: unknown): MachineCellSlotOwner {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Machine cell slot owner must be an object");
  const object = value as Record<string, unknown>;
  const expected = ["bootIdentitySha256", "pid", "processIdentitySha256", "requestedAt", "schemaVersion", "ticketId"];
  const actual = Object.keys(object).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("Machine cell slot owner has unexpected or missing keys");
  if (object.schemaVersion !== SCHEMA_VERSION || typeof object.ticketId !== "string" || !SAFE_ID.test(object.ticketId)) throw new Error("Machine cell slot owner identity is invalid");
  if (!Number.isSafeInteger(object.pid) || (object.pid as number) < 1) throw new Error("Machine cell slot owner pid is invalid");
  for (const key of ["bootIdentitySha256", "processIdentitySha256"] as const) if (typeof object[key] !== "string" || !/^[a-f0-9]{64}$/u.test(object[key])) throw new Error(`Machine cell slot owner ${key} is invalid`);
  if (typeof object.requestedAt !== "string" || Number.isNaN(Date.parse(object.requestedAt))) throw new Error("Machine cell slot owner requestedAt is invalid");
  return object as MachineCellSlotOwner;
}

function compareOwners(left: LocatedOwner, right: LocatedOwner): number {
  return left.owner.requestedAt.localeCompare(right.owner.requestedAt) || left.owner.ticketId.localeCompare(right.owner.ticketId);
}

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function removeDirectory(directory: string): Promise<void> {
  return rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 10 });
}

function errorCode(error: unknown): string | undefined {
  try { return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined; }
  catch { return undefined; }
}
