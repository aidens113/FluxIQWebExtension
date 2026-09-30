// Turns the `[FluxIQ build-trace]` lines of a real Core log into the activity
// events Core's observer emits at the same seams, with the same timestamps.
// The mapping is Core's own, read from
// `packages/fluxiq/src/programs/automation-studio/runtime/activity/observer.ts`
// and `build.ts`:
//
//   loop start                 -> building "Building the Flow" (build.ts, the scope's opening event)
//   decide start               -> thinking "Deciding the next step"
//   decide end                 -> nothing
//   tool start toolId=X        -> exploring "Using X" (building "Amending the draft Flow" for core.flow_draft)
//   tool end toolId=X code=R   -> exploring "Using X: R"
//   completion check ok=B      -> verifying "Checking the proposed result", then
//                                 "The proposed result passed its check" or "... was refused"
//                                 (the trace logs the check once, when it ends, so both are stamped then)
//
// and one event after the last line: done "Build finished: a Flow is proposed",
// final, which build.ts emits when the build returns.

import type { ClientGatewayActivity } from "../../../shared/activity/index";

export type TimedActivity = { at: number; event: ClientGatewayActivity };

const DRAFT_TOOL_ID = "core.flow_draft";
const LINE = /^\[FluxIQ build-trace\] (\S+) (.*)$/u;

export function buildTraceEvents(lines: readonly string[]): TimedActivity[] {
  const events: TimedActivity[] = [];
  let sequence = 0;
  const emit = (at: number, fields: Pick<ClientGatewayActivity, "phase" | "label"> & Partial<ClientGatewayActivity>) => {
    sequence += 1;
    events.push({
      at,
      event: {
        activityId: "build:t174-replay",
        sequence,
        subject: { kind: "build", id: "t174-replay", projectId: "replay" },
        at: new Date(at).toISOString(),
        ...fields
      }
    });
  };
  let last = 0;
  for (const line of lines) {
    const match = LINE.exec(line);
    if (!match) throw new Error(`not a build-trace line: ${line}`);
    const at = Date.parse(match[1]!);
    const rest = match[2]!;
    last = at;
    const toolId = /toolId=(\S+)/u.exec(rest)?.[1];
    if (rest.startsWith("loop start")) {
      emit(at, { phase: "building", label: "Building the Flow", detail: { kind: "step", title: "Build started", status: "started" } });
    } else if (rest.startsWith("decide start")) {
      emit(at, { phase: "thinking", label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } });
    } else if (rest.startsWith("decide end")) {
      continue;
    } else if (rest.startsWith("tool start") && toolId) {
      const title = toolId === DRAFT_TOOL_ID ? "Amending the draft Flow" : `Using ${toolId}`;
      emit(at, { phase: toolId === DRAFT_TOOL_ID ? "building" : "exploring", label: title, detail: { kind: "tool", title, status: "started", ref: toolId } });
    } else if (rest.startsWith("tool end") && toolId) {
      const title = toolId === DRAFT_TOOL_ID ? "Amending the draft Flow" : `Using ${toolId}`;
      const code = /resultCode=(\S+)/u.exec(rest)?.[1];
      emit(at, { phase: toolId === DRAFT_TOOL_ID ? "building" : "exploring", label: `${title}: ${code ?? "done"}`, detail: { kind: "tool", title, status: "succeeded", ref: toolId, ...(code ? { text: `Result: ${code}` } : {}) } });
    } else if (rest.startsWith("completion check")) {
      const ok = /ok=true/u.test(rest);
      emit(at, { phase: "verifying", label: "Checking the proposed result", detail: { kind: "check", title: "Completion check", status: "started" } });
      emit(at, { phase: "verifying", label: ok ? "The proposed result passed its check" : "The proposed result was refused", detail: { kind: "check", title: "Completion check", status: ok ? "succeeded" : "failed" } });
    } else {
      throw new Error(`unmapped build-trace line: ${line}`);
    }
  }
  emit(last, { phase: "done", label: "Build finished: a Flow is proposed", detail: { kind: "step", title: "Build finished", status: "succeeded" }, final: true });
  return events;
}
