// The one funnel every recorded event passes through, whatever produced it: a
// content script, a browser navigation, a runtime action, or a recording
// starting. It applies the pointer-click de-duplication, decides whether an
// event is an executable action or passive evidence, and sends each to the
// gateway with the snapshot captured beside it.
//
// Navigation lives here too, because a committed navigation is only ever
// interesting as the recorded event it becomes: `NavigationRecorder` holds the
// policy, and these methods are what turn its verdict into an event.

import type { ActivityEntry, RecordingEventPayload } from "../../shared/protocol";
import type { ActivePage } from "./active-page";
import type { ActiveRecording } from "./active-recording";
import { unsupportedPageForUrl } from "./browser-state";
import type { ContentAttachment } from "./content-attachment";
import { isDomSnapshotPayload } from "./dom-snapshot";
import type { EventSequence } from "./event-sequence";
import { gatewayRecordingEventFromPayload } from "./gateway-payloads";
import type { GatewayMessageSender } from "./gateway-session";
import type { NavigationOrigin, NavigationRecorder } from "./navigation-recorder";
import type { PointerClickFilter } from "./pointer-click-filter";
import {
  activityDetail,
  activityLabel,
  clickEventSignature,
  isExecutableRecordedAction,
  isNavigationExplanation
} from "./recorded-event";
import type { RecordingEvidenceReporter } from "./recording-evidence";
import { objectValue, stringValue } from "./value-readers";

export type RecordedEventIntakeDeps = {
  readonly send: GatewayMessageSender;
  readonly recording: ActiveRecording;
  readonly page: ActivePage;
  readonly navigation: NavigationRecorder;
  readonly clicks: PointerClickFilter;
  readonly sequence: EventSequence;
  readonly evidence: RecordingEvidenceReporter;
  readonly attachment: ContentAttachment;
  readonly sendToTab: <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  // Re-entry through the facade, so an event this module derives from another
  // one still takes the public intake path rather than short-cutting to itself.
  readonly recordEvent: (payload: RecordingEventPayload, tabId?: number, frameId?: number) => Promise<void>;
};

// The transition a click's landing is recorded under. It maps to no input, so
// it is never executable (`domain/src/io/input-model.ts`).
const EXPLAINED_TRANSITION = "explained";

function isExplainedNavigation(payload: RecordingEventPayload): boolean {
  return payload.kind === "browser.navigation" && payload.metadata?.transition === EXPLAINED_TRANSITION;
}

// Where a click landed, as origin and path. A query string or fragment is where
// a session token, an invitation code or a one-time link rides, and neither
// says which page was reached; the domain's evidence location draws the same
// line (`domain/src/runtime/llm-evidence/location.ts`).
function landingLocation(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.origin === "null" ? undefined : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

export class RecordedEventIntake {
  constructor(private readonly deps: RecordedEventIntakeDeps) {}

  async accept(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.deps.recording.state() !== "recording") return;
    if (payload.kind === "dom.click") {
      const sourceEvent = stringValue(objectValue(payload.metadata)?.sourceEvent);
      const signature = clickEventSignature(payload, tabId, frameId);
      if (sourceEvent === "pointerdown" && signature) {
        if (this.deps.clicks.isSuppressed(signature)) return;
        this.deps.clicks.suppressNext(signature);
        await this.processEvent(payload, tabId, frameId);
        return;
      }
      if (sourceEvent === "click" && signature && this.deps.clicks.isSuppressed(signature)) {
        return;
      }
    }
    await this.processEvent(payload, tabId, frameId);
  }

  async acceptContentReady(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    let readyPayload = payload;
    if (this.deps.recording.state() === "recording" && tabId !== undefined && !this.deps.page.unsupported()) {
      await this.deps.attachment.setRecordingState(tabId, true, frameId).catch(() => undefined);
      if (!payload.snapshot) {
        const snapshot = await this.deps.sendToTab(tabId, { type: "captureSnapshot" }, frameId)
          .then((value) => isDomSnapshotPayload(value) ? value : undefined)
          .catch(() => undefined);
        if (snapshot) readyPayload = { ...payload, snapshot };
      }
    }
    await this.deps.recordEvent(readyPayload, tabId, frameId);
  }

  noteNavigationCommitted(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    // Browser-provided transition metadata is more reliable than tabs.onUpdated,
    // which fires repeatedly for a single load (URL, title, and status changes).
    // Only the top frame's document is the tab's page, and a reload revisits a
    // page rather than reaching one.
    if (details.frameId !== 0 || details.transitionType === "reload") return;
    const origin: NavigationOrigin = details.transitionType === "link" || details.transitionType === "form_submit"
      ? "page"
      : details.transitionType === "typed" ? "typed" : "other";
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, origin);
  }

  noteHistoryStateUpdated(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, "other");
  }

  private scheduleNavigation(tabId: number, url: string, timestamp: number, origin: NavigationOrigin): void {
    if (this.deps.recording.state() !== "recording" || unsupportedPageForUrl(url)) return;
    this.deps.navigation.schedule(tabId, url, () => void this.recordNavigation(tabId, url, timestamp, origin));
  }

  private async recordNavigation(tabId: number, url: string, timestamp: number, origin: NavigationOrigin): Promise<void> {
    if (this.deps.recording.state() !== "recording") return;
    const verdict = this.deps.navigation.shouldRecord(tabId, url, timestamp, origin, this.deps.recording.startedAt());
    if (verdict.kind === "drop") return;
    if (verdict.kind === "explained") {
      const location = landingLocation(url);
      if (location === undefined) return;
      await this.deps.recordEvent({
        kind: "browser.navigation",
        sequence: this.deps.sequence.next(),
        url: location,
        title: "",
        eventTimestampMs: timestamp,
        metadata: { transition: EXPLAINED_TRANSITION, explainedBy: verdict.explainedBy }
      }, tabId);
      return;
    }
    await this.deps.recordEvent({
      kind: "browser.navigation",
      sequence: this.deps.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: origin === "typed" ? { transition: "typed" } : undefined
    }, tabId);
  }

  private async processEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.deps.recording.state() !== "recording") return;
    const executable = isExecutableRecordedAction(payload);
    if (tabId !== undefined && isNavigationExplanation(payload)) {
      this.deps.navigation.noteExplanatoryAction(tabId, payload.eventTimestampMs, payload.kind === "dom.submit"
        ? { kind: "submit" }
        : { kind: "click", sequence: executable ? payload.sequence : undefined });
    }
    if (executable) {
      this.deps.recording.noteEvent();
      this.deps.onActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      // The content script sees only its own frame, so the snapshot it attaches
      // describes one document however many the page has. The event goes out
      // with the merged tab snapshot the state beside it is projected from --
      // one page, one instant -- and that merge runs once, here, rather than a
      // second time inside the reporter. A single-frame page is unaffected.
      const captured = await this.deps.evidence.captureEventSnapshot(payload, tabId, frameId);
      const recorded = captured.snapshot === undefined ? payload : { ...payload, snapshot: captured.snapshot };
      await this.deps.send("client.recording_event", gatewayRecordingEventFromPayload(recorded, tabId, frameId, this.deps.recording.recordingId()));
      await this.deps.evidence.sendRecordingEvidence(payload, tabId, frameId, captured);
      return;
    }
    if (payload.kind !== "content.ready") {
      this.deps.onActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    // A click's landing is not executable, but Core's recording mapper reads it
    // from the timeline beside the click it names, so it crosses as a recording
    // event as well as evidence. It carries no input id, so nothing runs it.
    if (isExplainedNavigation(payload)) {
      await this.deps.send("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.deps.recording.recordingId()));
    }
    await this.deps.evidence.sendRecordingEvidence(payload, tabId, frameId);
  }
}
