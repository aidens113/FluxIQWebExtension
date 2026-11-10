// Where one node run's time goes (task speed S0), as spans of its step.
//
// A browser step measured about 3 s of which 0.4 s was the page action
// (`docs/working/mvp-seal-plan/reports/time-breakdown.md`, section 2), and
// nothing said where the rest went. Each run now times its parts and Core's
// step log writes them into the step's `meta.json` (Core
// `runtime/llm/step-log/span.ts`); with no step open, recording does nothing.
//
// The names are closed words, never page text:
// - `look.before`, `look.after`, `look` -- a whole look, from the request to
//   the sanitized packet; `press.settle` -- a press that changed nothing,
//   looked at again (`../press-effect/settled.ts`);
// - `prepare` -- from the look before to the command going out (resolution,
//   the permission gate, a target found again); `permission` inside it;
// - `act` -- the command with Core's retries (`../retries/dispatch.ts`);
// - `send.<action>` -- one command, from sent to answered, through Core's
//   gateway and the extension; `page.<action>` -- the part of it the page's
//   content script spent, by the extension's own clock (`startedAt` and
//   `finishedAt` of its result, the same machine's clock);
// - `sanitize` -- from a look's answer to its packet, detail the look's name;
// - `compose` -- from the page the act left to the result (diff and outcome).
//
// So a step's overhead is its time less `page.<action>` of its act, and each
// part of that overhead has a span.

import { automationStudioLlmStepLogSpans } from "fluxiq/automation";
import type { WebLlmEvidenceGateway } from "../../capture";

/** One node run's clock: its gateway, timed, and its parts. */
export type WebNodeTiming = {
  /** The run's gateway, every command of it timed as `send.<action>` and `page.<action>`. */
  gateway: WebLlmEvidenceGateway;
  /** `work` as a look named `name`, with the time from its last answer to its packet as `sanitize`. */
  look<T>(name: string, work: () => Promise<T>): Promise<T>;
  /** `work` as the span `name`. */
  phase<T>(name: string, work: () => Promise<T>): Promise<T>;
  /** A span already measured. */
  record(name: string, startedAt: number, finishedAt: number, detail?: string): void;
};

/** A run's clock around `gateway`. */
export function webNodeTiming(gateway: WebLlmEvidenceGateway): WebNodeTiming {
  let answeredAt: number | undefined;
  const record = (name: string, startedAt: number, finishedAt: number, detail?: string) => automationStudioLlmStepLogSpans.record(name, startedAt, finishedAt, detail);
  const timed: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => gateway.eligibleSessionIds(),
    executeAction: async (sessionId, command) => {
      const sentAt = Date.now();
      const result = await gateway.executeAction(sessionId, command);
      answeredAt = Date.now();
      const action = actionWord(command.actionType);
      record(`send.${action}`, sentAt, answeredAt, typeof result.status === "string" ? result.status : undefined);
      const page = pageClock(result.payload);
      if (page) record(`page.${action}`, page.startedAt, page.finishedAt);
      return result;
    }
  };
  if (gateway.structureDetectionSessionIds) timed.structureDetectionSessionIds = () => gateway.structureDetectionSessionIds!();
  const phase = async <T>(name: string, work: () => Promise<T>, after?: (startedAt: number, finishedAt: number) => void): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      const finishedAt = Date.now();
      record(name, startedAt, finishedAt);
      after?.(startedAt, finishedAt);
    }
  };
  return {
    gateway: timed,
    record,
    phase: (name, work) => phase(name, work),
    look: (name, work) => {
      answeredAt = undefined;
      return phase(name, work, (startedAt, finishedAt) => {
        if (answeredAt !== undefined && answeredAt >= startedAt) record("sanitize", answeredAt, finishedAt, name);
      });
    }
  };
}

/** `web.dom.capture_snapshot` as `capture_snapshot`: the last segment of the action type, which is all a span name needs. */
function actionWord(actionType: string): string {
  const word = actionType.split(".").at(-1);
  return word === undefined || word === "" ? "action" : word;
}

/** The page's own start and end of the command, when its result carried both as numbers. */
function pageClock(payload: unknown): { startedAt: number; finishedAt: number } | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const { startedAt, finishedAt } = payload as { startedAt?: unknown; finishedAt?: unknown };
  return typeof startedAt === "number" && typeof finishedAt === "number" && finishedAt >= startedAt ? { startedAt, finishedAt } : undefined;
}
