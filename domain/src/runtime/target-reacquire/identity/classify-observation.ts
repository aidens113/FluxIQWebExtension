import { pageEvidenceWire, type WebAutomationLoadingEvidence, type WebAutomationNavigationEvidence, type WebAutomationPageEvidence, type WebAutomationSnapshotElementTotals } from "../../../page-evidence";
import type { WebLlmSnapshotBinding } from "../../llm-evidence";
import { isJsonRecord } from "../../llm-evidence/untrusted-json";
import { isWithheldText, screenedPageText } from "../../llm-evidence/withheld";
import type { WebTargetObservation } from "./observation";
import type { WebTargetScope } from "./scope";

/** Classify positive raw capture evidence; neither request options nor omitted public flags grant completeness. */
export function webTargetObservation(input: { snapshot: unknown; page: WebLlmSnapshotBinding; scope: WebTargetScope; samePlace: "yes" | "no" | "unknown" }): WebTargetObservation {
  const snapshot = isJsonRecord(input.snapshot) ? input.snapshot : undefined;
  const evidence = pageEvidenceWire<WebAutomationPageEvidence>(snapshot?.evidence);
  const capture = pageEvidenceWire<NonNullable<WebAutomationPageEvidence["captureOptions"]>>(evidence?.captureOptions);
  const totals = pageEvidenceWire<WebAutomationSnapshotElementTotals>(evidence?.elements);
  const loading = pageEvidenceWire<WebAutomationLoadingEvidence>(evidence?.loading);
  const navigation = pageEvidenceWire<WebAutomationNavigationEvidence>(evidence?.navigation);
  const frame = isJsonRecord(snapshot?.frame) ? snapshot.frame : undefined;
  const includesHidden = capture?.includeHidden === true;
  const unanswered = evidence?.unansweredFrameIds;
  const elements = snapshot?.interactiveElements;
  const explicitPartial = totals?.truncated === true || snapshot?.truncated === true || loading?.busy === true
    || loading?.pendingNavigation === true || (typeof loading?.documentState === "string" && loading.documentState !== "complete")
    || (Array.isArray(unanswered) && unanswered.length > 0);
  const scope = input.scope;
  const frameKnown = Number.isSafeInteger(scope.browserFrameId) && (scope.browserFrameId ?? -1) >= 0
    && frame?.isTop === (scope.browserFrameId === 0);
  const documentKnown = typeof snapshot?.url === "string" && scope.location === snapshot.url
    && typeof navigation?.timeOrigin === "number" && Number.isFinite(navigation.timeOrigin) && scope.timeOrigin === navigation.timeOrigin;
  const elementsKnown = Array.isArray(elements) && elements.every(knownElement);
  const countsKnown = [totals?.scanned, totals?.candidates, totals?.matched, totals?.returned]
    .every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0);
  const consistentCounts = countsKnown && Array.isArray(elements) && typeof totals?.returned === "number"
    && totals.returned <= elements.length && totals.returned === totals.matched
    && typeof totals.candidates === "number" && totals.candidates >= totals.returned
    && typeof totals.scanned === "number" && totals.scanned >= totals.candidates;
  const complete = scope.kind === "single-frame" && frameKnown && documentKnown && elementsKnown && includesHidden
    && consistentCounts
    && totals?.truncated === false && (snapshot?.truncated === undefined || snapshot.truncated === false)
    && loading?.documentState === "complete" && loading.busy === false && loading.pendingNavigation === false
    && (unanswered === undefined || (Array.isArray(unanswered) && unanswered.length === 0))
    && input.page.evidence.truncated === false;
  return {
    page: input.page,
    scope: structuredClone(scope),
    includesHidden,
    coverage: explicitPartial ? "partial" : complete ? "complete" : "unknown",
    samePlace: input.samePlace === "yes" && (!frameKnown || !documentKnown) ? "unknown" : input.samePlace
  };
}

/** A malformed or withheld root claim cannot establish that every candidate is in the intended root. */
function knownElement(element: unknown): boolean {
  if (!isJsonRecord(element) || typeof element.tagName !== "string" || element.tagName.trim() === ""
    || typeof element.selector !== "string" || element.selector.trim() === "") return false;
  if (element.context === undefined) return true;
  if (!isJsonRecord(element.context)) return false;
  const context = element.context;
  if (context.shadowHosts !== undefined && (!Array.isArray(context.shadowHosts)
    || context.shadowHosts.some((host) => typeof host !== "string" || host.trim() === ""))) return false;
  if (context.dialog !== undefined) {
    const dialog = screenedPageText(context.dialog);
    if (dialog === undefined || isWithheldText(dialog)) return false;
  }
  return true;
}
