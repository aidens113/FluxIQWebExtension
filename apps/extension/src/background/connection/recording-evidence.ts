// Evidence for a recording: the structured state behind each recorded event,
// the snapshot a recording opens with, and the on-demand snapshot of the active
// tab. Structured state always goes out; the screenshot paired with it is
// best-effort, and every reason one is missing is reported rather than dropped.

import {
  createWebAutomationStateFromSnapshot,
  createWebAutomationStateUpdate,
  WEB_AUTOMATION_INPUT_IDS
} from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  ClientGatewaySnapshot,
  JsonObject,
  RecordingEventPayload,
  RecordingState,
  TabDescriptor,
  UnsupportedPageState
} from "../../shared/protocol";
import { browserStateSnapshotFromTabs } from "./browser-state";
import {
  captureMergedTabSnapshot,
  hasSnapshotFrameViewportOffset,
  isDomSnapshotPayload,
  type DomSnapshotPayload,
  type TabSnapshotTransport
} from "./dom-snapshot";
import { recordingEvidencePayload } from "./gateway-payloads";
import type { GatewayMessageSender } from "./gateway-session";
import { shouldRequireStateForEvidence, stateScreenshotEventKey, stateSnapshotIdFromPayload } from "./recorded-event";
import { eventSourceId, tabSourceId } from "./recording-manifest";
import type { StateAssetStore, VisualStateSample } from "./state-assets";
import { compactObject, numberValue, objectValue } from "./value-readers";

// How long a screenshot-skipped warning suppresses the next identical one.
const SCREENSHOT_SKIP_LOG_INTERVAL_MS = 2_000;

/**
 * The cross-frame merged snapshot for one recorded event, captured once.
 *
 * The merge is the expensive part of this file: one `captureSnapshot` round
 * trip per frame -- one on an ordinary page, six on a six-frame one -- and each
 * of those is a full content-script DOM sweep. Recording fires on every click,
 * input, change, submit and keydown, so anything that runs the merge twice per
 * event doubles that cost.
 *
 * `connection.ts` needs the merged snapshot for the recording event itself and
 * this reporter needs it for the state projection, so the capture is run once
 * and the result passed between them in this wrapper. The wrapper is what
 * carries the meaning, not the snapshot inside it: holding one says the capture
 * has already been attempted, which a bare `undefined` snapshot cannot say --
 * and "the tab could not be read" must not be retried as "nobody has read the
 * tab yet".
 */
export type CapturedEventSnapshot = {
  readonly snapshot: RecordingEventPayload["snapshot"] | undefined;
};

export type RecordingEvidenceDeps = {
  readonly send: GatewayMessageSender;
  readonly recordingState: () => RecordingState;
  readonly resolveProjectId: (reason: string) => Promise<string | undefined>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly emitStatus: () => void;
  readonly clientId: () => string;
  readonly activeTabId: () => number | undefined;
  readonly activeTabUrl: () => string | undefined;
  readonly unsupportedPage: () => UnsupportedPageState | undefined;
  readonly setUnsupportedPage: (state: UnsupportedPageState) => void;
  readonly transport: TabSnapshotTransport;
  readonly ensureContentScript: (tabId: number) => Promise<void>;
  readonly attachTabForRecording: (tabId: number) => Promise<void>;
  readonly activeTab: () => Promise<TabDescriptor | undefined>;
  readonly allTabs: () => Promise<TabDescriptor[]>;
  readonly stateAssets: StateAssetStore;
  // Session and settings fields logged when a screenshot is skipped.
  readonly screenshotDiagnostics: () => Record<string, unknown>;
};

export class RecordingEvidenceReporter {
  private lastScreenshotSkipAt: number | undefined;

  constructor(private readonly deps: RecordingEvidenceDeps) {}

  /**
   * The merged tab snapshot for a recorded event, for a caller that has to put
   * it on the event before sending it.
   *
   * `connection.ts` sends `client.recording_event` first and the evidence that
   * belongs with it a line later. Both want the same tab-wide snapshot -- the
   * event should describe the page, not the one frame the interaction happened
   * in, and the state projected beside it should describe the same instant --
   * so the merge runs here, once, and the result is handed to
   * `sendRecordingEvidence` rather than recomputed there. See
   * `CapturedEventSnapshot` for what a second merge would cost.
   */
  async captureEventSnapshot(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<CapturedEventSnapshot> {
    if (this.deps.recordingState() !== "recording") return { snapshot: undefined };
    return { snapshot: await this.captureDomSnapshotForEvidence(payload, tabId, frameId) };
  }

  // Each await is a chance for the recording to have stopped underneath us, so
  // the guard is repeated rather than checked once at the top.
  //
  // `captured` is the merged snapshot a caller already took for the recording
  // event. When it is given the tab is not read again -- including when it
  // holds no snapshot, because that is a capture that was tried and came back
  // empty, not one that has yet to happen.
  async sendRecordingEvidence(
    payload: RecordingEventPayload,
    tabId?: number,
    frameId?: number,
    captured?: CapturedEventSnapshot
  ): Promise<void> {
    if (this.deps.recordingState() !== "recording") return;
    const projectId = await this.deps.resolveProjectId("recording_evidence");
    if (this.deps.recordingState() !== "recording") return;
    const snapshot = captured ? captured.snapshot : await this.captureDomSnapshotForEvidence(payload, tabId, frameId);
    if (this.deps.recordingState() !== "recording") return;
    const hasDomSnapshot = isDomSnapshotPayload(snapshot);
    const state = hasDomSnapshot
      ? await this.createStateFromDomSnapshot(snapshot, {
          timestamp: payload.eventTimestampMs,
          eventKey: stateScreenshotEventKey(payload),
          ...(projectId ? { projectId } : {}),
          ...(tabId === undefined ? {} : {
            sourceId: tabSourceId(tabId),
            tabId
          })
        })
      : compactObject({
          latestEvidence: recordingEvidencePayload(payload)
        }) as JsonObject;
    if (this.deps.recordingState() !== "recording") return;
    const stateTimestampMs = numberValue(objectValue(state)?.timestamp) ?? payload.eventTimestampMs;
    if (hasDomSnapshot) {
      const snapshotId = stateSnapshotIdFromPayload(payload);
      await this.deps.send("client.snapshot", compactObject({
        snapshotId,
        timestamp: stateTimestampMs,
        kind: "state",
        state,
        metadata: compactObject({
          reason: "recording-evidence",
          clientKind: payload.kind,
          eventTimestampMs: payload.eventTimestampMs,
          stateTimestampMs,
          sequence: payload.sequence,
          ...(tabId === undefined ? {} : { tabId }),
          ...(frameId === undefined ? {} : { frameId }),
          ...(payload.metadata ?? {})
        }) as JsonObject
      } satisfies ClientGatewaySnapshot));
      return;
    }
    await this.deps.send("client.state_update", createWebAutomationStateUpdate({
      ...(tabId === undefined ? {} : { activeContextId: String(tabId) }),
      state,
      metadata: compactObject({
        reason: "recording-evidence",
        inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence,
        clientKind: payload.kind,
        eventTimestampMs: payload.eventTimestampMs,
        stateTimestampMs,
        ...(tabId === undefined ? {} : { tabId }),
        ...(frameId === undefined ? {} : { frameId }),
        ...(payload.metadata ?? {})
      }) as JsonObject
    }));
  }

  // The state a recording opens with. Falls back to browser tab state when the
  // page cannot be snapshotted.
  async buildInitialRecordingState(timestamp: number): Promise<JsonObject> {
    const tabId = this.deps.activeTabId();
    if (tabId !== undefined && !this.deps.unsupportedPage()) {
      try {
        await this.deps.attachTabForRecording(tabId);
        const snapshot = await this.deps.transport.sendToTab(tabId, { type: "captureSnapshot" });
        if (isDomSnapshotPayload(snapshot)) {
          const projectId = await this.deps.resolveProjectId("initial_state");
          return await this.createStateFromDomSnapshot(snapshot, {
            timestamp,
            ...(projectId ? { projectId } : {}),
            tabId,
            sourceId: tabSourceId(tabId)
          });
        }
      } catch {
        // Fall back to browser tab state below.
      }
    }
    return browserStateSnapshotFromTabs(
      await this.deps.activeTab(),
      await this.deps.allTabs(),
      this.deps.recordingState(),
      timestamp,
      eventSourceId(this.deps.clientId())
    ) as unknown as JsonObject;
  }

  async captureActiveSnapshot(label: string): Promise<void> {
    const tabId = this.deps.activeTabId();
    if (tabId === undefined) return;
    const unsupported = this.deps.unsupportedPage();
    if (unsupported) {
      this.deps.onActivity("snapshot", "Snapshot skipped", unsupported.reason, "warning");
      return;
    }
    try {
      await this.deps.attachTabForRecording(tabId);
      const snapshot = await this.deps.transport.sendToTab(tabId, { type: "captureSnapshot" });
      await this.deps.send("client.snapshot", await this.gatewaySnapshotFromDomSnapshot(snapshot as never, tabId));
      this.deps.onActivity("snapshot", label, this.deps.activeTabUrl());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content script is unavailable.";
      this.deps.setUnsupportedPage({ url: this.deps.activeTabUrl(), reason: message });
      this.deps.onActivity("snapshot", "Snapshot failed", message, "warning");
      this.deps.emitStatus();
    }
  }

  // The content script's own snapshot can be missing or frame-local. Re-reading
  // the tab recovers a merged one; failing that, the event goes out without.
  private async captureDomSnapshotForEvidence(
    payload: RecordingEventPayload,
    tabId?: number,
    frameId?: number
  ): Promise<RecordingEventPayload["snapshot"] | undefined> {
    if (tabId === undefined || this.deps.unsupportedPage() || !shouldRequireStateForEvidence(payload)) return undefined;
    try {
      await this.deps.ensureContentScript(tabId);
      const snapshot = await captureMergedTabSnapshot(this.deps.transport, tabId, isDomSnapshotPayload(payload.snapshot) ? payload.snapshot : undefined, frameId);
      if (isDomSnapshotPayload(snapshot)) {
        console.info("FluxIQ evidence snapshot recovered", {
          kind: payload.kind,
          sequence: payload.sequence,
          tabId,
          frameId
        });
        return snapshot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallback DOM snapshot failed.";
      console.warn("FluxIQ evidence snapshot unavailable", {
        kind: payload.kind,
        sequence: payload.sequence,
        tabId,
        frameId,
        message
      });
    }
    return undefined;
  }

  private async createStateFromDomSnapshot(
    snapshot: DomSnapshotPayload,
    input: { timestamp: number; sourceId?: string; projectId?: string; tabId?: number; frameId?: number; eventKey?: string }
  ): Promise<JsonObject> {
    let screenContentRef: string | undefined;
    let stateSnapshot = snapshot;
    let stateTimestamp = input.timestamp;
    let visualSample: VisualStateSample | undefined;
    let missingScreenReason: string | undefined;
    const hasFrameViewportOffset = hasSnapshotFrameViewportOffset(snapshot);
    // A full-tab screenshot only lines up with frame-local state once the
    // iframe's viewport offset is known.
    const canAttachFullTabScreenshot = input.frameId === undefined || input.frameId === 0 || hasFrameViewportOffset;
    if (input.projectId && input.tabId !== undefined && canAttachFullTabScreenshot) {
      visualSample = await this.deps.stateAssets.captureFreshVisualSample(input.tabId, input.projectId, input.timestamp, input.eventKey);
      screenContentRef = visualSample?.screenContentRef;
      if (visualSample?.snapshot) stateSnapshot = visualSample.snapshot;
      if (!screenContentRef) missingScreenReason = "screenshot capture or upload failed";
    } else {
      missingScreenReason = input.frameId !== undefined && input.frameId !== 0
        ? "frame-local state missing iframe viewport offset"
        : input.projectId
          ? "no tab id"
          : "no project id";
      this.noteScreenshotSkipped(input.frameId !== undefined && input.frameId !== 0
        ? "Frame-local state cannot be safely paired with a full-tab screenshot until iframe viewport offset is available."
        : input.projectId
          ? "No active tab id available for screenshot capture."
          : "No project id available for screenshot upload.");
    }
    const options: Parameters<typeof createWebAutomationStateFromSnapshot>[1] = { timestamp: stateTimestamp };
    if (input.sourceId !== undefined) options.sourceId = input.sourceId;
    if (input.projectId !== undefined) options.projectId = input.projectId;
    if (screenContentRef !== undefined) options.screenContentRef = screenContentRef;
    if (visualSample?.screenImageSize !== undefined) options.screenImageSize = visualSample.screenImageSize;
    const state = createWebAutomationStateFromSnapshot(stateSnapshot, options) as unknown as JsonObject;
    if (missingScreenReason) {
      console.warn("FluxIQ state snapshot missing screenshot", {
        reason: missingScreenReason,
        timestamp: input.timestamp,
        stateTimestamp,
        sourceId: input.sourceId,
        projectId: input.projectId,
        tabId: input.tabId,
        frameId: input.frameId
      });
      this.deps.onActivity("snapshot", "State screenshot missing", missingScreenReason, "warning");
      const metadata = objectValue(state.metadata);
      return {
        ...state,
        metadata: compactObject({
          ...(metadata ?? {}),
          missingScreenReason
        }) as JsonObject
      };
    }
    return state;
  }

  private async gatewaySnapshotFromDomSnapshot(
    snapshot: { url: string; title: string; viewport: unknown; focusedElement?: unknown; selectedText?: string; interactiveElements: unknown[] },
    tabId?: number
  ): Promise<ClientGatewaySnapshot> {
    const timestamp = Date.now();
    const projectId = await this.deps.resolveProjectId("snapshot");
    const state = isDomSnapshotPayload(snapshot)
      ? await this.createStateFromDomSnapshot(snapshot, {
          timestamp,
          ...(projectId ? { projectId } : {}),
          ...(tabId === undefined ? {} : { tabId }),
          ...(tabId === undefined ? {} : { sourceId: tabSourceId(tabId) })
        })
      : undefined;
    return compactObject({
      snapshotId: `dom.${timestamp}`,
      timestamp,
      kind: state ? "state" : "structured",
      ...(state !== undefined ? { state } : {}),
      payload: snapshot as unknown as JsonObject
    } satisfies ClientGatewaySnapshot) as ClientGatewaySnapshot;
  }

  private noteScreenshotSkipped(message: string): void {
    const now = Date.now();
    if (this.lastScreenshotSkipAt !== undefined && now - this.lastScreenshotSkipAt < SCREENSHOT_SKIP_LOG_INTERVAL_MS) return;
    this.lastScreenshotSkipAt = now;
    console.warn("FluxIQ screenshot skipped", {
      message,
      ...this.deps.screenshotDiagnostics()
    });
    this.deps.onActivity("snapshot", "Screenshot skipped", message, "warning");
  }
}
