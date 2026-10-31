import type { AutomationStudioLlmRerunDispatchAttempt } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { readWebHostFailure } from "../../../../host-failure";
import { present } from "../../../present";
import { webNodeFrozenJson } from "../json";
import { webNodeFrozenKey } from "../key";
import type { WebNodeFrozenCommand, WebNodeFrozenResult } from "../types";
import { webNodeFrozenLoweredParameters } from "./lowered";
import { webNodeObservedDispatch } from "./observe";

type Attempt = AutomationStudioLlmRerunDispatchAttempt & { command?: WebNodeFrozenCommand; parameters?: JsonObject };

/** Fresh main attempts only, correlated by command identity through actual final lowering. */
export function createWebNodeDispatchRecorder(input: { sessionId: string; actionType: string; referenceNow: number; parameters(): JsonObject }) {
  const attempts: Attempt[] = [];
  let proven = true;
  let eligible = true;
  return {
    async dispatch(command: WebNodeFrozenCommand, execute: () => Promise<WebNodeFrozenResult>): Promise<WebNodeFrozenResult> {
      const identity = Object.freeze({});
      let actual: WebNodeFrozenCommand | undefined;
      const parameters = webNodeFrozenJson(input.parameters());
      const expected = webNodeFrozenLoweredParameters(command.actionType, command.parameters, input.referenceNow);
      try {
        const result = await webNodeObservedDispatch(command, (sessionId, sent) => {
          if (actual !== undefined || sessionId !== input.sessionId || sent.actionType !== input.actionType || webNodeFrozenKey(sent.parameters) !== webNodeFrozenKey(expected)) proven = false;
          actual = webNodeFrozenJson(sent as unknown as JsonObject) as unknown as WebNodeFrozenCommand;
        }, execute);
        const failure = readWebHostFailure(result.failure);
        const outcome = failure?.effect === "ambiguous" ? "uncertain" : result.status === "succeeded" ? result.failure === undefined ? "succeeded" : "unknown" : failure?.effect === "unacted" ? "failed_unacted" : "unknown";
        attempts.push(present<Attempt>({ identity, receipt: result, outcome, command: actual, parameters }));
        if (actual === undefined) proven = false;
        if (!proven || outcome === "unknown" || outcome === "uncertain") eligible = false;
        return result;
      } catch (error) {
        attempts.push({ identity, outcome: "unknown" });
        if (actual === undefined) proven = false;
        eligible = false;
        throw error;
      }
    },
    snapshot() {
      const selected = attempts.at(-1);
      if (selected === undefined) return undefined;
      return {
        selected, proven, eligible,
        dispatch: { attempts: attempts.map(({ identity, receipt, outcome }) => present<AutomationStudioLlmRerunDispatchAttempt>({ identity, receipt, outcome })), selected: selected.identity }
      };
    }
  };
}
