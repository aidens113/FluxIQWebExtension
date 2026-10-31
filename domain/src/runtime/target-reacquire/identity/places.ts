import type { AutomationStudioHostStateSnapshotRef } from "fluxiq/automation-studio";
import type { WebTargetCaptureProvenance } from "./provenance";
import type { WebTargetScope } from "./scope";

type State = Pick<AutomationStudioHostStateSnapshotRef, "stateRef" | "stateSnapshotId">;
type Captured = { state: State; provenance: WebTargetCaptureProvenance };
type Correlation = State & { scoped?: { requested: string; captureKey: string } };

/** Private actual captures and their before-action attempt correlations; no page or target data is retained. */
export function createWebTargetPlaces(limit = 64) {
  const captures = new Map<string, Captured>();
  const attempts = new Map<string, Correlation>();
  const retain = (key: string, captured: Captured) => {
    captures.delete(key);
    captures.set(key, captured);
    while (captures.size > limit) captures.delete(captures.keys().next().value!);
  };
  const actual = (state: State) => {
    const capture = captures.get(state.stateRef);
    return capture?.state.stateSnapshotId === state.stateSnapshotId ? capture : undefined;
  };
  return {
    keep(state: State, provenance: WebTargetCaptureProvenance): void {
      retain(state.stateRef, { state: stateOnly(state), provenance: provenanceOnly(provenance) });
    },
    /** A reused ref grants only the provenance of that exact actual capture. */
    bind(attemptId: string, state: State): void {
      attempts.delete(attemptId);
      if (actual(state) === undefined) return;
      attempts.set(attemptId, stateOnly(state));
      while (attempts.size > limit) attempts.delete(attempts.keys().next().value!);
    },
    captured(state: State): WebTargetCaptureProvenance | undefined {
      return actual(state)?.provenance;
    },
    keepScoped(attemptId: string, state: State, requested: WebTargetScope, provenance: WebTargetCaptureProvenance): void {
      const bound = attempts.get(attemptId);
      if (actual(state) === undefined || bound?.stateRef !== state.stateRef || bound.stateSnapshotId !== state.stateSnapshotId) return;
      const captureKey = `${state.stateRef}\0${attemptId}`;
      retain(captureKey, { state: stateOnly(state), provenance: provenanceOnly(provenance) });
      bound.scoped = { requested: scopeKey(requested), captureKey };
    },
    of(previous: { attemptId: string; beforeAction?: AutomationStudioHostStateSnapshotRef }, requested: WebTargetScope): WebTargetCaptureProvenance | undefined {
      const state = previous.beforeAction;
      const bound = attempts.get(previous.attemptId);
      if (state === undefined || bound?.stateRef !== state.stateRef || bound.stateSnapshotId !== state.stateSnapshotId) return undefined;
      const captured = actual(state);
      if (captured === undefined) return undefined;
      if (bound.scoped?.requested === scopeKey(requested)) {
        const scoped = captures.get(bound.scoped.captureKey);
        return scoped?.state.stateRef === state.stateRef && scoped.state.stateSnapshotId === state.stateSnapshotId ? structuredClone(scoped.provenance) : undefined;
      }
      const top = captured.provenance;
      if ((requested.browserFrameId ?? 0) !== 0 || requested.browserFrameUrlPath !== undefined || top.scope.browserFrameId !== 0 || (requested.browserTabId !== undefined && requested.browserTabId !== top.scope.browserTabId)) return undefined;
      return structuredClone(top);
    }
  };
}

function provenanceOnly(provenance: WebTargetCaptureProvenance): WebTargetCaptureProvenance {
  return { scope: structuredClone(provenance.scope), coverage: provenance.coverage, includesHidden: provenance.includesHidden };
}

function stateOnly(state: State): State {
  return { stateRef: state.stateRef, stateSnapshotId: state.stateSnapshotId };
}

function scopeKey(scope: WebTargetScope): string {
  return `${scope.browserTabId ?? ""}\0${scope.browserFrameId ?? ""}\0${scope.browserFrameUrlPath ?? ""}`;
}
