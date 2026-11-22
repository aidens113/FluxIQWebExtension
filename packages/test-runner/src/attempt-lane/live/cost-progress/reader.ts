import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

type Stage = "decisions" | "repairs" | "judge" | "chat" | "other";
type Receipt = { kind: "settled"; stage: Stage; usd: number | null } | { kind: "pending" } | { kind: "unreadable" } | { kind: "other"; complete: boolean };
type Total = { calls: number; knownUsd: number; unknownCosts: number };
type Attempt = { ordinal: number; settled: Total; stages: Record<Stage, Total>; pendingCalls: number; unreadableRecords: number };

const total = (): Total => ({ calls: 0, knownUsd: 0, unknownCosts: 0 });
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

function stage(meta: Record<string, unknown>): Stage {
  if (meta.taskKind === "loop_verification" || meta.taskKind === "result_verification" || meta.kind === "judge") return "judge";
  if (meta.taskKind === "runtime_diagnosis" || meta.taskKind === "runtime_patch" || meta.phase === "repair") return "repairs";
  if (meta.taskKind === "evidence_tool_decision") return "decisions";
  if (meta.kind === "chat" || meta.phase === "chat") return "chat";
  return "other";
}

async function receipt(folder: string): Promise<Receipt> {
  let meta: Record<string, unknown> | undefined;
  try {
    meta = object(JSON.parse(await readFile(path.join(folder, "meta.json"), "utf8")));
    if (!meta) return { kind: "unreadable" };
  }
  catch (error) { if (!missing(error)) return { kind: "unreadable" }; }
  if (meta) {
    const complete = typeof meta.finishedAt === "string" && Number.isFinite(Date.parse(meta.finishedAt));
    if (meta.provider === undefined && meta.taskKind === undefined) {
      // Tool metadata has no model request. A contradictory pair stays unresolved.
      try {
        await access(path.join(folder, "request.json"));
        return { kind: "unreadable" };
      }
      catch (error) { return missing(error) ? { kind: "other", complete } : { kind: "unreadable" }; }
    }
    if (typeof meta.provider !== "string" || !meta.provider || typeof meta.taskKind !== "string" || !meta.taskKind || !complete) return { kind: "unreadable" };
    const usd = typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) && meta.costUsd >= 0 ? meta.costUsd : null;
    return { kind: "settled", stage: stage(meta), usd };
  }
  // Only existence is read: request bodies, summaries, URLs and page values never enter this observer.
  try {
    await access(path.join(folder, "request.json"));
    return { kind: "pending" };
  }
  catch (error) { return missing(error) ? { kind: "other", complete: false } : { kind: "unreadable" }; }
}

/** Observe Core's settled-call estimates; this is not the canonical purse or a source of budget decisions. */
export class AttemptCostProgress {
  private readonly owners = new Map<string, number>();
  private readonly completed = new Map<string, Receipt>();

  constructor(private readonly directory: string) {}

  async read(ordinal: number, includeEmpty = false): Promise<{ source: "available" | "unavailable"; attempts: Attempt[] }> {
    if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw new RangeError("Attempt ordinal must be a positive safe integer.");
    let folders: string[];
    try {
      folders = (await readdir(this.directory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d{4,}-/u.test(entry.name)).map((entry) => entry.name).sort();
    } catch { return { source: "unavailable", attempts: [] }; }
    const attempts = new Map<number, Attempt>();
    for (const folder of folders) {
      if (!this.owners.has(folder)) this.owners.set(folder, ordinal);
      const owner = this.owners.get(folder)!;
      const observed = this.completed.get(folder) ?? await receipt(path.join(this.directory, folder));
      // A completed model receipt is immutable; pending/partial metadata is retried, including late settlement.
      if (observed.kind === "settled" || (observed.kind === "other" && observed.complete)) this.completed.set(folder, observed);
      if (observed.kind === "other") continue;
      let attempt = attempts.get(owner);
      if (!attempt) {
        attempt = { ordinal: owner, settled: total(), stages: { decisions: total(), repairs: total(), judge: total(), chat: total(), other: total() }, pendingCalls: 0, unreadableRecords: 0 };
        attempts.set(owner, attempt);
      }
      if (observed.kind === "pending") attempt.pendingCalls += 1;
      else if (observed.kind === "unreadable") attempt.unreadableRecords += 1;
      else {
        for (const amount of [attempt.settled, attempt.stages[observed.stage]]) {
          amount.calls += 1;
          if (observed.usd === null) amount.unknownCosts += 1;
          else amount.knownUsd += observed.usd;
        }
      }
    }
    if (includeEmpty && !attempts.has(ordinal)) attempts.set(ordinal, { ordinal, settled: total(), stages: { decisions: total(), repairs: total(), judge: total(), chat: total(), other: total() }, pendingCalls: 0, unreadableRecords: 0 });
    return { source: "available", attempts: [...attempts.values()].sort((left, right) => left.ordinal - right.ordinal) };
  }
}
