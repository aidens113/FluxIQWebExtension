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
import type { NavigationRecorder } from "./navigation-recorder";
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
    if (details.transitionType === "link" || details.transitionType === "form_submit" || details.transitionType === "reload") return;
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, details.transitionType === "typed");
  }

  noteHistoryStateUpdated(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, false);
  }

  private scheduleNavigation(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean): void {
    if (this.deps.recording.state() !== "recording" || unsupportedPageForUrl(url)) return;
    this.deps.navigation.schedule(tabId, url, () => void this.recordNavigation(tabId, url, timestamp, explicitlyTyped));
  }

  private async recordNavigation(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean): Promise<void> {
    if (this.deps.recording.state() !== "recording") return;
    if (!this.deps.navigation.shouldRecord(tabId, url, timestamp, explicitlyTyped, this.deps.recording.startedAt())) return;
    await this.deps.recordEvent({
      kind: "browser.navigation",
      sequence: this.deps.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: explicitlyTyped ? { transition: "typed" } : undefined
    }, tabId);
  }

  private async processEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.deps.recording.state() !== "recording") return;
    if (tabId !== undefined && isNavigationExplanation(payload)) {
      this.deps.navigation.noteExplanatoryAction(tabId, payload.eventTimestampMs);
    }
    if (isExecutableRecordedAction(payload)) {
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
    await this.deps.evidence.sendRecordingEvidence(payload, tabId, frameId);
  }
}
