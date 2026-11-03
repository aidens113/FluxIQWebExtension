import type { PersistedFlowRunControl } from "../../persisted-flow-run.js";
import { attempt } from "./attempt.js";

export function control(overrides: Partial<Record<string, unknown>> = {}, detail: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const client = {
    selectExistingContext: async () => { calls.push("select"); },
    startPersistedFlow: async () => {
      calls.push("start");
      return { runId: "run.one" };
    },
    runPersistedFlow: async () => {
      calls.push("run");
      return { session: { runId: "run.one", status: "succeeded" } };
    },
    automationStudioCall: async (endpoint: string) => {
      calls.push(endpoint);
      return { runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [attempt()], interventions: [], ...detail } };
    },
    ...overrides,
  } as unknown as PersistedFlowRunControl;
  return { client, calls };
}
