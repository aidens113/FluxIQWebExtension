import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";

export type AuditEventType = "task.created" | "task.dispatched" | "response.received" | "candidate.compared" | "review.completed";

export type AuditRecord = {
  schemaVersion: "0.1";
  sequence: number;
  timestamp: string;
  event: AuditEventType;
  taskId: string;
  actor: string;
  payload: unknown;
  previousHash: string | null;
  hash: string;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || (typeof value === "number" && !Number.isFinite(value))) throw new TypeError("Audit payload must contain only finite JSON values");
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
}

function assertJsonValue(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object") throw new TypeError("Audit payload must contain only JSON values");
  if (seen.has(value)) throw new TypeError("Audit payload must not be circular");
  seen.add(value);
  if (Array.isArray(value)) for (const entry of value) assertJsonValue(entry, seen);
  else for (const entry of Object.values(value as Record<string, unknown>)) assertJsonValue(entry, seen);
}

function jsonSnapshot(value: unknown): unknown {
  assertJsonValue(value);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Audit payload must be JSON serializable");
  const snapshot: unknown = JSON.parse(serialized);
  canonicalize(snapshot);
  return snapshot;
}

function hashRecord(record: Omit<AuditRecord, "hash">): string {
  return createHash("sha256").update(canonicalize(record)).digest("hex");
}

export function verifyAuditRecords(records: readonly AuditRecord[]): boolean {
  let previousHash: string | null = null;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (record.sequence !== index + 1 || record.previousHash !== previousHash) return false;
    const { hash, ...unsigned } = record;
    if (hashRecord(unsigned) !== hash) return false;
    previousHash = hash;
  }
  return true;
}

export async function readAuditLog(filePath: string): Promise<AuditRecord[]> {
  try {
    const content = await readFile(filePath, "utf8");
    if (!content.trim()) return [];
    return content.trimEnd().split("\n").map((line) => JSON.parse(line) as AuditRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export class AppendOnlyAuditLog {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly now: () => Date = () => new Date()) {}

  append(input: { event: AuditEventType; taskId: string; actor: string; payload: unknown }): Promise<AuditRecord> {
    const operation = this.pending.then(() => this.appendOne(input));
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  private async appendOne(input: { event: AuditEventType; taskId: string; actor: string; payload: unknown }): Promise<AuditRecord> {
    const records = await readAuditLog(this.filePath);
    if (!verifyAuditRecords(records)) throw new Error("Refusing to append to an invalid audit chain");
    const unsigned: Omit<AuditRecord, "hash"> = {
      schemaVersion: "0.1",
      sequence: records.length + 1,
      timestamp: this.now().toISOString(),
      event: input.event,
      taskId: input.taskId,
      actor: input.actor,
      payload: jsonSnapshot(input.payload),
      previousHash: records.at(-1)?.hash ?? null,
    };
    const record: AuditRecord = { ...unsigned, hash: hashRecord(unsigned) };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const handle = await open(this.filePath, "a");
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return record;
  }
}
