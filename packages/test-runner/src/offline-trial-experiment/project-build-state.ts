// A project build's stored record and its Flow's candidate draft, read from a
// copied workspace's `global.sqlite` (`automation.state`), read-only.
//
// Core exports no reader for either record, so the two rows are read by id and
// parsed, and nothing is written. The table also holds identity and secret
// rows; only `automation.state` is ever queried, and only these two ids. Point
// it at a copy (`test-runs/`), never at a live workspace's database.

import { DatabaseSync } from "node:sqlite";
import { RunnerFailure } from "../failure.js";
import { jsonRecord } from "./json-record.js";

export type ProjectBuildState = Readonly<{
  /** The build's record (`project-builds/<buildId>/build`): task spec, structure plan, briefs. */
  record: Record<string, unknown>;
  /** The Flow's latest candidate (`candidate-draft`), or null when the Flow keeps none. */
  draft: Record<string, unknown> | null;
}>;

export function readProjectBuildState(input: { globalDatabase: string; projectId: string; flowId: string; buildId: string }): ProjectBuildState {
  const base = `projects/${input.projectId}/flows/${input.flowId}/`;
  const db = new DatabaseSync(input.globalDatabase, { readOnly: true });
  try {
    const read = (id: string): Record<string, unknown> | undefined => {
      const row = db.prepare(`select data from "automation.state" where id = ?`).get(base + id) as { data?: unknown } | undefined;
      if (row === undefined) return undefined;
      const text = typeof row.data === "string" ? row.data : row.data instanceof Uint8Array ? Buffer.from(row.data).toString("utf8") : undefined;
      if (text === undefined) throw new RunnerFailure("environment.missing", `The stored state ${id} holds no JSON text`);
      return jsonRecord(JSON.parse(text));
    };
    const record = read(`project-builds/${input.buildId}/build`);
    if (!record) throw new RunnerFailure("environment.missing", `The store holds no record of build ${input.buildId}`);
    return Object.freeze({ record, draft: read("candidate-draft") ?? null });
  } finally {
    db.close();
  }
}
