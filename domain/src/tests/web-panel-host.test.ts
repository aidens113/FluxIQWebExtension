// A recorded event sent as a domain event is proposed once, from where Core
// shows it to the mapper.
//
// Every row records through Core. Each recorded event is routed the way Core's
// client gateway routes a `client.recording_event` (`client-gateway/bridge.ts`,
// `appendRecordingEvent`): one whose metadata names a registered input goes
// through Core's IO recorder, and any other is appended as a domain event.
// Recording evidence goes through the IO recorder on the evidence input, as a
// `client.state_update` does.
//
// Core stores a domain event twice, and shows a mapper both: its own entry,
// which keeps the event's payload inside `{ target?, payload }`
// (`model/recording-domain.ts`), and the observation the web recording domain
// extracts from it (`recording/observations.ts`), which keeps that payload one
// level up. The mapper reads the event from the observation, so its own entry
// proposes nothing. Reading both would propose every action twice; the rows
// assert on Core's proposal, so they fail if it does.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioIoRecorder, AutomationStudioNativeNodeRuntime, AutomationStudioService, type AutomationStudioRecordingMapperContext, type AutomationStudioRecordingMapperObservation } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { IoRegistry, createEnvelope } from "fluxiq/io";
import { WEB_AUTOMATION_DOMAIN_ID } from "..";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { createWebAutomationRecordingEvent } from "../client";
import { WEB_AUTOMATION_INPUT_IDS, actionInputDefinitions, webAutomationInputIdForRecordedEvent } from "../io/input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "../io/manifest-definitions";
import { webAutomationOutputPayload } from "../output-nodes";
import { webAutomationRecordingDomain } from "../recording/domain";
import { mapWebRecordingObservation } from "../web-panel-host";

type RecordingEvent = ReturnType<typeof createWebAutomationRecordingEvent>;
type MapperCall = { observation: AutomationStudioRecordingMapperObservation; following: AutomationStudioRecordingMapperObservation[] };
/** What the extension sends while recording: a recorded event, or evidence as the state it reports. */
type Sent = { event: RecordingEvent } | { evidence: JsonObject };

const SIGN_IN = "https://example.test/scenarios/auth-gate/sign-in";
const ACCOUNT = "https://example.test/scenarios/auth-gate/account";
const DELAYED_UI = "https://example.test/scenarios/delayed-ui/";

function urlClaim(expected: string): JsonObject {
  return { conditions: [{ assert: { kind: "url", expected } }], mode: "all", timeoutMs: 5_000 };
}

/**
 * Records `sent` through Core, then asks it for the recording's proposals. It
 * gives back every call Core made to a recording mapper, and the candidates of
 * two mappers without their generated ids: `web`, the web mapper, and `none`,
 * which proposes nothing, so its candidates are Core's own fallback alone.
 */
async function recordThroughCore(sent: readonly Sent[]) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "web-stored-events-"));
  const io = new IoRegistry();
  for (const definition of webAutomationManifestInputs) {
    const outputId = "outputId" in definition ? definition.outputId : undefined;
    io.registerInput(WEB_AUTOMATION_DOMAIN_ID, { definition, mode: "stream", subscribe: () => () => undefined, ...(typeof outputId === "string" ? { outputBinding: { outputId, toPayload: (event) => webAutomationOutputPayload(outputId, event.payload as JsonObject) } } : {}) });
  }
  for (const definition of webAutomationManifestOutputs) {
    io.registerOutput(WEB_AUTOMATION_DOMAIN_ID, { definition, mode: "request", dispatch: (request) => ({ ok: true, domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: request.outputId, payload: {} }) });
  }
  const calls: MapperCall[] = [];
  const none = (observation: AutomationStudioRecordingMapperObservation, context: Pick<AutomationStudioRecordingMapperContext, "following">) => {
    calls.push({ observation, following: [...context.following] });
    return null;
  };
  const mappers = { web: mapWebRecordingObservation, none };
  const runtime = new AutomationStudioNativeNodeRuntime().register({ schemaVersion: "0.1", sdkVersion: "0.1", packageId: "web.stored-events", packageVersion: "1.0.0", domainId: WEB_AUTOMATION_DOMAIN_ID, nodes: [], recordingMappers: Object.keys(mappers).map((id) => ({ id, version: "1.0.0", description: id, outputIds: WEB_AUTOMATION_ACTION_TYPES })) }, { packageId: "web.stored-events", packageVersion: "1.0.0", implementations: {}, recordingMappers: mappers });
  const service = new AutomationStudioService({ dataDir }).bindIoRuntime(io, WEB_AUTOMATION_DOMAIN_ID).bindNativeNodeRuntime(runtime);
  try {
    service.registerRecordingDomain(webAutomationRecordingDomain);
    const { id: projectId } = await service.createProject({ name: "Stored events", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const { recordingId } = await service.createRecording({ projectId, recordingId: "recording.stored-events", domainId: WEB_AUTOMATION_DOMAIN_ID, initialState: { timestamp: 1, namespaces: {} } });
    const recorder = new AutomationStudioIoRecorder({ automationStudio: service, io, domainId: WEB_AUTOMATION_DOMAIN_ID, projectId });
    for (const [index, item] of sent.entries()) {
      const clientGatewayMessageId = `message.${index + 1}`;
      if ("evidence" in item) {
        const inputId = WEB_AUTOMATION_INPUT_IDS.recordingEvidence;
        await recorder.recordInput(recordingId, inputId, createEnvelope({ domainId: WEB_AUTOMATION_DOMAIN_ID, ioId: inputId, payload: item.evidence, metadata: { sourceId: "client.test.observations", clientGatewayMessageId, reason: "recording-evidence", inputId } }));
        continue;
      }
      const { event } = item;
      const sourceId = event.sourceId ?? "client.test.events";
      const inputId = event.metadata?.inputId;
      if (typeof inputId === "string" && io.hasInput(WEB_AUTOMATION_DOMAIN_ID, inputId)) {
        await recorder.recordInput(recordingId, inputId, createEnvelope({ domainId: WEB_AUTOMATION_DOMAIN_ID, ioId: inputId, payload: event.payload ?? {}, ...(event.timestamp === undefined ? {} : { timestampMs: event.timestamp }), metadata: { sourceId, clientGatewayMessageId, ...(event.metadata ?? {}), eventId: eventIdOf(event) } }));
        continue;
      }
      const result = await service.appendRecordingDomainEvent({ projectId, recordingId, domainId: WEB_AUTOMATION_DOMAIN_ID, eventType: event.eventType, eventId: eventIdOf(event), ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }), sourceId, ...(event.target === undefined ? {} : { target: event.target }), ...(event.payload === undefined ? {} : { payload: event.payload }), metadata: { clientGatewayMessageId, clientId: "client.test", ...(event.metadata ?? {}) } });
      assert.equal(result.accepted, true, `Core accepts ${event.eventType}: ${result.issues.map((issue) => issue.message).join("; ")}`);
    }
    const { proposals } = await service.createRecordingFlowProposals({ projectId, recordingId });
    const candidatesOf = (mapperId: string) => (proposals.find((proposal) => proposal.mapper.id === mapperId)?.candidates ?? []).map(({ candidateId: _candidateId, ...candidate }) => candidate);
    return { calls, web: candidatesOf("web"), none: candidatesOf("none") };
  } finally {
    await service.close();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  }
}

function eventIdOf(event: RecordingEvent): string {
  assert.ok(event.eventId, "the builder names every recording event");
  return event.eventId;
}

/** The call for a domain event's own entry, which Core names by the event's id. */
function entryCall(calls: readonly MapperCall[], event: RecordingEvent): MapperCall {
  const call = calls.find(({ observation }) => observation.observationId === event.eventId);
  assert.ok(call, `Core called the mapper for the entry of ${event.eventType} ${event.eventId}`);
  return call;
}

/** The call for the observation the web recording domain extracts from a domain event: the first after its entry with the event's type. */
function observationCall(calls: readonly MapperCall[], event: RecordingEvent): MapperCall {
  const entryIndex = calls.indexOf(entryCall(calls, event));
  const call = calls.slice(entryIndex + 1).find(({ observation }) => observation.type === "observation" && observation.payload.observationType === event.eventType);
  assert.ok(call, `Core called the mapper for the observation of ${event.eventType} ${event.eventId}`);
  return call;
}

function mapCall(call: MapperCall | undefined) {
  assert.ok(call, "Core called the mapper for the entry");
  return mapWebRecordingObservation(call.observation, { following: call.following });
}

function click(sequence: number, timestamp: number, input: { url?: string; selector?: string } = {}): RecordingEvent {
  return createWebAutomationRecordingEvent({ kind: "dom.click", sequence, url: input.url ?? SIGN_IN, title: "Page", eventTimestampMs: timestamp, element: { selector: input.selector ?? "#continue", tagName: "button", text: "Continue" } }, { tabId: 7, frameId: 0 });
}

/** A click as the extension sends an executable one, its metadata naming its input (`gateway-payloads.ts`), so Core records it as an `action` entry. */
function withClickInput(event: RecordingEvent): RecordingEvent {
  return { ...event, metadata: { ...(event.metadata ?? {}), inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked } };
}

/** A click's landing, as the extension sends it: an explained navigation with no input, so Core records it as a domain event. */
function landing(url: string, clicked: RecordingEvent, sequence: number, timestamp: number, names: "event id" | "sequence only" = "event id"): RecordingEvent {
  const explainedBy = clicked.payload?.sequence;
  assert.equal(typeof explainedBy, "number");
  return createWebAutomationRecordingEvent({ kind: "browser.navigation", sequence, url, title: "", eventTimestampMs: timestamp, metadata: { transition: "explained", explainedBy: explainedBy as number, ...(names === "event id" ? { explainedByEventId: eventIdOf(clicked) } : {}) } }, { tabId: 7 });
}

test("Core shows a mapper a domain event twice, and the mapper reads it from the observation alone", async () => {
  const signIn = click(3, 900);
  const signInLanding = landing(ACCOUNT, signIn, 4, 1_150);
  const { calls } = await recordThroughCore([{ event: signIn }, { event: signInLanding }]);
  for (const event of [signIn, signInLanding]) {
    const entry = entryCall(calls, event).observation;
    assert.equal(entry.type, "domain_event");
    assert.deepEqual(entry.payload.payload, { ...(event.target === undefined ? {} : { target: event.target }), payload: event.payload }, `${event.eventType}: its entry keeps the event's payload inside \`{ target?, payload }\``);
    const extracted = observationCall(calls, event).observation;
    assert.deepEqual(extracted.payload.payload, event.payload, `${event.eventType}: the extracted observation keeps it one level up`);
    assert.equal(entry.metadata.sourceId, undefined, `${event.eventType}: the entry does not show the mapper the event's source, its tab`);
    assert.equal(extracted.metadata.sourceId, undefined, `${event.eventType}: nor does the observation`);
  }
  assert.equal(mapCall(entryCall(calls, signIn)), null, "the click's own entry proposes nothing");
  assert.equal(mapCall(observationCall(calls, signIn))?.outputId, "web.dom.click", "its observation proposes the click");
});

test("D1: a click sent as a domain event is proposed once, claiming the path it landed on", async () => {
  const signIn = click(3, 900);
  const signInLanding = landing(ACCOUNT, signIn, 4, 1_150);
  const typed = createWebAutomationRecordingEvent({ kind: "dom.input", sequence: 5, url: ACCOUNT, title: "Account", eventTimestampMs: 1_200, element: { selector: "input[name=q]", tagName: "input" }, inputValue: "ada" }, { tabId: 7, frameId: 0 });
  const typedLanding = landing("https://example.test/scenarios/auth-gate/settings", typed, 6, 1_250);
  const recording = await recordThroughCore([{ event: signIn }, { event: signInLanding }, { event: typed }, { event: typedLanding }]);
  assert.deepEqual(recording.web.map((candidate) => [candidate.outputId, candidate.expectedState]), [["web.dom.click", urlClaim("/scenarios/auth-gate/account")], ["web.dom.type", undefined]], "one candidate for each executable event; only the click claims a landing");
  assert.deepEqual(recording.none, [], "Core has no fallback of its own for a domain event");
  const signInCall = observationCall(recording.calls, signIn);
  assert.deepEqual(mapCall(signInCall)?.parameters, webAutomationOutputPayload("web.dom.click", signIn.payload ?? {}), "the click's parameters are read from its own payload");
  assert.equal("expectedState" in (mapWebRecordingObservation(signInCall.observation) ?? {}), false, "mapped with no following entries, a click claims nothing");

  const bySequence = await recordThroughCore([{ event: signIn }, { event: landing(ACCOUNT, signIn, 4, 1_150, "sequence only") }]);
  assert.deepEqual(bySequence.web.map((candidate) => [candidate.outputId, candidate.expectedState]), [["web.dom.click", undefined]], "a landing with no event id names no click, since no entry shows the mapper its tab");
});

test("a typed navigation sent as a domain event is proposed once, and the recording's start not at all", async () => {
  const start = createWebAutomationRecordingEvent({ kind: "browser.navigation", sequence: 1, url: "https://example.test/", title: "", eventTimestampMs: 1, metadata: { reason: "recording_start", transition: "typed" } }, { tabId: 7 });
  const typed = createWebAutomationRecordingEvent({ kind: "browser.navigation", sequence: 2, url: "https://example.test/next", title: "", eventTimestampMs: 2, metadata: { transition: "typed" } }, { tabId: 7 });
  const recording = await recordThroughCore([{ event: start }, { event: typed }]);
  assert.deepEqual(recording.web.map((candidate) => [candidate.outputId, candidate.parameters.url, candidate.sourceInputIds]), [["web.browser.navigate", "https://example.test/next", [WEB_AUTOMATION_INPUT_IDS.navigationRequested]]]);
});

test("every recorded row sent as a domain event maps to what the live input path resolves, and is proposed once", async () => {
  const rows: Array<{ kind: string; element?: Record<string, string>; inputValue?: string; key?: string; scroll?: { x: number; y: number }; metadata?: Record<string, string> }> = [
    { kind: "content.ready" },
    { kind: "browser.tab" },
    { kind: "browser.navigation", metadata: { transition: "typed" } },
    { kind: "browser.navigation", metadata: { transition: "link" } },
    { kind: "dom.click", element: { selector: "#save", tagName: "button", text: "Save", xpath: "/html/body/button" } },
    { kind: "dom.input", element: { selector: "input[name=q]", tagName: "input" }, inputValue: "ada" },
    { kind: "dom.input", element: { selector: "input[name=q]", tagName: "input" }, inputValue: "" },
    { kind: "dom.change", element: { selector: "select#plan", tagName: "select" }, inputValue: "team" },
    { kind: "dom.change", element: { selector: "input#terms", tagName: "input", inputType: "checkbox" }, inputValue: "on" },
    { kind: "dom.submit", element: { selector: "form", tagName: "form" } },
    { kind: "dom.keydown", element: { selector: "input[name=q]", tagName: "input" }, key: "Enter" },
    { kind: "dom.scroll", scroll: { x: 0, y: 640 } },
    { kind: "dom.wheel", scroll: { x: 0, y: 640 } },
    { kind: "dom.mutation" },
    { kind: "dom.focus", element: { selector: "input[name=q]", tagName: "input" } },
    { kind: "dom.blur", element: { selector: "input[name=q]", tagName: "input" } },
    { kind: "dom.snapshot" },
    { kind: "action.result" },
    { kind: "client.error" }
  ];
  const recorded = rows.map((row, index) => {
    const payload = { url: "https://example.test/form", title: "Form", sequence: index + 1, ...row };
    const liveInputId = webAutomationInputIdForRecordedEvent(payload);
    const liveOutputId = actionInputDefinitions.find(([id]) => id === liveInputId)?.[2];
    return { label: `${row.kind} (row ${index + 1})`, liveInputId, liveOutputId, event: createWebAutomationRecordingEvent({ ...payload, eventTimestampMs: 100 + index }) };
  });
  const { calls, web } = await recordThroughCore(recorded.map(({ event }) => ({ event })));
  for (const { label, liveInputId, liveOutputId, event } of recorded) {
    const proposed = mapCall(observationCall(calls, event));
    assert.equal(proposed?.outputId, liveOutputId, `${label}: proposal and live output agree`);
    assert.deepEqual(proposed?.sourceInputIds, liveInputId === undefined ? undefined : [liveInputId], `${label}: proposal cites the live input`);
    if (liveOutputId !== undefined) assert.deepEqual(proposed?.parameters, webAutomationOutputPayload(liveOutputId, event.payload ?? {}), `${label}: proposal parameters equal the live output binding payload`);
  }
  assert.deepEqual(web.map((candidate) => candidate.outputId), recorded.flatMap(({ liveOutputId }) => liveOutputId === undefined ? [] : [liveOutputId]), "Core's proposal holds each executable row once, in recorded order");
  const eventOf = (kind: string): RecordingEvent => {
    const found = recorded.find(({ event }) => event.metadata?.clientKind === kind);
    assert.ok(found, `a ${kind} row was recorded`);
    return found.event;
  };
  assert.deepEqual(mapCall(observationCall(calls, eventOf("dom.scroll")))?.parameters, { x: 0, y: 640 }, "a recorded scroll proposes a scroll node");
  assert.equal(mapCall(observationCall(calls, eventOf("dom.wheel"))), null, "the never-emitted wheel event type proposes nothing");
});

// -- A recorded extraction, through Core (X4) ---------------------------------
// This is the cross-repository row: Core's proposal lift parses the
// `recordOutput` the mapper proposes and rejects the whole candidate when it is
// invalid (K7), so a candidate that survives here is one Core will approve into
// a Flow node that saves a dataset.

const EXTRACTION_SENTINEL = "SENTINEL-PAGE-VALUE-FROM-THE-PICKER";
const extractionRequest = {
  item: "li.product",
  fields: {
    name: { kind: "text", selector: ".name" },
    link: { kind: "link", selector: "a" },
    email: { kind: "text", selector: ".email", handling: "exclude" }
  },
  paginate: { next: "a.next", maxPages: 3 },
  maxItems: 200
};
const extractionDefinition = {
  form: "list",
  datasetId: "products:4f1c9a",
  label: "Products",
  itemCount: 24,
  request: extractionRequest,
  fieldLabels: { name: "Product name", link: "Link", email: "Email" }
};

function definedExtraction(extraction: JsonObject, sequence = 2): RecordingEvent {
  return createWebAutomationRecordingEvent({ kind: "data.extract", sequence, url: "https://example.test/products", title: "Products", eventTimestampMs: 1_000 + sequence, extraction }, { tabId: 7, frameId: 0 });
}

test("a recorded list extraction proposes extract_list with a recordOutput Core can lift, a scaled timeout, and no confirmation", async () => {
  const event = definedExtraction({ ...extractionDefinition, samples: [{ name: EXTRACTION_SENTINEL }] });
  const { web } = await recordThroughCore([{ event }]);
  assert.equal(web.length, 1, "Core proposes the extraction once");
  const candidate = web[0] as { outputId: string; sourceInputIds?: string[]; expectedConfirmation?: unknown; recordOutput?: JsonObject; timeoutMs?: number; parameters: JsonObject };
  assert.equal(candidate.outputId, "web.dom.extract_list");
  assert.deepEqual(candidate.sourceInputIds, [WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined]);
  // Core waits for a confirmation input whenever one is set, and the extension
  // confirms no extract action, so a confirmation would fail every replay.
  assert.equal("expectedConfirmation" in candidate, false, "an extraction candidate carries no confirmation");
  assert.equal(candidate.timeoutMs, 30_000, "10,000 ms a page, times the 3 pages the request may read (D14)");
  assert.deepEqual(candidate.parameters.extractList, extractionRequest);

  const recordOutput = candidate.recordOutput;
  assert.ok(recordOutput, "the candidate proposes a dataset");
  assert.equal(recordOutput.datasetId, "products:4f1c9a");
  assert.equal(recordOutput.writeMode, "append");
  assert.equal(recordOutput.maxRecords, 200);
  // Core fills the path from the output's own metadata, so the candidate names none.
  assert.equal(recordOutput.recordsPath, "extracted", "Core resolved the path from the output definition");
  const fields = recordOutput.schema as { fields: Array<{ id: string; label: string; valueType: string; required?: boolean; handling?: string }> };
  assert.deepEqual(fields.fields.map((field) => field.id), ["name", "link", "email"]);
  for (const field of fields.fields) {
    assert.match(field.id, /^[A-Za-z0-9_-]{1,100}$/u, `${field.id} is a field id Core accepts`);
  }
  assert.equal(fields.fields.find((field) => field.id === "email")?.handling, "exclude", "the excluded column persists, so detection does not propose it again (D12)");
  assert.equal(fields.fields.find((field) => field.id === "link")?.valueType, "url");
  assert.equal(JSON.stringify(candidate).includes(EXTRACTION_SENTINEL), false, "no sample value reaches the proposal");
});

test("a recorded single-value extraction proposes extract_list's sibling, and saves no dataset", async () => {
  const event = createWebAutomationRecordingEvent(
    { kind: "data.extract", sequence: 3, url: "https://example.test/order", title: "Order", eventTimestampMs: 1_100, element: { selector: "h1.total", tagName: "h1", id: "total" }, extraction: { form: "value", label: "Order total", read: { mode: "text" } } },
    { tabId: 7, frameId: 0 }
  );
  const { web } = await recordThroughCore([{ event }]);
  assert.equal(web.length, 1);
  const candidate = web[0] as { outputId: string; sourceInputIds?: string[]; recordOutput?: unknown; timeoutMs?: number; parameters: JsonObject };
  assert.equal(candidate.outputId, "web.dom.extract");
  assert.deepEqual(candidate.sourceInputIds, [WEB_AUTOMATION_INPUT_IDS.valueExtractionDefined]);
  // Capture replaces an array at the records path, and one value is not a list.
  assert.equal("recordOutput" in candidate, false, "a single value saves no dataset");
  assert.equal("timeoutMs" in candidate, false, "and reads one page, so it needs no scaled timeout");
  assert.deepEqual(candidate.parameters.extract, { mode: "text" });
});

test("a definition Core or the domain would refuse is proposed as nothing at all", async () => {
  // Each of these would otherwise reach Core and reject the candidate, with the
  // Flow already built around it.
  for (const [why, extraction] of [
    ["a field key Core refuses", { ...extractionDefinition, request: { ...extractionRequest, fields: { "Product name": { kind: "text" } } } }],
    ["a dataset id Core refuses", { ...extractionDefinition, datasetId: "products/4f1c" }],
    ["a request that reads nothing", { ...extractionDefinition, request: { item: "li.product", fields: {} } }]
  ] as Array<[string, JsonObject]>) {
    const { web } = await recordThroughCore([{ event: definedExtraction(extraction) }]);
    assert.deepEqual(web, [], why);
  }
});

test("W25: a page change recorded as a domain event between a DOM addition and the click after it stops the wait", async () => {
  const opener = withClickInput(click(1, 900, { url: DELAYED_UI, selector: "#open" }));
  const mutation = { latestEvidence: { kind: "dom.mutation", url: DELAYED_UI, title: "Delayed UI", sequence: 2, timestamp: 1_000, mutation: { added: 1, removed: 0, attributes: 0, text: 0 } } };
  const lateClick = withClickInput(click(3, 1_300, { url: DELAYED_UI, selector: "#late-action" }));
  const lateWait = { outputId: "web.dom.wait_for_selector", parameters: { selector: "#late-action", wait: { condition: "present" } }, confidence: 0.9, label: "Wait for element" };
  const mutationCall = (calls: readonly MapperCall[]) => calls.find(({ observation }) => observation.type === "observation" && observation.metadata.inputId === WEB_AUTOMATION_INPUT_IDS.recordingEvidence);
  const waits = (candidates: ReadonlyArray<{ outputId: string }>) => candidates.filter((candidate) => candidate.outputId === lateWait.outputId).length;

  const otherDocument = await recordThroughCore([{ event: opener }, { evidence: mutation }, { event: landing(`${DELAYED_UI}other`, opener, 2, 1_100) }, { event: lateClick }]);
  assert.equal(mapCall(mutationCall(otherDocument.calls)), null, "the landing names another document, so the click is not on the page the addition happened on");
  assert.equal(waits(otherDocument.web), 0, "and the proposal holds no wait");

  const sameDocument = await recordThroughCore([{ event: opener }, { evidence: mutation }, { event: landing(`${DELAYED_UI}#details`, opener, 2, 1_100) }, { event: lateClick }]);
  assert.deepEqual(mapCall(mutationCall(sameDocument.calls)), lateWait, "a landing on the same document, a fragment apart, keeps the wait");
  assert.equal(waits(sameDocument.web), 1, "and the proposal holds it once");
});
