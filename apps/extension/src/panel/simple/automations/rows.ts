// Parser 1: `listAutomations`' flows and runs, joined into the rows the card
// shows -- each flow with its newest run, the most recently active first, at
// most five.

import type { AutomationRow, RunSummary } from "./types";
import { readCore } from "./read-core";

const ROW_LIMIT = 5;

/** Joins Core's `{ flows, runs }` into at most five rows, newest first. Anything unreadable is skipped. */
export function automationRows(payload: unknown): AutomationRow[] {
  const record = readCore.record(payload);
  const flows = Array.isArray(record?.flows) ? record.flows : [];
  const runs = Array.isArray(record?.runs) ? record.runs : [];

  const newest = new Map<string, RunSummary>();
  for (const raw of runs) {
    const run = readCore.run(raw);
    if (run === undefined) continue;
    const held = newest.get(run.flowId);
    if (held === undefined || (run.updatedAt ?? -Infinity) > (held.updatedAt ?? -Infinity)) newest.set(run.flowId, run);
  }

  const rows: { row: AutomationRow; at: number }[] = [];
  const seen = new Set<string>();
  for (const raw of flows) {
    const flow = readCore.record(raw);
    const flowId = readCore.text(flow?.flowId);
    if (flowId === undefined || seen.has(flowId)) continue;
    seen.add(flowId);
    const lastRun = newest.get(flowId);
    const name = readCore.text(flow?.name)?.trim() ?? "Untitled automation";
    const at = Math.max(lastRun?.updatedAt ?? -Infinity, readCore.time(flow?.updatedAt) ?? -Infinity);
    rows.push({ row: lastRun === undefined ? { flowId, name } : { flowId, name, lastRun }, at });
  }
  return rows.sort((a, b) => (a.at === b.at ? 0 : b.at > a.at ? 1 : -1)).slice(0, ROW_LIMIT).map((entry) => entry.row);
}
