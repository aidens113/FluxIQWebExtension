import { isJsonRecord, isWithheldText, type WebLlmSnapshotBinding } from "../llm-evidence";
import { webCapturedTargetObservation, type WebTargetObservation } from "../target-reacquire/identity";
import { webRuntimeRepeatElementKnown } from "./element-known";

/** Positive shown-state coverage, independent of the capture's hidden-element option. */
export function webRuntimeRepeatCapture(snapshot: unknown, page: WebLlmSnapshotBinding, sessionId: unknown, sourceId: unknown): WebTargetObservation | undefined {
  if (!isJsonRecord(snapshot)) return undefined;
  if (snapshot.title !== undefined && typeof snapshot.title !== "string") return undefined;
  const captured = webCapturedTargetObservation({ snapshot, page, sessionId, sourceId, requested: { kind: "merged", browserFrameId: 0 } });
  if (captured.kind !== "observed") return undefined;
  const observation = captured.observation;
  const scope = observation.scope;
  const evidence = isJsonRecord(snapshot.evidence) ? snapshot.evidence : undefined;
  const totals = isJsonRecord(evidence?.elements) ? evidence.elements : undefined;
  const loading = isJsonRecord(evidence?.loading) ? evidence.loading : undefined;
  const frame = isJsonRecord(snapshot.frame) ? snapshot.frame : undefined;
  const coverage = isJsonRecord(evidence?.frameCoverage) ? evidence.frameCoverage : undefined;
  const raw = snapshot.interactiveElements;
  const unanswered = evidence?.unansweredFrameIds;
  // The merged wire carries only top-document navigation. Child documents
  // cannot be relabelled as that document, even when their content is equal.
  // Only actual complete frame enumeration and replies can prove top-only;
  // missing normalized child IDs or requested options cannot establish this.
  if (coverage?.mode !== "all_frames" || coverage.enumeration !== "complete"
    || !Array.isArray(coverage.frameIds) || coverage.frameIds.length !== 1 || coverage.frameIds[0] !== 0
    || !Array.isArray(coverage.capturedFrameIds) || coverage.capturedFrameIds.length !== 1 || coverage.capturedFrameIds[0] !== 0) return undefined;
  if (scope.browserFrameId !== 0 || scope.location === undefined || scope.timeOrigin === undefined || frame?.isTop !== true
    || page.evidence.frame?.childFrameIds?.length || page.evidence.elements.some((element) => element.frameId !== undefined && element.frameId !== 0)
    || (unanswered !== undefined && (!Array.isArray(unanswered) || unanswered.length !== 0))) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const shown = raw.filter((element) => !isJsonRecord(element) || element.hidden !== true);
  if (shown.some((element) => !webRuntimeRepeatElementKnown(element))) return undefined;
  const shownEvidence = page.evidence.elements.filter((element) => element.hidden !== true);
  if (![totals?.scanned, totals?.candidates, totals?.matched, totals?.returned].every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) return undefined;
  // The native producer feeds shown entries to pageEvidence even when the
  // descriptor list also includes hidden entries. Its funnel counts shown state.
  if (totals?.returned !== shown.length || totals.matched !== totals.returned || typeof totals.candidates !== "number" || totals.candidates < shown.length
    || typeof totals.scanned !== "number" || totals.scanned < totals.candidates || totals.truncated !== false
    || (snapshot.truncated !== undefined && snapshot.truncated !== false)
    || loading?.documentState !== "complete" || loading.busy !== false || loading.pendingNavigation !== false
    || page.evidence.truncated !== false || page.evidence.captureTruncated === true
    || shownEvidence.length !== shown.length || containsWithheld({ ...page.evidence, elements: shownEvidence })) return undefined;
  return observation;
}

function containsWithheld(value: unknown): boolean {
  if (typeof value === "string") return isWithheldText(value) || value.includes("(withheld)");
  if (Array.isArray(value)) return value.some(containsWithheld);
  return isJsonRecord(value) && Object.values(value).some(containsWithheld);
}
