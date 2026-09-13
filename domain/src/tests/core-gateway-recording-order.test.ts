// W25 through Core's client gateway, received the way its WebSocket host
// receives a live recording.
//
// Core's WebSocket host starts each frame's handler without awaiting the one
// before it (`client-gateway-websocket.ts`, `acceptData`), so one client's
// messages reach the gateway concurrently. This row sends the eight messages of
// a live `delayed-ui` recording that way, through Core's own
// `ClientGatewayService` and `AutomationStudioClientGatewayBridge`, and asks
// Core for the recording's proposals. The web mapper proposes a wait from the
// page change only when the click on the target it revealed is stored after it,
// so the row holds only if Core stores a client's messages in the order it
// received them.
//
// The messages are built with the domain's own builders. The domain may not
// import `apps/extension`, so what the extension adds around them is copied by
// hand from the lines cited beside each builder. Element, page and timing values
// are synthetic.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioClientGatewayBridge, AutomationStudioNativeNodeRuntime, AutomationStudioService } from "fluxiq/automation-studio";
import { CLIENT_GATEWAY_PROTOCOL_VERSION, ClientGatewayService, type ClientGatewayClientMessage } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { IoRegistry } from "fluxiq/io";
import { WEB_AUTOMATION_DOMAIN_ID } from "..";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { createWebAutomationRecordingEvent, createWebAutomationStateFromSnapshot, createWebAutomationStateUpdate, webAutomationActionVisualTargetFromElement } from "../client";
import { WEB_AUTOMATION_INPUT_IDS, webAutomationInputIdForRecordedEvent } from "../io/input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "../io/manifest-definitions";
import { webAutomationOutputPayload } from "../output-nodes";
import { webAutomationRecordingDomain } from "../recording/domain";
import { mapWebRecordingObservation } from "../web-panel-host";

type ClientMessage<T extends ClientGatewayClientMessage["type"]> = Extract<ClientGatewayClientMessage, { type: T }>;
type TimelineEntry = Awaited<ReturnType<AutomationStudioService["getRecordingSession"]>>["timeline"][number];

const PAGE = "http://127.0.0.1:4100/scenarios/delayed-ui/";
const TITLE = "Delayed UI";
const TAB = 7;
const FRAME = 0;
const OPENED_AT = 1_789_297_840_000;
const CLICKED_AT = OPENED_AT + 1_000;
/** When the page added the late target and it was clicked. The live runs clicked it 329-466 ms after the first click. */
const REVEALED_AT = CLICKED_AT + 385;
const BEGIN = '[data-testid="begin-delay"]';
const LATE = '[data-testid="late-action"]';
const COMPACTED = "Compacted 3 high-frequency state entries before mapper proposal generation. Raw recording data was preserved.";

function clientMessage<T extends ClientGatewayClientMessage["type"]>(type: T, id: string, payload: ClientMessage<T>["payload"]): ClientMessage<T> {
  return { id: `w25.${id}`, type, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: OPENED_AT, payload } as ClientMessage<T>;
}

/** The DOM snapshot the content script captures, reduced to the page's own facts. */
function page(capturedAt: number) {
  return { url: PAGE, title: TITLE, viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: [], capturedAt };
}

function pageState(at: number, sourceId?: string): JsonObject {
  return createWebAutomationStateFromSnapshot(page(at), { timestamp: at, ...(sourceId === undefined ? {} : { sourceId }) }) as unknown as JsonObject;
}

/** An executable click, as `gateway-payloads.ts:23-36,58-83` builds it: its input and visual target in its metadata, and the page captured with it. */
function recordedClick(sequence: number, at: number, testId: string, text: string, recordingId: string): ClientMessage<"client.recording_event"> {
  const element = { selector: `[data-testid="${testId}"]`, tagName: "button", text, testId, bounds: { x: 8, y: 60, width: 110, height: 24 }, isVisibleOnViewport: true };
  const metadata = { sourceEvent: "pointerdown" };
  const inputId = webAutomationInputIdForRecordedEvent({ kind: "dom.click", url: PAGE, title: TITLE, sequence, element, metadata });
  assert.ok(inputId === WEB_AUTOMATION_INPUT_IDS.elementClicked, "the extension sends a click as an executable input");
  const visualTarget = webAutomationActionVisualTargetFromElement(element) as unknown as JsonObject;
  const event = createWebAutomationRecordingEvent({ kind: "dom.click", sequence, url: PAGE, title: TITLE, eventTimestampMs: at, element, visualTarget, snapshot: page(at), metadata: { ...metadata, inputId, visualTarget } }, { tabId: TAB, frameId: FRAME, recordingId });
  return clientMessage("client.recording_event", `click.${sequence}`, event);
}

/** A click's page state, as `recording-evidence.ts:136-153` sends it once the click's DOM snapshot is captured. */
function clickState(sequence: number, at: number): ClientMessage<"client.snapshot"> {
  return clientMessage("client.snapshot", `click.${sequence}.state`, {
    snapshotId: `state.dom.click.${sequence}.${at}`,
    timestamp: at,
    kind: "state",
    state: pageState(at, `tab:${TAB}`),
    metadata: { reason: "recording-evidence", clientKind: "dom.click", eventTimestampMs: at, stateTimestampMs: at, sequence, tabId: TAB, frameId: FRAME, sourceEvent: "pointerdown" }
  });
}

/** Evidence with no DOM snapshot, as `recording-evidence.ts:156-169` sends it, its `latestEvidence` shaped by `gateway-payloads.ts:38-56`. */
function evidence(id: string, observed: { kind: string; sequence: number; title: string; at: number; mutation?: JsonObject; metadata?: JsonObject }, frame?: { tabId: number; frameId: number }): ClientMessage<"client.state_update"> {
  const { kind, sequence, title, at, mutation, metadata } = observed;
  return clientMessage("client.state_update", id, createWebAutomationStateUpdate({
    ...(frame === undefined ? {} : { activeContextId: String(frame.tabId) }),
    state: { latestEvidence: { kind, url: PAGE, title, sequence, timestamp: at, ...(mutation === undefined ? {} : { mutation }), ...(metadata === undefined ? {} : { metadata }) } },
    metadata: { reason: "recording-evidence", inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence, clientKind: kind, eventTimestampMs: at, stateTimestampMs: at, ...(frame ?? {}), ...(metadata ?? {}) }
  }));
}

/**
 * The live recording's eight messages, in the order the extension sends them:
 * the browser state, the start's tab event and the initial snapshot
 * (`active-recording.ts:294-303`), then each click before its page state
 * (`recorded-event-intake.ts:172-175`), with the page change between them.
 */
function liveRecording(recordingId: string): ClientGatewayClientMessage[] {
  return [
    clientMessage("client.state_update", "browser-state", createWebAutomationStateUpdate({ activeContextId: String(TAB), recording: true, contexts: [{ contextId: String(TAB), url: PAGE, title: TITLE, active: true, metadata: { kind: "browser.tab", status: "complete" } }], state: pageState(OPENED_AT), metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState } })),
    evidence("tab", { kind: "browser.tab", sequence: 100, title: "", at: OPENED_AT, metadata: { recordingState: "started", recordingId } }),
    clientMessage("client.snapshot", "initial-state", { snapshotId: `dom.${OPENED_AT}`, timestamp: OPENED_AT, kind: "state", state: pageState(OPENED_AT, `tab:${TAB}`), payload: page(OPENED_AT) }),
    recordedClick(1, CLICKED_AT, "begin-delay", "Load content", recordingId),
    clickState(1, CLICKED_AT),
    evidence("mutation", { kind: "dom.mutation", sequence: 2, title: TITLE, at: REVEALED_AT, mutation: { added: 1, removed: 0, attributes: 0, text: 0 } }, { tabId: TAB, frameId: FRAME }),
    recordedClick(3, REVEALED_AT, "late-action", "Late action", recordingId),
    clickState(3, REVEALED_AT)
  ];
}

/**
 * Pairs a client with Core's gateway and starts a recording through the bridge,
 * then receives `liveRecording` as the WebSocket host does: every message's
 * handler started, none awaited before the next. Once every receive settles it
 * stops the recording and asks Core for proposals from two mappers: `web`, and
 * `none`, which proposes nothing, so its candidates are Core's fallback alone.
 */
async function receiveAsTheWebSocketHostDoes() {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "web-gateway-order-"));
  const io = new IoRegistry();
  for (const definition of webAutomationManifestInputs) {
    const outputId = "outputId" in definition ? definition.outputId : undefined;
    io.registerInput(WEB_AUTOMATION_DOMAIN_ID, { definition, mode: "stream", subscribe: () => () => undefined, ...(typeof outputId === "string" ? { outputBinding: { outputId, toPayload: (event) => webAutomationOutputPayload(outputId, event.payload as JsonObject) } } : {}) });
  }
  for (const definition of webAutomationManifestOutputs) {
    io.registerOutput(WEB_AUTOMATION_DOMAIN_ID, { definition, mode: "request", dispatch: (request) => ({ ok: true, domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: request.outputId, payload: {} }) });
  }
  const mappers = { web: mapWebRecordingObservation, none: () => null };
  const runtime = new AutomationStudioNativeNodeRuntime().register({ schemaVersion: "0.1", sdkVersion: "0.1", packageId: "web.gateway-order", packageVersion: "1.0.0", domainId: WEB_AUTOMATION_DOMAIN_ID, nodes: [], recordingMappers: Object.keys(mappers).map((id) => ({ id, version: "1.0.0", description: id, outputIds: WEB_AUTOMATION_ACTION_TYPES })) }, { packageId: "web.gateway-order", packageVersion: "1.0.0", implementations: {}, recordingMappers: mappers });
  const service = new AutomationStudioService({ dataDir }).bindIoRuntime(io, WEB_AUTOMATION_DOMAIN_ID).bindNativeNodeRuntime(runtime);
  const gateway = new ClientGatewayService();
  const bridge = new AutomationStudioClientGatewayBridge({ gateway, automationStudio: service, io, stopDrainMs: 0 });
  try {
    service.registerRecordingDomain(webAutomationRecordingDomain);
    const { id: projectId } = await service.createProject({ name: "Gateway order", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const { sessionId } = gateway.connect();
    await gateway.receive(sessionId, clientMessage("client.hello", "hello", { clientId: "client.w25", clientType: "extension", name: "W25" }));
    const pairingCode = gateway.snapshot().pairings[0]?.pairingCode;
    assert.ok(pairingCode, "the client's hello opens a pairing");
    await gateway.approvePairing(pairingCode, { approvedByUserId: "user.w25" });
    const { recordingId } = await bridge.startRecording({ sessionId, projectId, domainId: WEB_AUTOMATION_DOMAIN_ID });
    await Promise.all(liveRecording(recordingId).map((message) => gateway.receive(sessionId, message)));
    await bridge.stopRecording(sessionId);
    const { timeline } = await service.getRecordingSession(recordingId, projectId);
    const { proposals, issues } = await service.createRecordingFlowProposals({ projectId, recordingId });
    const candidatesOf = (mapperId: string) => (proposals.find((proposal) => proposal.mapper.id === mapperId)?.candidates ?? []).map((candidate) => [candidate.outputId, candidate.parameters.selector]);
    return { timeline, issues, web: candidatesOf("web"), none: candidatesOf("none") };
  } finally {
    await service.close();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  }
}

function describeEntry(entry: TimelineEntry): string {
  if (entry.type === "action") return `${entry.actionType} ${String(entry.parameters.selector)}`;
  if (entry.type !== "observation") return entry.type;
  const evidenceKind = (entry.payload?.latestEvidence as JsonObject | undefined)?.kind;
  return typeof evidenceKind === "string" ? evidenceKind : entry.observationType;
}

test("W25: the live delayed-ui messages through Core's client gateway, received as its WebSocket host receives them, propose click, wait, click", async () => {
  const recording = await receiveAsTheWebSocketHostDoes();
  const stored = `stored in this order: ${recording.timeline.map(describeEntry).join(", ")}`;
  assert.equal(recording.timeline.length, 8, `Core stores every message; ${stored}`);
  assert.deepEqual(recording.issues, [COMPACTED], "Core compacts the three state entries before proposing");
  assert.deepEqual(recording.none, [["web.dom.click", BEGIN], ["web.dom.click", LATE]], "Core's own fallback proposes the two clicks");
  assert.deepEqual(recording.web, [["web.dom.click", BEGIN], ["web.dom.wait_for_selector", LATE], ["web.dom.click", LATE]], `the page change is stored before the late click it revealed, so a wait is proposed before that click; ${stored}`);
});
