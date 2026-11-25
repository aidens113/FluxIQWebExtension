import path from "node:path";
import { listFolder } from "./list-folder.js";
import { readJsonFile } from "./read-json-file.js";

/** What a read recorded: how many rows, and the first row. */
export type NodeRead = { recordCount: number | null; firstRow: Record<string, unknown> | null };

type NodeResult = { read?: { firstRows?: Record<string, unknown>[]; extraction?: { recordCount?: number } } };

/** The recorded results of the named calls (by call id), read from the tool steps' `call.json` and `result.json`. Reads only. */
export async function readNodeResults(stepsDirectory: string, callIds: ReadonlySet<string>): Promise<Map<string, NodeRead>> {
  const found = new Map<string, NodeRead>();
  if (callIds.size === 0) return found;
  for (const folder of (await listFolder(stepsDirectory)).filter((name) => /^\d+-tool-/u.test(name)).sort()) {
    const call = await readJsonFile<{ callId?: string }>(path.join(stepsDirectory, folder, "call.json"));
    if (call?.callId === undefined || !callIds.has(call.callId)) continue;
    const result = await readJsonFile<NodeResult>(path.join(stepsDirectory, folder, "result.json"));
    if (result?.read === undefined) continue;
    found.set(call.callId, { recordCount: result.read.extraction?.recordCount ?? null, firstRow: result.read.firstRows?.[0] ?? null });
  }
  return found;
}
