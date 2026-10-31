import type { WebAutomationHostRuntimeBoundary } from "../host-runtime";
import type { WebLlmSnapshotBinding } from "../llm-evidence";
import { webLlmStateDigest } from "../llm-evidence/state-digest";
import { webRuntimeRepeatCapture } from "./capture";
import { webRuntimeRepeatTarget } from "./target";

type Input = Parameters<NonNullable<WebAutomationHostRuntimeBoundary["observeRuntimeRepeat"]>>[0];
type Observation = Awaited<ReturnType<NonNullable<WebAutomationHostRuntimeBoundary["observeRuntimeRepeat"]>>>;
type State = Input["stateRef"];
type Capture = ReturnType<typeof webRuntimeRepeatCapture>;
let hostOrdinal = 0;

/** Private accepted captures and collision-free interned equality tokens, all bounded. */
export function createWebRuntimeRepeatMemo() {
  const namespace = ++hostOrdinal;
  const captures = new Map<string, { id: string; at: number; capture: Capture; digest?: string }>();
  const tokens = new Map<string, string>();
  let ordinal = 0;
  function token(identity: string): string {
    const existing = tokens.get(identity);
    if (existing !== undefined) return existing;
    const value = `web-repeat.${namespace}.${++ordinal}`;
    tokens.set(identity, value);
    if (tokens.size > 256) tokens.delete(tokens.keys().next().value!);
    return value;
  }
  return {
    keep(state: State, snapshot: unknown, page: WebLlmSnapshotBinding, sessionId: unknown, sourceId: unknown, succeeded: boolean) {
      try {
        const capture = succeeded ? webRuntimeRepeatCapture(snapshot, page, sessionId, sourceId) : undefined;
        captures.set(state.stateRef, { id: state.stateSnapshotId, at: state.capturedAt, capture, ...(capture === undefined ? {} : { digest: webLlmStateDigest(page.evidence) }) });
        if (captures.size > 32) captures.delete(captures.keys().next().value!);
      } catch {
        // Ordinary state summaries remain available when private proof cannot be read.
        captures.delete(state.stateRef);
      }
    },
    observe(input: Input): Observation {
      try {
        if (input.signal?.aborted) return { kind: "unavailable", reason: "unreadable" };
        const state = input.stateRef;
        if ((input.point !== "before_action" && input.point !== "after_action") || typeof state.stateRef !== "string" || typeof state.stateSnapshotId !== "string" || !Number.isFinite(state.capturedAt)) return { kind: "unavailable", reason: "missing" };
        const saved = captures.get(state.stateRef);
        if (saved === undefined || saved.id !== state.stateSnapshotId || saved.at !== state.capturedAt) return { kind: "unavailable", reason: "missing" };
        if (saved.capture === undefined || saved.digest === undefined) return { kind: "unavailable", reason: "partial" };
        const target = webRuntimeRepeatTarget(input.node, saved.capture);
        if (target === undefined) return { kind: "unavailable", reason: "unsupported" };
        // Native row binding rewrites the subject from item at dispatch. Until
        // that transformed binding is observed here, the original is no proof.
        if (target.kind === "identified" && input.inputs.item !== undefined) return { kind: "unavailable", reason: "unsupported" };
        const { scope } = saved.capture;
        const resource = token(JSON.stringify(["resource", scope.sessionId, scope.browserTabId, scope.browserFrameId, scope.location, scope.timeOrigin]));
        return { kind: "observed", coverage: "complete", resource, target: target.kind === "none" ? target : { kind: "identified", key: token(`target:${target.identity}`) }, viewDigest: saved.digest };
      } catch {
        return { kind: "unavailable", reason: "unreadable" };
      }
    }
  };
}
