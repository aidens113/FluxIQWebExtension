// src/domain.test.ts
import assert from "node:assert/strict";

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/artifacts.ts
function createBlankAutomationStudioFlow(input) {
  const now = input.now ?? Date.now();
  return {
    schemaVersion: "0.1",
    flowId: input.flowId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    name: input.name,
    ...input.description !== void 0 ? { description: input.description } : {},
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    ...input.metadata !== void 0 ? { metadata: input.metadata } : {}
  };
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/fixtures.ts
function createAutomationStudioFixture(nowMs = 1e3) {
  const recordingId = "recording.demo-open-and-confirm";
  const taskId = "task.demo-confirm";
  const signalRegistry = {
    schemaVersion: "0.1",
    registryId: "registry.demo",
    definitions: [
      {
        path: "app.dialog.visible",
        type: "boolean",
        namespace: "app",
        description: "Whether the primary confirmation dialog is visible.",
        comparator: { kind: "exact" },
        defaultWeight: 0.8,
        volatility: "normal",
        persistence: "snapshot",
        tags: ["ui", "dialog"]
      },
      {
        path: "app.dialog.ready",
        type: "boolean",
        namespace: "app",
        description: "Whether the dialog has finished loading and can accept input.",
        comparator: { kind: "exact" },
        defaultWeight: 0.7,
        volatility: "normal",
        persistence: "snapshot",
        tags: ["ui", "readiness"],
        derived: true,
        provenance: {
          extractorId: "demo.dialog-readiness",
          extractorVersion: "1.0",
          inputs: ["app.dialog.visible"]
        }
      },
      {
        path: "app.confirmed",
        type: "boolean",
        namespace: "app",
        description: "Whether the task confirmation has completed.",
        comparator: { kind: "exact" },
        defaultWeight: 0.9,
        volatility: "slow",
        persistence: "task",
        tags: ["task", "success"]
      }
    ]
  };
  const initialState2 = {
    timestamp: nowMs,
    namespaces: {
      app: {
        schemaId: "flux.demo.app",
        schemaVersion: "1.0",
        values: {
          "app.dialog.visible": {
            type: "boolean",
            value: false,
            observedAt: nowMs,
            sourceId: "source.state",
            confidence: 0.99,
            volatility: "normal",
            comparable: true
          },
          "app.confirmed": {
            type: "boolean",
            value: false,
            observedAt: nowMs,
            sourceId: "source.state",
            confidence: 0.99,
            volatility: "slow",
            comparable: true
          }
        }
      }
    }
  };
  const recording = {
    schemaVersion: "0.1",
    recordingId,
    taskId,
    startedAt: nowMs,
    endedAt: nowMs + 1800,
    environment: {
      id: "env.demo",
      label: "Demo Environment",
      kind: "fixture",
      domainId: null,
      capabilities: ["ui.actions", "ui.state"]
    },
    sources: [
      { id: "source.state", label: "Demo State Extractor", kind: "state", schemaId: "flux.demo.app", schemaVersion: "1.0" },
      { id: "source.operator", label: "Operator", kind: "action" },
      { id: "source.notes", label: "Recorder Notes", kind: "note" }
    ],
    actionChannels: [
      { id: "channel.ui", label: "UI Actions", actionTypes: ["ui.click"] }
    ],
    initialState: initialState2,
    timeline: [
      {
        type: "state_checkpoint",
        id: "entry.initial",
        recordingId,
        timestamp: nowMs,
        monotonicOffsetMs: 0,
        sequence: 0,
        sourceId: "source.state",
        state: initialState2
      },
      {
        type: "action",
        id: "entry.open-dialog",
        recordingId,
        timestamp: nowMs + 250,
        monotonicOffsetMs: 250,
        sequence: 1,
        sourceId: "source.operator",
        actionType: "ui.click",
        parameters: { button: "primary" },
        target: { type: "ui_element", id: "open-dialog", label: "Open Dialog" },
        origin: "operator",
        startedAt: nowMs + 250,
        completedAt: nowMs + 280,
        result: { status: "succeeded" }
      },
      {
        type: "state_delta",
        id: "entry.dialog-visible",
        recordingId,
        timestamp: nowMs + 500,
        monotonicOffsetMs: 500,
        sequence: 2,
        sourceId: "source.state",
        deltas: [
          {
            namespace: "app",
            path: "app.dialog.visible",
            change: "became_true",
            previous: { type: "boolean", value: false, observedAt: nowMs, sourceId: "source.state" },
            current: { type: "boolean", value: true, observedAt: nowMs + 500, sourceId: "source.state", confidence: 0.98 }
          },
          {
            namespace: "app",
            path: "app.dialog.ready",
            change: "became_true",
            current: {
              type: "boolean",
              value: true,
              observedAt: nowMs + 500,
              sourceId: "source.state",
              confidence: 0.94,
              provenance: {
                extractorId: "demo.dialog-readiness",
                extractorVersion: "1.0",
                inputs: ["app.dialog.visible"]
              }
            }
          }
        ]
      },
      {
        type: "note",
        id: "entry.wait-note",
        recordingId,
        timestamp: nowMs + 650,
        monotonicOffsetMs: 650,
        sequence: 3,
        sourceId: "source.notes",
        noteId: "note.wait-for-ready"
      },
      {
        type: "action",
        id: "entry.confirm",
        recordingId,
        timestamp: nowMs + 950,
        monotonicOffsetMs: 950,
        sequence: 4,
        sourceId: "source.operator",
        actionType: "ui.click",
        parameters: { button: "primary" },
        target: { type: "ui_element", id: "confirm", label: "Confirm" },
        origin: "operator",
        startedAt: nowMs + 950,
        completedAt: nowMs + 980,
        result: { status: "succeeded" }
      },
      {
        type: "state_delta",
        id: "entry.confirmed",
        recordingId,
        timestamp: nowMs + 1200,
        monotonicOffsetMs: 1200,
        sequence: 5,
        sourceId: "source.state",
        deltas: [
          {
            namespace: "app",
            path: "app.confirmed",
            change: "became_true",
            previous: { type: "boolean", value: false, observedAt: nowMs, sourceId: "source.state" },
            current: { type: "boolean", value: true, observedAt: nowMs + 1200, sourceId: "source.state", confidence: 0.99 }
          }
        ]
      }
    ],
    notes: [
      {
        id: "note.wait-for-ready",
        timestamp: nowMs + 650,
        text: "Wait for the dialog to finish loading before confirming.",
        source: "typed",
        scope: "action",
        linkedEntryIds: ["entry.confirm"],
        confidence: 1
      }
    ],
    metadata: {}
  };
  const normalizedTimeline = {
    schemaVersion: "0.1",
    normalizedTimelineId: "timeline.demo-open-and-confirm.normalized",
    recordingId,
    taskId,
    sourceRecording: {
      layer: "raw_recording",
      artifactId: recordingId
    },
    initialState: initialState2,
    timeline: recording.timeline,
    issues: [],
    generatedAt: nowMs + 1300,
    metadata: {
      domainId: null
    }
  };
  const openToConfirmEdge = {
    id: "edge.open-to-confirm",
    fromNodeId: "node.open-dialog",
    toNodeId: "node.confirm",
    probability: 0.95
  };
  const policy = {
    schemaVersion: "0.1",
    policyId: "policy.demo-confirm",
    taskId,
    version: "0.1.0",
    nodes: [
      {
        id: "node.open-dialog",
        label: "Open dialog",
        eligibility: { type: "all", conditions: [{ signalPath: "app.dialog.visible", operator: "equals", expected: false, required: true }] },
        actions: [
          {
            id: "policy-action.open-dialog",
            actionType: "ui.click",
            parameters: { button: "primary" },
            target: { type: "ui_element", id: "open-dialog", label: "Open Dialog" },
            sourceEvidence: [{ layer: "raw_recording", artifactId: recordingId, entryId: "entry.open-dialog" }]
          }
        ],
        successConditions: { type: "all", conditions: [{ signalPath: "app.dialog.visible", operator: "equals", expected: true, required: true }] },
        timeout: { timeoutMs: 2e3, settleMs: 100 },
        retry: { maxAttempts: 1 },
        recovery: { strategy: "rescore_nodes", maxRecoveryAttempts: 2 },
        outgoingEdges: [openToConfirmEdge],
        sourceEvidence: [{ layer: "raw_recording", artifactId: recordingId, entryId: "entry.open-dialog" }],
        generatedMetadata: { generatedBy: "signal_miner", generatedAt: nowMs + 1500, confidence: 0.8 }
      },
      {
        id: "node.confirm",
        label: "Confirm",
        eligibility: { type: "all", conditions: [{ signalPath: "app.dialog.visible", operator: "equals", expected: true, required: true }] },
        readinessConditions: { type: "all", conditions: [{ signalPath: "app.dialog.ready", operator: "equals", expected: true, required: true }] },
        actions: [
          {
            id: "policy-action.confirm",
            actionType: "ui.click",
            parameters: { button: "primary" },
            target: { type: "ui_element", id: "confirm", label: "Confirm" },
            sourceEvidence: [{ layer: "raw_recording", artifactId: recordingId, entryId: "entry.confirm" }]
          }
        ],
        successConditions: { type: "all", conditions: [{ signalPath: "app.confirmed", operator: "equals", expected: true, required: true }] },
        timeout: { timeoutMs: 2e3, settleMs: 100 },
        retry: { maxAttempts: 1 },
        recovery: { strategy: "pause", maxRecoveryAttempts: 0 },
        outgoingEdges: [],
        sourceEvidence: [
          { layer: "raw_recording", artifactId: recordingId, entryId: "entry.confirm" },
          { layer: "raw_recording", artifactId: recordingId, noteId: "note.wait-for-ready" }
        ],
        generatedMetadata: { generatedBy: "signal_miner", generatedAt: nowMs + 1500, confidence: 0.85 }
      }
    ],
    edges: [openToConfirmEdge],
    sourceEvidence: [{ layer: "raw_recording", artifactId: recordingId }],
    generatedMetadata: { generatedBy: "signal_miner", generatedAt: nowMs + 1500, confidence: 0.82 },
    metadata: {}
  };
  const learnedTaskModel = {
    schemaVersion: "0.1",
    learnedTaskModelId: "model.demo-confirm.0-1-0",
    taskId,
    version: "0.1.0",
    actionClusters: [
      {
        id: "cluster.open-dialog",
        label: "Open dialog",
        actionTemplate: policy.nodes[0].actions[0],
        positiveRequirements: [
          { signalPath: "app.dialog.visible", operator: "equals", expected: false, required: true }
        ],
        negativeRequirements: [],
        expectedEffects: [
          {
            signalPath: "app.dialog.visible",
            condition: { signalPath: "app.dialog.visible", operator: "equals", expected: true, required: true },
            probability: 0.95,
            evidence: [{ layer: "raw_recording", artifactId: recordingId, entryId: "entry.dialog-visible" }]
          }
        ],
        possibleSideEffects: [],
        confidence: 0.8,
        sourceOccurrences: ["entry.open-dialog"]
      },
      {
        id: "cluster.confirm",
        label: "Confirm",
        actionTemplate: policy.nodes[1].actions[0],
        positiveRequirements: [
          { signalPath: "app.dialog.ready", operator: "equals", expected: true, required: true }
        ],
        negativeRequirements: [],
        expectedEffects: [
          {
            signalPath: "app.confirmed",
            condition: { signalPath: "app.confirmed", operator: "equals", expected: true, required: true },
            probability: 0.97,
            evidence: [{ layer: "raw_recording", artifactId: recordingId, entryId: "entry.confirmed" }]
          }
        ],
        possibleSideEffects: [],
        confidence: 0.85,
        sourceOccurrences: ["entry.confirm"]
      }
    ],
    transitions: [
      {
        id: "transition.open-to-confirm",
        fromClusterId: "cluster.open-dialog",
        toClusterId: "cluster.confirm",
        probability: 0.95,
        evidence: [{ layer: "raw_recording", artifactId: recordingId }]
      }
    ],
    invariants: [],
    unresolvedQuestions: [],
    sourceRecordings: [recordingId],
    sourceMiningRuns: [],
    generatedAt: nowMs + 1400,
    metadata: {
      domainId: null
    }
  };
  return { signalRegistry, recording, normalizedTimeline, learnedTaskModel, policy };
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/state-diff.ts
function diffStateSnapshots(previous, current, options = {}) {
  const deltas = [];
  const namespaces = /* @__PURE__ */ new Set([...Object.keys(previous.namespaces), ...Object.keys(current.namespaces)]);
  for (const namespace of [...namespaces].sort()) {
    const previousValues = previous.namespaces[namespace]?.values ?? {};
    const currentValues = current.namespaces[namespace]?.values ?? {};
    const paths = /* @__PURE__ */ new Set([...Object.keys(previousValues), ...Object.keys(currentValues)]);
    for (const path3 of [...paths].sort()) {
      const before = previousValues[path3];
      const after = currentValues[path3];
      const change = classifyStateChange(before, after);
      if (change === "stable" && !options.includeStable) continue;
      deltas.push({
        namespace,
        path: path3,
        ...before !== void 0 ? { previous: before } : {},
        ...after !== void 0 ? { current: after } : {},
        change,
        confidence: Math.min(before?.confidence ?? 1, after?.confidence ?? 1)
      });
    }
  }
  return deltas;
}
function classifyStateChange(previous, current) {
  if (!previous && current) return "added";
  if (previous && !current) return "removed";
  if (!previous || !current) return "stable";
  if (JSON.stringify(previous.value) === JSON.stringify(current.value) && previous.type === current.type) return "stable";
  if (typeof previous.value === "number" && typeof current.value === "number") {
    if (current.value > previous.value) return "increased";
    if (current.value < previous.value) return "decreased";
  }
  if (previous.value !== true && current.value === true) return "became_true";
  if (previous.value !== false && current.value === false) return "became_false";
  return "changed";
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/recording-framework.ts
function createRecordingSession(input) {
  const startedAt = input.startedAt ?? Date.now();
  const environment = {
    id: input.environment?.id ?? "environment.unspecified",
    label: input.environment?.label ?? "Unspecified environment",
    kind: input.environment?.kind ?? "unspecified",
    ...input.environment?.domainId !== void 0 ? { domainId: input.environment.domainId } : { domainId: null },
    ...input.environment?.capabilities !== void 0 ? { capabilities: input.environment.capabilities } : {},
    ...input.environment?.metadata !== void 0 ? { metadata: input.environment.metadata } : {}
  };
  return {
    schemaVersion: "0.1",
    recordingId: input.recordingId,
    ...input.taskId !== void 0 ? { taskId: input.taskId } : {},
    startedAt,
    environment,
    sources: input.sources?.length ? input.sources : [{ id: "source.host", kind: "event", label: "Host" }],
    actionChannels: input.actionChannels ?? [],
    initialState: input.initialState,
    timeline: [],
    notes: [],
    metadata: input.metadata ?? {}
  };
}
function appendRecordingEntry(recording, input) {
  const timestamp = input.timestamp ?? Date.now();
  const sequence = nextTimelineSequence(recording);
  const entry = {
    ...input,
    id: uniqueTimelineEntryId(recording, input.id ?? `entry.${sequence}`),
    recordingId: recording.recordingId,
    timestamp,
    monotonicOffsetMs: input.monotonicOffsetMs ?? Math.max(0, timestamp - recording.startedAt),
    sequence,
    sourceId: input.sourceId ?? recording.sources[0]?.id ?? "source.host"
  };
  return { ...recording, timeline: [...recording.timeline, entry] };
}
function appendRecordingStateCheckpoint(recording, state, input = {}) {
  const entry = {
    ...baseAppendFields(recording, input),
    recordingId: recording.recordingId,
    sequence: nextTimelineSequence(recording),
    monotonicOffsetMs: 0,
    type: "state_checkpoint",
    state
  };
  return appendTimelineEntry(recording, entry);
}
function appendRecordingStateDelta(recording, previous, current, input = {}) {
  const entry = {
    ...baseAppendFields(recording, input),
    recordingId: recording.recordingId,
    sequence: nextTimelineSequence(recording),
    monotonicOffsetMs: 0,
    type: "state_delta",
    deltas: diffStateSnapshots(previous, current)
  };
  return appendTimelineEntry(recording, entry);
}
function appendRecordingNote(recording, note) {
  const timestamp = note.timestamp ?? Date.now();
  const id = note.id ?? `note.${recording.notes.length + 1}`;
  const nextNote = { ...note, id, timestamp };
  const withNote = { ...recording, notes: [...recording.notes, nextNote] };
  const entry = {
    ...baseAppendFields(withNote, { id: `entry.${id}`, timestamp }),
    recordingId: withNote.recordingId,
    sequence: nextTimelineSequence(withNote),
    monotonicOffsetMs: 0,
    type: "note",
    noteId: id
  };
  return appendTimelineEntry(withNote, entry);
}
function finalizeRecordingSession(recording, endedAt = Date.now()) {
  return { ...recording, endedAt: Math.max(endedAt, recording.startedAt) };
}
function appendTimelineEntry(recording, entry) {
  const next = {
    ...entry,
    id: uniqueTimelineEntryId(recording, entry.id),
    recordingId: recording.recordingId,
    sequence: nextTimelineSequence(recording),
    monotonicOffsetMs: Math.max(0, entry.timestamp - recording.startedAt)
  };
  return { ...recording, timeline: [...recording.timeline, next] };
}
function baseAppendFields(recording, input) {
  const timestamp = input.timestamp ?? Date.now();
  return {
    id: uniqueTimelineEntryId(recording, input.id ?? `entry.${nextTimelineSequence(recording)}`),
    timestamp,
    sourceId: input.sourceId ?? recording.sources[0]?.id ?? "source.host",
    ...input.metadata !== void 0 ? { metadata: input.metadata } : {}
  };
}
function nextTimelineSequence(recording) {
  return recording.timeline.reduce((max, entry) => Math.max(max, entry.sequence), -1) + 1;
}
function uniqueTimelineEntryId(recording, preferredId) {
  const existing = new Set(recording.timeline.map((entry) => entry.id));
  if (!existing.has(preferredId)) return preferredId;
  let suffix = 2;
  while (existing.has(`${preferredId}.${suffix}`)) suffix += 1;
  return `${preferredId}.${suffix}`;
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/recording-domain.ts
var RecordingDomainRegistry = class {
  domains = /* @__PURE__ */ new Map();
  register(definition) {
    const domainId = definition.domainId.trim();
    if (!domainId) throw new Error("Recording domain ID is required.");
    if (!definition.events.length) throw new Error(`Recording domain ${domainId} must define at least one event type.`);
    const seen = /* @__PURE__ */ new Set();
    for (const event3 of definition.events) {
      if (!event3.eventType.trim()) throw new Error(`Recording domain ${domainId} has an event without an eventType.`);
      if (seen.has(event3.eventType)) throw new Error(`Recording domain ${domainId} defines duplicate event type: ${event3.eventType}`);
      seen.add(event3.eventType);
    }
    const normalized = { ...definition, domainId };
    this.domains.set(domainId, normalized);
    return normalized;
  }
  unregister(domainId) {
    return this.domains.delete(domainId);
  }
  list() {
    return [...this.domains.values()].sort((left, right) => left.label.localeCompare(right.label));
  }
  get(domainId) {
    return this.domains.get(domainId);
  }
  getEvent(domainId, eventType) {
    return this.get(domainId)?.events.find((event3) => event3.eventType === eventType);
  }
  validate(input) {
    const issues = [];
    if (!input.domainId.trim()) {
      issues.push({ path: "domainId", code: "domain.required", message: "Recording event domainId is required." });
      return { ok: false, issues };
    }
    const domain = this.get(input.domainId);
    if (!domain) {
      issues.push({ path: "domainId", code: "domain.unknown", message: `Unknown recording domain: ${input.domainId}` });
      return { ok: false, issues };
    }
    const event3 = this.getEvent(input.domainId, input.eventType);
    if (!event3) {
      issues.push({ path: "eventType", code: "event.unknown", message: `Domain ${input.domainId} does not accept event type: ${input.eventType}` });
      return { ok: false, issues };
    }
    if (event3.payloadSchema) issues.push(...validateSchema(input.payload ?? {}, event3.payloadSchema, "payload"));
    if (event3.metadataSchema) issues.push(...validateSchema(input.metadata ?? {}, event3.metadataSchema, "metadata"));
    return { ok: issues.length === 0, issues };
  }
};
async function processRecordingDomainEvent(registry, recording, input) {
  const validation2 = registry.validate(input);
  const domain = registry.get(input.domainId);
  const definition = domain ? registry.getEvent(input.domainId, input.eventType) : void 0;
  if (!validation2.ok || !domain || !definition) {
    return { accepted: false, recording, stateDeltas: [], issues: validation2.issues };
  }
  const timestamp = input.timestamp ?? Date.now();
  const entryId = input.eventId ?? `entry.${recording.timeline.length}`;
  const eventRecording = appendRecordingEntry(recording, {
    type: "domain_event",
    id: entryId,
    eventType: input.eventType,
    timestamp,
    ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
    ...input.eventId !== void 0 ? { correlationId: input.eventId } : {},
    payload: compactJsonObject({
      ...input.target !== void 0 ? { target: input.target } : {},
      ...input.payload !== void 0 ? { payload: input.payload } : {}
    }),
    metadata: compactJsonObject({
      domainId: input.domainId,
      domainLabel: domain.label,
      eventLabel: definition.label,
      ...input.metadata ?? {}
    })
  });
  const previousState = latestStateSnapshot(eventRecording);
  const context = { recording: eventRecording, event: input, previousState, definition, domain };
  let next = eventRecording;
  let state;
  let stateMetadata;
  const reducerOutput = definition.stateReducer ? await definition.stateReducer(context) : void 0;
  if (reducerOutput && "timestamp" in reducerOutput && "namespaces" in reducerOutput) {
    state = reducerOutput;
  } else if (reducerOutput) {
    state = reducerOutput.state;
    stateMetadata = reducerOutput.metadata;
  }
  if (state) {
    next = appendRecordingStateDelta(next, previousState, state, {
      timestamp,
      ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
      metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, ...stateMetadata ?? {} })
    });
    next = appendRecordingStateCheckpoint(next, state, {
      timestamp,
      ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
      metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, reason: "domain-event" })
    });
  }
  const observation = definition.observationExtractor?.(context);
  if (observation) {
    next = appendRecordingEntry(next, {
      type: "observation",
      observationType: observation.observationType,
      timestamp,
      ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
      ...observation.signals ? { signals: observation.signals } : {},
      ...observation.payload ? { payload: observation.payload } : {},
      metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, ...observation.metadata ?? {} })
    });
  }
  const stateDeltaEntry = findLastTimelineEntry(next, "state_delta");
  const stateDeltas = stateDeltaEntry?.type === "state_delta" ? stateDeltaEntry.deltas : [];
  return { accepted: true, recording: next, entryId, domain, definition, stateDeltas, ...state ? { state } : {}, issues: [] };
}
function latestStateSnapshot(recording) {
  const checkpoint = findLastTimelineEntry(recording, "state_checkpoint");
  return checkpoint?.type === "state_checkpoint" ? checkpoint.state : recording.initialState;
}
function findLastTimelineEntry(recording, type) {
  for (let index = recording.timeline.length - 1; index >= 0; index -= 1) {
    const entry = recording.timeline[index];
    if (entry?.type === type) return entry;
  }
  return void 0;
}
function validateSchema(value, schema, path3) {
  const issues = [];
  if (value === void 0 || value === null) {
    if (schema.required) issues.push({ path: path3, code: "value.required", message: `${schema.label ?? path3} is required.` });
    if (value === null && schema.type !== "null" && schema.type !== "json") issues.push({ path: path3, code: "value.type", message: `${schema.label ?? path3} must be ${schema.type}.` });
    return issues;
  }
  if (!matchesSchemaType(value, schema.type)) {
    issues.push({ path: path3, code: "value.type", message: `${schema.label ?? path3} must be ${schema.type}.` });
    return issues;
  }
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    issues.push({ path: path3, code: "value.enum", message: `${schema.label ?? path3} must be one of the allowed values.` });
  }
  if (schema.type === "object" && schema.properties) {
    const object = isJsonObject(value) ? value : {};
    for (const [key, child] of Object.entries(schema.properties)) {
      issues.push(...validateSchema(object[key], child, `${path3}.${key}`));
    }
  }
  if (schema.type === "array" && schema.items && Array.isArray(value)) {
    value.forEach((item, index) => issues.push(...validateSchema(item, schema.items, `${path3}[${index}]`)));
  }
  return issues;
}
function matchesSchemaType(value, type) {
  if (type === "json") return true;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isJsonObject(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "null") return value === null;
  return typeof value === type;
}
function isJsonObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/shared/definition.ts
function defineBuiltinNode(definition) {
  const normalized = normalizeVisualPorts(definition);
  return {
    ...normalized,
    origin: "builtin",
    implementationKey: definition.implementationKey ?? definition.id
  };
}
function normalizeVisualPorts(definition) {
  const inputs = normalizeVisualInputs(definition);
  const outputs = normalizeVisualOutputs(definition);
  return { ...definition, inputs, outputs };
}
function normalizeVisualInputs(definition) {
  const inputs = definition.inputs.map((port) => normalizePortRole(port, "target"));
  if (definition.id === "builtin.control.start") return inputs;
  if (inputs.some((port) => port.id === "in" || port.role === "control")) return inputs;
  return [controlInput(), ...inputs];
}
function normalizeVisualOutputs(definition) {
  if (definition.id === "builtin.control.end") return definition.outputs.map((port) => normalizePortRole(port, "source"));
  const outputs = definition.outputs.map((port) => normalizePortRole(port, "source"));
  if (outputs.some((port) => port.role === "branch")) return outputs;
  if (!outputs.some((port) => port.id === "success" || port.role === "success")) outputs.unshift(successOutput());
  if (!outputs.some((port) => port.id === "failed" || port.role === "failure")) {
    const insertAt = outputs.some((port) => port.id === "success") ? 1 : outputs.length;
    outputs.splice(insertAt, 0, failedOutput());
  }
  return outputs;
}
function normalizePortRole(port, direction) {
  if (port.role) return port;
  if (port.id === "in") return { ...port, role: "control" };
  if (port.id === "success") return { ...port, role: "success" };
  if (port.id === "failed" || port.id === "failure") return { ...port, role: "failure" };
  if (port.id === "error") return { ...port, role: "error" };
  if (direction === "source" && ["true", "false", "body", "done", "case", "default", "approved", "rejected", "timeout", "recovered"].includes(port.id)) return { ...port, role: "branch" };
  if (direction === "source") return { ...port, role: "data" };
  return port;
}
function emptyResult(outputs = {}) {
  return { status: "success", route: "success", outputs };
}
function controlInput(label = "In") {
  return { id: "in", label, valueType: "any", role: "control" };
}
function successOutput(label = "Success") {
  return { id: "success", label, valueType: "any", role: "success" };
}
function failedOutput(label = "Failed") {
  return { id: "failed", label, valueType: "any", role: "failure" };
}
function inputValue(context, id) {
  return context.inputs[id] ?? context.parameters[id];
}
function numberValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function booleanValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
  return Boolean(value);
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function stringValue(value, fallback = "") {
  if (value === void 0 || value === null) return fallback;
  return String(value);
}
function objectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}
function jsonValue(value) {
  if (value === void 0) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonValue(entry)]));
  }
  return String(value);
}
function getPathValue(source, path3) {
  const parts = stringValue(path3).split(".").map((part) => part.trim()).filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) current = current[part];
    else return void 0;
  }
  return current;
}
function setPathValue(source, path3, value) {
  const parts = stringValue(path3).split(".").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return source;
  const next = { ...source };
  let cursor = next;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    const child = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
    cursor[part] = child;
    cursor = child;
  }
  cursor[parts[parts.length - 1]] = jsonValue(value);
  return next;
}
function compareBasic(left, right, operator) {
  switch (stringValue(operator, "equals")) {
    case "not-equals":
      return left !== right;
    case "greater-than":
      return numberValue(left) > numberValue(right);
    case "greater-than-or-equal":
      return numberValue(left) >= numberValue(right);
    case "less-than":
      return numberValue(left) < numberValue(right);
    case "less-than-or-equal":
      return numberValue(left) <= numberValue(right);
    case "contains":
      return String(left ?? "").includes(String(right ?? ""));
    case "starts-with":
      return String(left ?? "").startsWith(String(right ?? ""));
    case "ends-with":
      return String(left ?? "").endsWith(String(right ?? ""));
    case "exists":
      return left !== void 0 && left !== null && left !== "";
    case "equals":
    default:
      return left === right;
  }
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/shared.ts
function routeFromCondition(context, trueRoute = "true", falseRoute = "false") {
  return booleanValue(context.inputs.condition ?? context.parameters.condition) ? trueRoute : falseRoute;
}
function maxIterations(context) {
  return Math.max(0, Math.floor(numberValue(context.parameters.maxIterations, 25)));
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/branch.ts
var branchNode = defineBuiltinNode({
  id: "builtin.control.branch",
  label: "Branch",
  description: "Choose one of two paths from a yes/no condition.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" }
  ],
  parameters: [
    { id: "invert", label: "Swap Yes and No paths", description: "When enabled, true goes to No and false goes to Yes.", valueType: "boolean", defaultValue: false }
  ],
  icon: "git-branch",
  execute: (context) => {
    const route = routeFromCondition(context, "true", "false");
    const finalRoute = context.parameters.invert === true ? route === "true" ? "false" : "true" : route;
    return { status: "success", route: String(finalRoute), outputs: {} };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/end.ts
var endNode = defineBuiltinNode({
  id: "builtin.control.end",
  label: "End",
  description: "Terminal point for a policy or routine graph.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [],
  parameters: [
    {
      id: "resultStatus",
      label: "Final result",
      description: "How this policy or routine should be marked when execution reaches this End node.",
      valueType: "string",
      defaultValue: "success",
      options: [
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" }
      ]
    },
    { id: "message", label: "End note", description: "Optional text saved with the final result.", valueType: "string", defaultValue: "", ui: { control: "textarea", placeholder: "Optional note for this ending" } }
  ],
  icon: "circle-stop",
  execute: (context) => ({ status: context.parameters.resultStatus === "failed" ? "failed" : context.parameters.resultStatus === "skipped" ? "skipped" : "success", route: "end", outputs: { message: context.parameters.message ?? "" } })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/loop.ts
var loopNode = defineBuiltinNode({
  id: "builtin.control.loop",
  label: "Loop",
  description: "Repeat a section while a condition is still true.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "body", label: "Repeat", valueType: "any" },
    { id: "done", label: "Done", valueType: "any" }
  ],
  parameters: [
    { id: "maxIterations", label: "Maximum repeats", description: "Safety limit for how many times this loop may run.", valueType: "number", defaultValue: 25 },
    { id: "startIndex", label: "Starting count", description: "The first count value exposed to the loop body.", valueType: "number", defaultValue: 0 },
    { id: "increment", label: "Count by", description: "How much the loop count changes after each repeat.", valueType: "number", defaultValue: 1 }
  ],
  icon: "repeat",
  execute: (context) => ({ status: "success", route: routeFromCondition(context, "body", "done"), outputs: { maxIterations: maxIterations(context), startIndex: context.parameters.startIndex ?? 0, increment: context.parameters.increment ?? 1 } })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/merge.ts
var mergeNode = defineBuiltinNode({
  id: "builtin.control.merge",
  label: "Merge",
  description: "Join several branches back into one path.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "branches", label: "Branches", valueType: "any", multiple: true }],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    {
      id: "mergeMode",
      label: "When to continue",
      description: "Choose whether this node continues after the first branch finishes, after all branches finish, or only with successful branch results.",
      valueType: "string",
      defaultValue: "first",
      options: [
        { label: "As soon as one branch finishes", value: "first" },
        { label: "After every branch finishes", value: "all" },
        { label: "After successful branches only", value: "successful" }
      ]
    }
  ],
  icon: "merge",
  execute: (context) => emptyResult({ next: context.inputs.branches ?? null, mergeMode: context.parameters.mergeMode ?? "first" })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/parallel.ts
var parallelNode = defineBuiltinNode({
  id: "builtin.control.parallel",
  label: "Parallel",
  description: "Start multiple branches at the same time.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [{ id: "branches", label: "Branches", valueType: "any", multiple: true }],
  parameters: [
    { id: "branchCount", label: "Number of branches", description: "How many parallel paths this node should create.", valueType: "number", defaultValue: 2 },
    {
      id: "failureMode",
      label: "If one branch fails",
      description: "Choose whether the routine stops immediately or waits to collect every branch result.",
      valueType: "string",
      defaultValue: "fail-fast",
      options: [
        { label: "Stop the others", value: "fail-fast" },
        { label: "Wait for all results", value: "collect-all" }
      ]
    }
  ],
  icon: "workflow",
  execute: (context) => emptyResult({ branches: context.inputs.in ?? null, branchCount: context.parameters.branchCount ?? 2, failureMode: context.parameters.failureMode ?? "fail-fast" })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/start.ts
var startNode = defineBuiltinNode({
  id: "builtin.control.start",
  label: "Start",
  description: "Entry point for a policy or routine graph.",
  class: "control-flow",
  scope: "both",
  inputs: [],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    { id: "label", label: "Start label", description: "Friendly name shown for this run entry.", valueType: "string", defaultValue: "Start", ui: { control: "text", placeholder: "Start label" } },
    { id: "emitTimestamp", label: "Include start time", description: "Attach the current time to the value sent from this node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "play",
  execute: (context) => emptyResult({ next: true, label: context.parameters.label ?? "Start", startedAt: context.parameters.emitTimestamp === false ? null : context.now?.() ?? Date.now() })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/switch.ts
var switchNode = defineBuiltinNode({
  id: "builtin.control.switch",
  label: "Switch",
  description: "Choose a path by matching one value against a list of cases.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "any", required: true }],
  outputs: [
    { id: "case", label: "Cases", valueType: "any", multiple: true },
    { id: "default", label: "Default", valueType: "any" },
    { id: "value", label: "Matched value", valueType: "any" }
  ],
  parameters: [
    { id: "cases", label: "Case list", description: "Values to match. Each item can include a value and optional route name.", valueType: "array", defaultValue: [] },
    { id: "caseSensitive", label: "Match capitalization exactly", description: "When disabled, text like Ready and ready are treated the same.", valueType: "boolean", defaultValue: true },
    {
      id: "matchMode",
      label: "How to match",
      description: "Equals requires an exact match. Contains matches when the input text includes the case text.",
      valueType: "string",
      defaultValue: "equals",
      options: [
        { label: "Equals", value: "equals" },
        { label: "Contains", value: "contains" }
      ]
    }
  ],
  icon: "split",
  execute: (context) => {
    const cases = Array.isArray(context.parameters.cases) ? context.parameters.cases : [];
    const value = context.parameters.caseSensitive === false ? String(context.inputs.value ?? "").toLowerCase() : context.inputs.value;
    const match = cases.find((item) => {
      if (!(typeof item === "object" && item !== null && "value" in item)) return false;
      const candidate = context.parameters.caseSensitive === false ? String(item.value ?? "").toLowerCase() : item.value;
      return context.parameters.matchMode === "contains" ? String(value ?? "").includes(String(candidate ?? "")) : candidate === value;
    });
    return { status: "success", route: match ? "case" : "default", outputs: { value: context.inputs.value ?? null, matched: match ?? null } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/control-flow/index.ts
var controlFlowNodes = [startNode, endNode, branchNode, switchNode, parallelNode, mergeNode, loopNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/constant.ts
var constantNode = defineBuiltinNode({
  id: "builtin.data.constant",
  label: "Constant",
  description: "Provide a fixed value to the graph.",
  class: "data",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "any" }],
  parameters: [
    { id: "value", label: "Value to send", description: "The fixed value this node outputs every time it runs.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    {
      id: "valueLabel",
      label: "Display name",
      description: "Friendly label shown on the node for this constant.",
      valueType: "string",
      defaultValue: "Constant",
      ui: { control: "text", placeholder: "Display name" }
    }
  ],
  icon: "braces",
  execute: (context) => emptyResult({ value: context.parameters.value ?? null })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/filter-list.ts
var filterListNode = defineBuiltinNode({
  id: "builtin.data.filter-list",
  label: "Filter List",
  description: "Keep only list items that match a simple rule.",
  class: "data",
  scope: "both",
  inputs: [{ id: "items", label: "Items", valueType: "array", required: true }],
  outputs: [{ id: "items", label: "Items", valueType: "array" }],
  parameters: [
    { id: "path", label: "Field to check", description: "Optional field inside each item, such as status or user.name. Leave blank to check the whole item.", valueType: "string", defaultValue: "", ui: { control: "path", placeholder: "field.path" } },
    {
      id: "operator",
      label: "Match rule",
      description: "How each item is compared with the value below.",
      valueType: "string",
      defaultValue: "exists",
      options: [
        { label: "Field exists", value: "exists" },
        { label: "Equals", value: "equals" },
        { label: "Does not equal", value: "not-equals" },
        { label: "Greater than", value: "greater-than" },
        { label: "Less than", value: "less-than" },
        { label: "Contains", value: "contains" }
      ]
    },
    { id: "value", label: "Value to compare", description: "The value each item is checked against.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    {
      id: "onInvalid",
      label: "If the field is missing",
      description: "Choose whether items with no matching field should stay in the list.",
      valueType: "string",
      defaultValue: "exclude",
      options: [
        { label: "Remove item", value: "exclude" },
        { label: "Keep item", value: "include" }
      ]
    }
  ],
  icon: "list-filter",
  execute: (context) => {
    const items = arrayValue(context.inputs.items);
    const path3 = context.parameters.path;
    const filtered = items.filter((item) => {
      const left = path3 ? getPathValue(item, path3) : item;
      const result = compareBasic(left, context.parameters.value, context.parameters.operator);
      return result || left === void 0 && context.parameters.onInvalid === "include";
    });
    return emptyResult({ items: filtered });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/shared.ts
function variableName(value) {
  return String(value ?? "").trim();
}
function readVariable(variables, name) {
  return variables?.get(name) ?? null;
}
function writeVariable(variables, name, value) {
  variables?.set(name, value);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/get-variable.ts
var getVariableNode = defineBuiltinNode({
  id: "builtin.data.get-variable",
  label: "Get Variable",
  description: "Read a named runtime variable.",
  class: "data",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "any" }],
  parameters: [
    { id: "name", label: "Variable name", description: "The saved workflow value to read.", valueType: "string", required: true, ui: { control: "reference", referenceType: "variable", placeholder: "variableName" } },
    { id: "defaultValue", label: "If variable is missing", description: "Value to use when the variable has not been set yet.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "required", label: "Fail when missing", description: "When enabled, a missing variable sends execution to the failed path.", valueType: "boolean", defaultValue: false }
  ],
  icon: "database",
  execute: (context) => {
    const name = variableName(context.parameters.name);
    const value = readVariable(context.variables, name);
    if (value === null && context.parameters.required === true) return { status: "failed", route: "failed", outputs: { value: context.parameters.defaultValue ?? null } };
    return emptyResult({ value: value ?? context.parameters.defaultValue ?? null });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/map-object.ts
var mapObjectNode = defineBuiltinNode({
  id: "builtin.data.map-object",
  label: "Map Object",
  description: "Create or reshape fields on an object.",
  class: "data",
  scope: "both",
  inputs: [{ id: "object", label: "Object", valueType: "object", required: true }],
  outputs: [{ id: "object", label: "Object", valueType: "object" }],
  parameters: [
    { id: "mapping", label: "Field changes", description: "Fields to add, pick, or rename depending on the selected mode.", valueType: "object", defaultValue: {} },
    {
      id: "mode",
      label: "How to change the object",
      description: "Choose whether to add fields, keep selected fields, or copy values into new field paths.",
      valueType: "string",
      defaultValue: "merge",
      options: [
        { label: "Add or replace fields", value: "merge" },
        { label: "Keep only selected fields", value: "pick" },
        { label: "Copy fields to new names", value: "rename" }
      ]
    }
  ],
  icon: "file-json",
  execute: (context) => {
    const source = objectValue(context.inputs.object);
    const mapping = objectValue(context.parameters.mapping);
    if (context.parameters.mode === "pick") {
      return emptyResult({ object: Object.fromEntries(Object.entries(mapping).map(([target, path3]) => [target, getPathValue(source, path3)])) });
    }
    if (context.parameters.mode === "rename") {
      let next = { ...source };
      for (const [target, path3] of Object.entries(mapping)) next = setPathValue(next, target, getPathValue(source, path3));
      return emptyResult({ object: next });
    }
    return emptyResult({ object: { ...source, ...mapping } });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/set-variable.ts
var setVariableNode = defineBuiltinNode({
  id: "builtin.data.set-variable",
  label: "Set Variable",
  description: "Write a named runtime variable.",
  class: "data",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "any", required: true }],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    { id: "name", label: "Variable name", description: "The saved workflow value to create or update.", valueType: "string", required: true, ui: { control: "reference", referenceType: "variable", placeholder: "variableName" } },
    {
      id: "writeMode",
      label: "How to save the value",
      description: "Choose whether to replace the old value, merge object fields, or append to a list.",
      valueType: "string",
      defaultValue: "replace",
      options: [
        { label: "Replace existing value", value: "replace" },
        { label: "Merge into object", value: "merge-object" },
        { label: "Add to list", value: "append-list" }
      ]
    }
  ],
  icon: "save",
  execute: (context) => {
    const name = variableName(context.parameters.name);
    const current = context.variables?.get(name);
    const incoming = jsonValue(context.inputs.value);
    let value = incoming;
    if (context.parameters.writeMode === "merge-object") value = { ...typeof current === "object" && current && !Array.isArray(current) ? current : {}, ...typeof incoming === "object" && incoming && !Array.isArray(incoming) ? incoming : {} };
    if (context.parameters.writeMode === "append-list") value = [...Array.isArray(current) ? current : [], incoming];
    writeVariable(context.variables, name, value);
    return emptyResult({ next: value });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/data/index.ts
var dataNodes = [constantNode, getVariableNode, setVariableNode, mapObjectNode, filterListNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/database/shared.ts
function collectionName(value) {
  return String(value ?? "").trim();
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/database/insert.ts
var databaseInsertNode = defineBuiltinNode({
  id: "builtin.database.insert",
  label: "Create Record",
  description: "Ask a host database adapter to create one record.",
  class: "database",
  scope: "both",
  inputs: [{ id: "record", label: "Record", valueType: "object", required: true }],
  outputs: [{ id: "record", label: "Record", valueType: "object" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table where the new record should be created.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "upsert", label: "Update matching record instead", description: "If a matching record already exists, update it instead of creating a duplicate.", valueType: "boolean", defaultValue: false },
    { id: "conflictKey", label: "Match on field", description: "Field used to find an existing record when update-matching is enabled.", valueType: "string", defaultValue: "", ui: { control: "field", placeholder: "uniqueField" } },
    { id: "returnRecord", label: "Return created record", description: "Send the created or updated record to the next node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "file-input",
  privileged: true,
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { record: context.inputs.record ?? {} },
    effects: [{ type: "database.insert.requested", payload: { collection: collectionName(context.parameters.collection), record: context.inputs.record ?? {}, upsert: context.parameters.upsert === true, conflictKey: context.parameters.conflictKey ?? "", returnRecord: context.parameters.returnRecord !== false } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/database/query.ts
var databaseQueryNode = defineBuiltinNode({
  id: "builtin.database.query",
  label: "Find Records",
  description: "Ask a host database adapter to find records in a data table.",
  class: "database",
  scope: "both",
  inputs: [],
  outputs: [{ id: "records", label: "Records", valueType: "array" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table to search.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "where", label: "Only include records where", description: "Filter fields and values. Leave empty to include all records.", valueType: "object", defaultValue: {} },
    { id: "limit", label: "Maximum records", description: "Largest number of records to return.", valueType: "number", defaultValue: 100 },
    { id: "orderBy", label: "Sort by field", description: "Optional field used to sort the returned records.", valueType: "string", defaultValue: "", ui: { control: "field", placeholder: "fieldName" } },
    {
      id: "orderDirection",
      label: "Sort direction",
      description: "Choose whether lower values or higher values appear first.",
      valueType: "string",
      defaultValue: "asc",
      options: [
        { label: "Lowest first", value: "asc" },
        { label: "Highest first", value: "desc" }
      ]
    }
  ],
  icon: "database",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { records: [] },
    effects: [{ type: "database.query.requested", payload: { collection: collectionName(context.parameters.collection), where: context.parameters.where ?? {}, limit: context.parameters.limit ?? 100, orderBy: context.parameters.orderBy ?? "", orderDirection: context.parameters.orderDirection ?? "asc" } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/database/update.ts
var databaseUpdateNode = defineBuiltinNode({
  id: "builtin.database.update",
  label: "Update Records",
  description: "Ask a host database adapter to update matching records.",
  class: "database",
  scope: "both",
  inputs: [{ id: "patch", label: "Fields to change", valueType: "object", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "object" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table containing records to update.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "where", label: "Only update records where", description: "Filter fields and values used to choose records. Be careful leaving this empty.", valueType: "object", defaultValue: {} },
    { id: "limit", label: "Maximum records to update", description: "Safety limit for how many records this request may change.", valueType: "number", defaultValue: 1 },
    { id: "dryRun", label: "Preview only", description: "When enabled, request a preview without actually changing records.", valueType: "boolean", defaultValue: false },
    { id: "returnUpdated", label: "Return updated records", description: "Send updated records to the next node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "database",
  privileged: true,
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { result: {} },
    effects: [{ type: "database.update.requested", payload: { collection: collectionName(context.parameters.collection), where: context.parameters.where ?? {}, patch: context.inputs.patch ?? {}, limit: context.parameters.limit ?? 1, dryRun: context.parameters.dryRun === true, returnUpdated: context.parameters.returnUpdated !== false } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/database/index.ts
var databaseNodes = [databaseQueryNode, databaseInsertNode, databaseUpdateNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/shared.ts
function compareValues(left, right, operator) {
  return compareBasic(left, right, operator);
}
function everyBoolean(values) {
  return values.every(booleanValue);
}
function someBoolean(values) {
  return values.some(booleanValue);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/and.ts
var andNode = defineBuiltinNode({
  id: "builtin.logic.and",
  label: "And",
  description: "Return true when all input conditions are true.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "conditions", label: "Conditions", valueType: "boolean", required: true, multiple: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "emptyBehavior",
      label: "If no conditions arrive",
      description: "Fallback result when this node receives no boolean inputs.",
      valueType: "string",
      defaultValue: "true",
      options: [
        { label: "Treat as true", value: "true" },
        { label: "Treat as false", value: "false" }
      ]
    }
  ],
  icon: "ampersand",
  execute: (context) => {
    const conditions = arrayValue(context.inputs.conditions);
    const result = conditions.length ? everyBoolean(conditions) : context.parameters.emptyBehavior !== "false";
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/compare.ts
var compareNode = defineBuiltinNode({
  id: "builtin.logic.compare",
  label: "Compare",
  description: "Compare two values with a selected operator.",
  class: "logic",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "any", required: true },
    { id: "right", label: "Right", valueType: "any", required: true }
  ],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "operator",
      label: "Operator",
      description: "Choose how the left input should be checked against the right input or fallback value.",
      valueType: "string",
      defaultValue: "equals",
      options: [
        { value: "equals", label: "Equals" },
        { value: "not-equals", label: "Does not equal" },
        { value: "greater-than", label: "Greater than" },
        { value: "greater-than-or-equal", label: "Greater than or equal" },
        { value: "less-than", label: "Less than" },
        { value: "less-than-or-equal", label: "Less than or equal" },
        { value: "contains", label: "Contains" },
        { value: "starts-with", label: "Starts with" },
        { value: "ends-with", label: "Ends with" },
        { value: "exists", label: "Exists" }
      ]
    },
    { id: "rightDefault", label: "Fallback comparison value", description: "Used when nothing is connected to the Right input.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "caseSensitive", label: "Match capitalization exactly", description: "When disabled, text comparisons ignore capitalization.", valueType: "boolean", defaultValue: true }
  ],
  icon: "equal",
  execute: (context) => {
    const caseSensitive = context.parameters.caseSensitive !== false;
    const left = !caseSensitive && typeof context.inputs.left === "string" ? context.inputs.left.toLowerCase() : context.inputs.left;
    const rawRight = context.inputs.right ?? context.parameters.rightDefault;
    const right = !caseSensitive && typeof rawRight === "string" ? rawRight.toLowerCase() : rawRight;
    const result = compareValues(left, right, String(context.parameters.operator ?? "equals"));
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/not.ts
var notNode = defineBuiltinNode({
  id: "builtin.logic.not",
  label: "Not",
  description: "Invert a boolean condition.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [{ id: "missingValue", label: "If condition is missing", description: "Boolean value to assume before this node flips it.", valueType: "boolean", defaultValue: false }],
  icon: "badge-x",
  execute: (context) => {
    const value = context.inputs.condition === void 0 ? context.parameters.missingValue : context.inputs.condition;
    const result = !booleanValue(value);
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/or.ts
var orNode = defineBuiltinNode({
  id: "builtin.logic.or",
  label: "Or",
  description: "Return true when any input condition is true.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "conditions", label: "Conditions", valueType: "boolean", required: true, multiple: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "emptyBehavior",
      label: "If no conditions arrive",
      description: "Fallback result when this node receives no boolean inputs.",
      valueType: "string",
      defaultValue: "false",
      options: [
        { label: "Treat as false", value: "false" },
        { label: "Treat as true", value: "true" }
      ]
    }
  ],
  icon: "list-tree",
  execute: (context) => {
    const conditions = arrayValue(context.inputs.conditions);
    const result = conditions.length ? someBoolean(conditions) : context.parameters.emptyBehavior === "true";
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/logic/index.ts
var logicNodes = [compareNode, andNode, orNode, notNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/shared.ts
var optionalPrecisionOptions = [
  { label: "Do not round", value: "none" },
  { label: "Whole number", value: "0" },
  { label: "1 decimal place", value: "1" },
  { label: "2 decimal places", value: "2" },
  { label: "3 decimal places", value: "3" },
  { label: "4 decimal places", value: "4" },
  { label: "6 decimal places", value: "6" }
];
var precisionOptions = optionalPrecisionOptions.filter((option) => option.value !== "none");
function binaryNumbers(context) {
  return [numberValue(context.inputs.left), numberValue(context.inputs.right)];
}
function applyPrecision(value, precision) {
  const places = Math.floor(numberValue(precision, -1));
  if (places < 0) return value;
  const multiplier = 10 ** Math.min(12, places);
  return Math.round(value * multiplier) / multiplier;
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/add.ts
var addNode = defineBuiltinNode({
  id: "builtin.math.add",
  label: "Add",
  description: "Add two numeric values.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "offset", label: "Add after total", description: "Extra amount added after the two inputs are combined.", valueType: "number", defaultValue: 0 },
    { id: "precision", label: "Round result to", description: "Optional rounding applied after the calculation.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }
  ],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left + right + numberValue(context.parameters.offset), context.parameters.precision) });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/clamp.ts
var clampNode = defineBuiltinNode({
  id: "builtin.math.clamp",
  label: "Clamp",
  description: "Clamp a number between minimum and maximum bounds.",
  class: "math",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "min", label: "Lowest allowed value", description: "Numbers below this are raised to this value.", valueType: "number", defaultValue: 0 },
    { id: "max", label: "Highest allowed value", description: "Numbers above this are lowered to this value.", valueType: "number", defaultValue: 1 }
  ],
  icon: "between-horizontal-start",
  execute: (context) => {
    const value = numberValue(inputValue(context, "value"));
    const min = numberValue(context.parameters.min);
    const max = numberValue(context.parameters.max, 1);
    return emptyResult({ result: Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max)) });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/divide.ts
var divideNode = defineBuiltinNode({
  id: "builtin.math.divide",
  label: "Divide",
  description: "Divide one numeric value by another.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "precision", label: "Round result to", description: "Optional rounding applied after division.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions },
    {
      id: "divideByZero",
      label: "If dividing by zero",
      description: "Choose what happens when the right input is zero.",
      valueType: "string",
      defaultValue: "fail",
      options: [
        { label: "Fail this path", value: "fail" },
        { label: "Use fallback value", value: "fallback" },
        { label: "Return empty value", value: "null" }
      ]
    },
    { id: "fallback", label: "Fallback value", description: "Number to return when dividing by zero and fallback is selected.", valueType: "number", defaultValue: 0 }
  ],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    if (right === 0) {
      if (context.parameters.divideByZero === "fallback") return emptyResult({ result: numberValue(context.parameters.fallback) });
      if (context.parameters.divideByZero === "null") return emptyResult({ result: null });
      return { status: "failed", route: "failed", outputs: { result: null } };
    }
    return emptyResult({ result: applyPrecision(left / right, context.parameters.precision) });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/multiply.ts
var multiplyNode = defineBuiltinNode({
  id: "builtin.math.multiply",
  label: "Multiply",
  description: "Multiply two numeric values.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [{ id: "precision", label: "Round result to", description: "Optional rounding applied after multiplication.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left * right, context.parameters.precision) });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/round.ts
var roundNode = defineBuiltinNode({
  id: "builtin.math.round",
  label: "Round",
  description: "Round a numeric value to a configured precision.",
  class: "math",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "precision", label: "Decimal places to keep", description: "How many digits should remain after the decimal point.", valueType: "string", defaultValue: "0", options: precisionOptions },
    {
      id: "mode",
      label: "Rounding method",
      description: "Choose whether to round normally, always down, or always up.",
      valueType: "string",
      defaultValue: "nearest",
      options: [
        { label: "Nearest number", value: "nearest" },
        { label: "Always down", value: "floor" },
        { label: "Always up", value: "ceil" }
      ]
    }
  ],
  icon: "circle-dot",
  execute: (context) => {
    const precision = Math.max(0, Math.floor(numberValue(context.parameters.precision)));
    const multiplier = 10 ** precision;
    const value = numberValue(inputValue(context, "value")) * multiplier;
    const rounded = context.parameters.mode === "floor" ? Math.floor(value) : context.parameters.mode === "ceil" ? Math.ceil(value) : Math.round(value);
    return emptyResult({ result: rounded / multiplier });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/subtract.ts
var subtractNode = defineBuiltinNode({
  id: "builtin.math.subtract",
  label: "Subtract",
  description: "Subtract one numeric value from another.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [{ id: "precision", label: "Round result to", description: "Optional rounding applied after subtraction.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left - right, context.parameters.precision) });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/math/index.ts
var mathNodes = [addNode, subtractNode, multiplyNode, divideNode, clampNode, roundNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/policy/shared.ts
function jsonParameter(value, fallback) {
  if (value === void 0) return fallback;
  return value;
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/policy/action.ts
var actionNode = defineBuiltinNode({
  id: "builtin.policy.action",
  label: "Run Action",
  description: "Ask a host adapter to perform one task action.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "ready", label: "Ready", valueType: "boolean" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "actionDefinitionId", label: "Action to run", description: "Choose the host-provided action this node should request.", valueType: "string", required: true, ui: { control: "reference", referenceType: "action", placeholder: "Choose an action" } },
    { id: "parameters", label: "Action settings", description: "Values passed to the selected action.", valueType: "object", defaultValue: {} },
    { id: "timeoutMs", label: "Give up after milliseconds", description: "Maximum time to wait before treating this action as failed.", valueType: "number", defaultValue: 5e3 },
    { id: "requiresApproval", label: "Ask before running", description: "Require operator approval before this action executes.", valueType: "boolean", defaultValue: false },
    {
      id: "failureRoute",
      label: "If the action fails",
      description: "Usually failed. Success is available for intentionally ignoring errors.",
      valueType: "string",
      defaultValue: "failed",
      options: [
        { label: "Go to Failed", value: "failed" },
        { label: "Continue as Success", value: "success" }
      ]
    }
  ],
  icon: "zap",
  privileged: true,
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { success: true },
    effects: [{ type: "policy.action.requested", payload: { actionDefinitionId: context.parameters.actionDefinitionId ?? "", parameters: jsonParameter(context.parameters.parameters, {}), timeoutMs: context.parameters.timeoutMs ?? 5e3, requiresApproval: context.parameters.requiresApproval === true, failureRoute: context.parameters.failureRoute ?? "failed" } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/policy/expectation.ts
var expectationNode = defineBuiltinNode({
  id: "builtin.policy.expectation",
  label: "Expectation",
  description: "Check whether expected task state is true after an action.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "signals", label: "Signals", valueType: "signal", multiple: true }],
  outputs: [
    { id: "passed", label: "Passed", valueType: "boolean" },
    { id: "failed", label: "Failed", valueType: "boolean" }
  ],
  parameters: [
    { id: "conditions", label: "Expected conditions", description: "State checks this node should evaluate.", valueType: "array", defaultValue: [] },
    {
      id: "mode",
      label: "Required matches",
      description: "Choose whether every condition or just one condition must pass.",
      valueType: "string",
      defaultValue: "all",
      options: [
        { label: "All conditions must pass", value: "all" },
        { label: "Any condition may pass", value: "any" }
      ]
    },
    { id: "timeoutMs", label: "Wait up to milliseconds", description: "How long to wait for expected state to appear.", valueType: "number", defaultValue: 1e3 }
  ],
  icon: "list-checks",
  execute: (context) => ({
    status: "success",
    route: "passed",
    outputs: { passed: true, failed: false },
    effects: [{ type: "policy.expectation.checked", payload: { conditions: jsonParameter(context.parameters.conditions, []), mode: context.parameters.mode ?? "all", timeoutMs: context.parameters.timeoutMs ?? 1e3 } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/policy/recovery.ts
var recoveryNode = defineBuiltinNode({
  id: "builtin.policy.recovery",
  label: "Recovery",
  description: "Choose how to recover after a failed task action.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "failure", label: "Failure", valueType: "any" }],
  outputs: [
    { id: "recovered", label: "Recovered", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    {
      id: "strategy",
      label: "Recovery strategy",
      description: "What this policy should try after a failure.",
      valueType: "string",
      defaultValue: "retry",
      options: [
        { label: "Try the failed step again", value: "retry" },
        { label: "Run a fallback action", value: "fallback-action" },
        { label: "Stop this policy", value: "abort" }
      ]
    },
    { id: "maxAttempts", label: "Maximum tries", description: "How many total attempts are allowed when retrying.", valueType: "number", defaultValue: 2 },
    { id: "fallbackActionDefinitionId", label: "Fallback action", description: "Action to run when the fallback strategy is selected.", valueType: "string", defaultValue: "", ui: { control: "reference", referenceType: "action", placeholder: "Choose fallback action" } }
  ],
  icon: "shield-check",
  execute: (context) => ({ status: "success", route: context.parameters.strategy === "abort" ? "failed" : "recovered", outputs: { recovered: context.inputs.failure ?? null, strategy: context.parameters.strategy ?? "retry", maxAttempts: context.parameters.maxAttempts ?? 2, fallbackActionDefinitionId: context.parameters.fallbackActionDefinitionId ?? "" } })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/policy/index.ts
var policyNodes = [actionNode, expectationNode, recoveryNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/shared.ts
function randomFloat(context) {
  return context.random ? context.random() : Math.random();
}
function randomInRange(context) {
  const min = numberValue(context.parameters.min);
  const max = numberValue(context.parameters.max, 1);
  const includeMax = context.parameters.includeMax === true;
  const value = Math.min(min, max) + randomFloat(context) * Math.abs(max - min);
  return includeMax ? Math.min(Math.max(min, max), value) : value;
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/jitter.ts
var jitterNode = defineBuiltinNode({
  id: "builtin.random.jitter",
  label: "Jitter",
  description: "Add bounded randomness to a numeric value.",
  class: "random",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "value", label: "Value", valueType: "number" }],
  parameters: [
    { id: "amount", label: "Maximum change", description: "Largest amount that can be randomly added or subtracted.", valueType: "number", defaultValue: 0.1 },
    { id: "precision", label: "Round result to", description: "Optional rounding after jitter is applied.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions },
    { id: "min", label: "Lowest allowed value", description: "Final value will not go below this number.", valueType: "number", defaultValue: -999999 },
    { id: "max", label: "Highest allowed value", description: "Final value will not go above this number.", valueType: "number", defaultValue: 999999 }
  ],
  icon: "waves",
  execute: (context) => {
    const amount = Math.max(0, numberValue(context.parameters.amount, 0.1));
    const offset = (randomFloat(context) * 2 - 1) * amount;
    const min = numberValue(context.parameters.min, -999999);
    const max = numberValue(context.parameters.max, 999999);
    const precision = Math.floor(numberValue(context.parameters.precision, -1));
    const raw = Math.min(Math.max(numberValue(inputValue(context, "value")) + offset, Math.min(min, max)), Math.max(min, max));
    if (precision >= 0) {
      const multiplier = 10 ** Math.min(12, precision);
      return emptyResult({ value: Math.round(raw * multiplier) / multiplier });
    }
    return emptyResult({ value: raw });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/random-choice.ts
var randomChoiceNode = defineBuiltinNode({
  id: "builtin.random.choice",
  label: "Random Choice",
  description: "Select one value from a list.",
  class: "random",
  scope: "both",
  inputs: [{ id: "choices", label: "Choices", valueType: "array", required: true }],
  outputs: [{ id: "choice", label: "Choice", valueType: "any" }],
  parameters: [
    { id: "fallback", label: "If list is empty", description: "Value to return when there are no choices.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "allowEmpty", label: "Allow empty choices", description: "When disabled, an empty choice list makes this node fail.", valueType: "boolean", defaultValue: true }
  ],
  icon: "shuffle",
  execute: (context) => {
    const choices = arrayValue(context.inputs.choices);
    if (!choices.length) {
      if (context.parameters.allowEmpty === false) return { status: "failed", route: "failed", outputs: { choice: context.parameters.fallback ?? null } };
      return emptyResult({ choice: context.parameters.fallback ?? null });
    }
    return emptyResult({ choice: choices[Math.floor(randomFloat(context) * choices.length)] ?? context.parameters.fallback ?? null });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/random-number.ts
var randomNumberNode = defineBuiltinNode({
  id: "builtin.random.number",
  label: "Random Number",
  description: "Produce a random number in a configured range.",
  class: "random",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "number" }],
  parameters: [
    { id: "min", label: "Lowest possible number", description: "Start of the random range.", valueType: "number", defaultValue: 0 },
    { id: "max", label: "Highest possible number", description: "End of the random range.", valueType: "number", defaultValue: 1 },
    {
      id: "mode",
      label: "Number type",
      description: "Choose whether to produce a decimal number or a whole number.",
      valueType: "string",
      defaultValue: "float",
      options: [
        { label: "Decimal number", value: "float" },
        { label: "Whole number", value: "integer" }
      ]
    },
    { id: "precision", label: "Decimal places to keep", description: "Only used for decimal numbers.", valueType: "string", defaultValue: "2", options: precisionOptions },
    { id: "includeMax", label: "Include highest number", description: "Allow the random result to equal the highest possible number.", valueType: "boolean", defaultValue: false }
  ],
  icon: "dice-5",
  execute: (context) => {
    const value = randomInRange(context);
    if (context.parameters.mode === "integer") {
      const min = Math.ceil(numberValue(context.parameters.min));
      const max = Math.floor(numberValue(context.parameters.max, 1));
      const upper = context.parameters.includeMax === true ? max + 1 : max;
      return emptyResult({ value: Math.floor(min + (context.random ? context.random() : Math.random()) * Math.max(1, upper - min)) });
    }
    const precision = Math.max(0, Math.min(12, Math.floor(numberValue(context.parameters.precision, 2))));
    const multiplier = 10 ** precision;
    return emptyResult({ value: Math.round(value * multiplier) / multiplier });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/weighted-choice.ts
var weightedChoiceNode = defineBuiltinNode({
  id: "builtin.random.weighted-choice",
  label: "Weighted Choice",
  description: "Select one value from weighted options.",
  class: "random",
  scope: "both",
  inputs: [{ id: "choices", label: "Weighted choices", valueType: "array", required: true }],
  outputs: [{ id: "choice", label: "Choice", valueType: "any" }],
  parameters: [
    { id: "defaultWeight", label: "Default chance weight", description: "Used for choices that do not provide their own weight.", valueType: "number", defaultValue: 1 },
    { id: "fallback", label: "If no choice can be picked", description: "Value to return when the list is empty or all weights are zero.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "normalizeWeights", label: "Balance weights automatically", description: "Treat weights as relative chances instead of requiring them to add up to a specific total.", valueType: "boolean", defaultValue: true }
  ],
  icon: "scale",
  execute: (context) => {
    const choices = arrayValue(context.inputs.choices);
    const defaultWeight = numberValue(context.parameters.defaultWeight, 1);
    const total = choices.reduce((sum, choice) => sum + Math.max(0, numberValue(choice.weight, defaultWeight)), 0);
    if (!choices.length || total <= 0) return emptyResult({ choice: context.parameters.fallback ?? null });
    let cursor = randomFloat(context) * total;
    for (const choice of choices) {
      cursor -= Math.max(0, numberValue(choice.weight, defaultWeight));
      if (cursor <= 0) return emptyResult({ choice: choice.value ?? null });
    }
    return emptyResult({ choice: choices[0]?.value ?? context.parameters.fallback ?? null });
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/random/index.ts
var randomNodes = [randomNumberNode, randomChoiceNode, weightedChoiceNode, jitterNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/routine/approval.ts
var approvalNode = defineBuiltinNode({
  id: "builtin.routine.approval",
  label: "Approval",
  description: "Pause a routine until an operator approves or rejects it.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "approved", label: "Approved", valueType: "any" },
    { id: "rejected", label: "Rejected", valueType: "any" }
  ],
  parameters: [
    { id: "prompt", label: "Approval message", description: "Message shown to the operator who approves or rejects this step.", valueType: "string", defaultValue: "Approve this routine step?", ui: { control: "textarea", placeholder: "Approval message" } },
    { id: "timeoutMs", label: "Auto-decide after milliseconds", description: "Use 0 to wait indefinitely.", valueType: "number", defaultValue: 0 },
    {
      id: "defaultRoute",
      label: "If nobody responds",
      description: "Route to use when the approval times out.",
      valueType: "string",
      defaultValue: "rejected",
      options: [
        { label: "Treat as rejected", value: "rejected" },
        { label: "Treat as approved", value: "approved" }
      ]
    }
  ],
  icon: "badge-check",
  execute: (context) => ({ status: "waiting", route: "approved", outputs: { approved: context.inputs.in ?? null, timeoutMs: context.parameters.timeoutMs ?? 0, defaultRoute: context.parameters.defaultRoute ?? "rejected" }, effects: [{ type: "routine.approval.requested", payload: { prompt: context.parameters.prompt ?? "", timeoutMs: context.parameters.timeoutMs ?? 0, defaultRoute: context.parameters.defaultRoute ?? "rejected" } }] })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/routine/shared.ts
function referenceId(value) {
  return String(value ?? "").trim();
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/routine/subroutine.ts
var subroutineNode = defineBuiltinNode({
  id: "builtin.routine.subroutine",
  label: "Subroutine",
  description: "Run another routine as a reusable graph step.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "routineId", label: "Routine to run", description: "Choose the saved routine this node should call.", valueType: "string", required: true, ui: { control: "reference", referenceType: "routine", placeholder: "Choose a routine" } },
    { id: "inputs", label: "Values to pass in", description: "Input values made available to the called routine.", valueType: "object", defaultValue: {} },
    {
      id: "isolation",
      label: "Context sharing",
      description: "Choose whether the called routine can see the current routine's variables.",
      valueType: "string",
      defaultValue: "shared",
      options: [
        { label: "Share current variables", value: "shared" },
        { label: "Use isolated variables", value: "isolated" }
      ]
    }
  ],
  icon: "boxes",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { success: context.inputs.in ?? null },
    effects: [{ type: "routine.subroutine.requested", payload: { routineId: referenceId(context.parameters.routineId), inputs: context.parameters.inputs ?? {}, isolation: context.parameters.isolation ?? "shared" } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/routine/task-policy.ts
var taskPolicyNode = defineBuiltinNode({
  id: "builtin.routine.task-policy",
  label: "Run Task",
  description: "Run a saved task policy from this routine.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "taskId", label: "Task to run", description: "Choose the saved task this routine step should start.", valueType: "string", required: true, ui: { control: "reference", referenceType: "task", placeholder: "Choose a task" } },
    { id: "policyId", label: "Specific policy version", description: "Optional override. Leave blank to use the task's default policy.", valueType: "string", defaultValue: "", ui: { control: "reference", referenceType: "policy", placeholder: "Default policy" } },
    { id: "inputs", label: "Values to pass in", description: "Input values made available to the task.", valueType: "object", defaultValue: {} },
    { id: "waitForCompletion", label: "Wait until task finishes", description: "When enabled, the routine pauses until this task reports success or failure.", valueType: "boolean", defaultValue: true }
  ],
  icon: "network",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { success: context.inputs.in ?? null },
    effects: [{ type: "routine.task-policy.requested", payload: { taskId: referenceId(context.parameters.taskId), policyId: referenceId(context.parameters.policyId), inputs: context.parameters.inputs ?? {}, waitForCompletion: context.parameters.waitForCompletion !== false } }]
  })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/routine/index.ts
var routineNodes = [taskPolicyNode, subroutineNode, approvalNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/shared.ts
function durationMs(value, fallback) {
  return Math.max(0, Math.floor(numberValue(value, fallback)));
}
function durationFromUnit(value, unit, fallbackMs) {
  const amount = numberValue(value, fallbackMs);
  if (unit === "seconds") return durationMs(amount * 1e3, fallbackMs);
  if (unit === "minutes") return durationMs(amount * 6e4, fallbackMs);
  return durationMs(amount, fallbackMs);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/debounce.ts
var debounceNode = defineBuiltinNode({
  id: "builtin.timing.debounce",
  label: "Debounce",
  description: "Continue only after a signal stops changing for a short time.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "signal", label: "Signal", valueType: "signal", required: true }],
  outputs: [{ id: "stable", label: "Stable", valueType: "boolean" }],
  parameters: [
    { id: "windowMs", label: "Stable for milliseconds", description: "How long the signal must remain unchanged.", valueType: "number", defaultValue: 250 },
    {
      id: "edge",
      label: "When to continue",
      description: "Choose whether to continue at the start, end, or both sides of the stable window.",
      valueType: "string",
      defaultValue: "trailing",
      options: [
        { label: "After it stays stable", value: "trailing" },
        { label: "Immediately, then wait", value: "leading" },
        { label: "Both immediate and stable", value: "both" }
      ]
    }
  ],
  icon: "activity",
  execute: (context) => emptyResult({ stable: Boolean(context.inputs.signal), windowMs: durationMs(context.parameters.windowMs, 250), edge: context.parameters.edge ?? "trailing" })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/retry.ts
var retryNode = defineBuiltinNode({
  id: "builtin.timing.retry",
  label: "Retry",
  description: "Retry a branch with bounded attempts and delay.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "attempts", label: "Maximum tries", description: "How many times this branch may be attempted.", valueType: "number", defaultValue: 3 },
    { id: "delayMs", label: "Wait between tries", description: "Base delay in milliseconds before another attempt.", valueType: "number", defaultValue: 500 },
    {
      id: "backoff",
      label: "Delay pattern",
      description: "How the wait time changes after repeated failures.",
      valueType: "string",
      defaultValue: "fixed",
      options: [
        { label: "Same wait every time", value: "fixed" },
        { label: "Increase steadily", value: "linear" },
        { label: "Increase quickly", value: "exponential" }
      ]
    },
    { id: "jitterMs", label: "Random extra wait", description: "Maximum random milliseconds added or subtracted from each delay.", valueType: "number", defaultValue: 0 }
  ],
  icon: "refresh-cw",
  execute: (context) => emptyResult({ success: context.inputs.in ?? null, attempts: durationMs(context.parameters.attempts, 3), delayMs: durationMs(context.parameters.delayMs, 500), backoff: context.parameters.backoff ?? "fixed", jitterMs: durationMs(context.parameters.jitterMs, 0) })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/timeout.ts
var timeoutNode = defineBuiltinNode({
  id: "builtin.timing.timeout",
  label: "Timeout",
  description: "Fail or route when a branch takes too long.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "timeout", label: "Timeout", valueType: "any" }
  ],
  parameters: [
    { id: "timeoutMs", label: "Give up after milliseconds", description: "Maximum time this branch may run before taking the timeout path.", valueType: "number", defaultValue: 5e3 },
    { id: "timeoutRoute", label: "If time runs out", description: "Usually timeout. Success is available when waiting too long is acceptable.", valueType: "string", defaultValue: "timeout", options: [{ label: "Go to Timeout", value: "timeout" }, { label: "Continue as Success", value: "success" }] },
    { id: "cancelOnTimeout", label: "Stop branch when time runs out", description: "Ask the runtime to cancel any still-running work in this branch.", valueType: "boolean", defaultValue: true }
  ],
  icon: "clock-alert",
  execute: (context) => emptyResult({ success: context.inputs.in ?? null, timeoutMs: durationMs(context.parameters.timeoutMs, 5e3), timeoutRoute: context.parameters.timeoutRoute ?? "timeout", cancelOnTimeout: context.parameters.cancelOnTimeout !== false })
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/wait.ts
var waitNode = defineBuiltinNode({
  id: "builtin.timing.wait",
  label: "Wait",
  description: "Pause execution for a fixed duration.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [{ id: "data", label: "Data", valueType: "any" }],
  parameters: [
    { id: "duration", label: "Wait amount", description: "How long this node should pause before continuing.", valueType: "number", defaultValue: 1e3 },
    {
      id: "unit",
      label: "Time unit",
      description: "Unit used for the wait amount.",
      valueType: "string",
      defaultValue: "milliseconds",
      options: [
        { label: "Milliseconds", value: "milliseconds" },
        { label: "Seconds", value: "seconds" },
        { label: "Minutes", value: "minutes" }
      ]
    },
    { id: "jitterMs", label: "Random extra wait", description: "Maximum random milliseconds added or subtracted from the wait.", valueType: "number", defaultValue: 0 }
  ],
  icon: "timer",
  execute: (context) => {
    const base = durationFromUnit(context.parameters.duration, context.parameters.unit, 1e3);
    const jitter = Math.max(0, Number(context.parameters.jitterMs ?? 0));
    const random = context.random ? context.random() : 0.5;
    return { status: "waiting", route: "success", outputs: { data: context.inputs.in ?? null, durationMs: Math.max(0, Math.round(base + (random * 2 - 1) * jitter)) } };
  }
});

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/timing/index.ts
var timingNodes = [waitNode, timeoutNode, retryNode, debounceNode];

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/registry.ts
var automationNodeClassGroups = [
  { id: "control-flow", label: "Control Flow", description: "Graph routing, branching, joining, and lifecycle nodes." },
  { id: "policy", label: "Policy", description: "Task policy action, expectation, and recovery nodes." },
  { id: "routine", label: "Routine", description: "Routine orchestration nodes that call tasks or subroutines." },
  { id: "logic", label: "Logic", description: "Boolean and comparison nodes." },
  { id: "math", label: "Math", description: "Numeric transform nodes." },
  { id: "random", label: "Random", description: "Random number, choice, and jitter nodes." },
  { id: "data", label: "Data", description: "Variable, constant, object, and list transform nodes." },
  { id: "database", label: "Database", description: "Database request nodes delegated to host adapters." },
  { id: "timing", label: "Timing", description: "Wait, timeout, retry, and debounce nodes." },
  { id: "runtime", label: "Runtime", description: "Future runtime/debug-specific nodes." },
  { id: "custom", label: "Custom", description: "Host-added node definitions loaded from .fluxiq." }
];
var builtinAutomationNodeDefinitions = [
  ...controlFlowNodes,
  ...policyNodes,
  ...routineNodes,
  ...logicNodes,
  ...mathNodes,
  ...randomNodes,
  ...dataNodes,
  ...databaseNodes,
  ...timingNodes
];
var automationNodeClasses = automationNodeClassGroups.map((group) => group.id);
function getAutomationNodeDefinition(nodeId) {
  return builtinAutomationNodeDefinitions.find((node) => node.id === nodeId);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/nodes/layout.ts
var automationStudioSourceNodeRoot = "packages/fluxiq/src/programs/automation-studio/nodes";
var automationStudioBuiltinNodeRoots = automationNodeClasses.filter((nodeClass) => nodeClass !== "custom" && nodeClass !== "runtime").map((nodeClass) => `${automationStudioSourceNodeRoot}/${nodeClass}`);
var automationStudioCustomNodeRoot = ".fluxiq/data/programs/automation-studio/nodes/custom";
var automationStudioCustomNodeFolders = automationNodeClasses.map((nodeClass) => `${automationStudioCustomNodeRoot}/${nodeClass}`);

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/normalization/default-normalizer.ts
var ConservativeTimelineNormalizer = class {
  normalize(recording, options = {}) {
    const issues = [];
    const timeline = [];
    let previousCheckpoint = recording.initialState;
    let deltasSinceCheckpoint = 0;
    const checkpointPolicy = options.checkpointPolicy ?? {};
    for (const entry of recording.timeline) {
      if (entry.type === "state_checkpoint") {
        const deltas = diffStateSnapshots(previousCheckpoint, entry.state);
        if (deltas.length) {
          timeline.push({
            id: `${entry.id}.delta`,
            recordingId: recording.recordingId,
            timestamp: entry.timestamp,
            monotonicOffsetMs: entry.monotonicOffsetMs,
            sequence: timeline.length,
            sourceId: entry.sourceId,
            type: "state_delta",
            deltas,
            correlationId: entry.id,
            metadata: { normalizedFrom: entry.id }
          });
        }
        previousCheckpoint = entry.state;
        deltasSinceCheckpoint = 0;
        timeline.push({ ...entry, sequence: timeline.length });
        continue;
      }
      if (entry.type === "state_delta") deltasSinceCheckpoint += entry.deltas.length;
      timeline.push({ ...entry, sequence: timeline.length });
      if (checkpointPolicy.maxDeltasBetweenCheckpoints && deltasSinceCheckpoint > checkpointPolicy.maxDeltasBetweenCheckpoints) {
        issues.push({
          severity: "info",
          code: "normalization.checkpoint_recommended",
          message: "A checkpoint is recommended after the configured number of state deltas.",
          entryId: entry.id
        });
        deltasSinceCheckpoint = 0;
      }
    }
    return {
      schemaVersion: "0.1",
      normalizedTimelineId: `timeline.${recording.recordingId}.normalized`,
      recordingId: recording.recordingId,
      ...recording.taskId !== void 0 ? { taskId: recording.taskId } : {},
      sourceRecording: { layer: "raw_recording", artifactId: recording.recordingId },
      initialState: recording.initialState,
      timeline,
      issues,
      generatedAt: Date.now(),
      metadata: {
        ...options.metadata ?? {},
        ...recording.environment.domainId !== void 0 ? { domainId: recording.environment.domainId } : {},
        normalizer: "conservative"
      }
    };
  }
};
function normalizeRecordingTimeline(recording, options) {
  return new ConservativeTimelineNormalizer().normalize(recording, options);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/executor.ts
async function runAutomationStudioGraph(flow, options = {}) {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const attempts = [];
  const values = { ...options.inputs ?? {} };
  const effects = [];
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  let currentNode = options.startNodeId ? nodesById.get(options.startNodeId) : findStartNode(flow);
  if (!currentNode) {
    return {
      status: "failed",
      startedAt,
      finishedAt: now(),
      attempts,
      values,
      effects,
      message: "No start node is available in this flow."
    };
  }
  const maxSteps = Math.max(1, options.maxSteps ?? 250);
  for (let step = 0; step < maxSteps; step += 1) {
    if (options.signal?.aborted) {
      return { status: "cancelled", startedAt, finishedAt: now(), currentNodeId: currentNode.id, attempts, values, effects, message: "Run cancelled." };
    }
    const attempt = await executeAutomationStudioNode(flow, currentNode, values, options, attempts.length + 1);
    attempts.push(attempt);
    for (const [key, value] of Object.entries(attempt.outputs)) {
      values[`${currentNode.id}.${key}`] = value;
      values[key] = value;
    }
    for (const effect of attempt.effects) effects.push({ ...effect, nodeId: currentNode.id });
    if (attempt.status === "waiting") {
      return {
        status: "waiting",
        startedAt,
        currentNodeId: currentNode.id,
        attempts,
        values,
        effects,
        ...attempt.message ? { message: attempt.message } : {}
      };
    }
    if (attempt.status === "failed") {
      const failedEdge = chooseAutomationStudioEdge(flow, currentNode.id, attempt.route ?? "failed");
      if (!failedEdge) return {
        status: "failed",
        startedAt,
        finishedAt: now(),
        currentNodeId: currentNode.id,
        attempts,
        values,
        effects,
        ...attempt.message ? { message: attempt.message } : {}
      };
      currentNode = nodesById.get(failedEdge.targetNodeId);
      if (!currentNode) return missingTargetTrace(startedAt, now(), failedEdge, attempts, values, effects);
      continue;
    }
    const nextEdge = chooseAutomationStudioEdge(flow, currentNode.id, attempt.route ?? "success");
    if (!nextEdge) {
      return { status: "succeeded", startedAt, finishedAt: now(), currentNodeId: currentNode.id, attempts, values, effects };
    }
    currentNode = nodesById.get(nextEdge.targetNodeId);
    if (!currentNode) return missingTargetTrace(startedAt, now(), nextEdge, attempts, values, effects);
  }
  return {
    status: "failed",
    startedAt,
    finishedAt: now(),
    currentNodeId: currentNode.id,
    attempts,
    values,
    effects,
    message: `Maximum step count exceeded: ${maxSteps}.`
  };
}
async function executeAutomationStudioNode(flow, node, values, options, attemptNumber) {
  const startedAt = options.now?.() ?? Date.now();
  const definition = getAutomationNodeDefinition(node.definitionId);
  const inputs = collectNodeInputs(flow, node, values);
  if (!definition?.execute) {
    return {
      attemptId: `${node.id}.attempt.${attemptNumber}`,
      nodeId: node.id,
      definitionId: node.definitionId,
      startedAt,
      finishedAt: options.now?.() ?? Date.now(),
      status: "failed",
      route: "failed",
      inputs,
      outputs: {},
      effects: [],
      message: `Node definition is not executable: ${node.definitionId}.`
    };
  }
  try {
    const context = {
      inputs,
      parameters: node.parameterValues ?? {},
      variables: new Map(Object.entries(options.variables ?? {})),
      ...options.random ? { random: options.random } : {},
      ...options.now ? { now: options.now } : {},
      ...options.signal ? { signal: options.signal } : {}
    };
    const result = await definition.execute(context);
    return nodeAttemptFromResult(node, startedAt, options.now?.() ?? Date.now(), attemptNumber, inputs, result);
  } catch (error) {
    return {
      attemptId: `${node.id}.attempt.${attemptNumber}`,
      nodeId: node.id,
      definitionId: node.definitionId,
      startedAt,
      finishedAt: options.now?.() ?? Date.now(),
      status: "failed",
      route: "failed",
      inputs,
      outputs: {},
      effects: [],
      message: error instanceof Error ? error.message : "Node execution failed."
    };
  }
}
function nodeAttemptFromResult(node, startedAt, finishedAt, attemptNumber, inputs, result) {
  return {
    attemptId: `${node.id}.attempt.${attemptNumber}`,
    nodeId: node.id,
    definitionId: node.definitionId,
    startedAt,
    finishedAt,
    status: result.status === "failed" ? "failed" : result.status === "waiting" ? "waiting" : "succeeded",
    route: result.route ?? (result.status === "failed" ? "failed" : "success"),
    inputs,
    outputs: result.outputs ?? {},
    effects: result.effects ?? []
  };
}
function collectNodeInputs(flow, node, values) {
  const inputs = {};
  for (const edge of flow.edges.filter((candidate) => candidate.targetNodeId === node.id)) {
    if (!edge.targetPortId || edge.targetPortId === "in") continue;
    const sourceKey = edge.sourcePortId ? `${edge.sourceNodeId}.${edge.sourcePortId}` : edge.sourceNodeId;
    if (values[sourceKey] !== void 0) inputs[edge.targetPortId] = values[sourceKey];
  }
  return { ...values, ...inputs };
}
function chooseAutomationStudioEdge(flow, sourceNodeId, route) {
  const edges = flow.edges.filter((edge) => edge.sourceNodeId === sourceNodeId);
  return edges.find((edge) => edge.sourcePortId === route) ?? edges.find((edge) => !edge.sourcePortId && route === "success") ?? null;
}
function findStartNode(flow) {
  return flow.nodes.find((node) => node.definitionId === "builtin.control.start") ?? flow.nodes[0];
}
function missingTargetTrace(startedAt, finishedAt, edge, attempts, values, effects) {
  return {
    status: "failed",
    startedAt,
    finishedAt,
    attempts,
    values,
    effects,
    message: `Edge ${edge.id} points to missing node ${edge.targetNodeId}.`
  };
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdir as mkdir2, readdir, rm as rm2 } from "node:fs/promises";
import path2 from "node:path";

// ../../!FluxIQ/packages/fluxiq/src/programs/_shared/storage.ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
var ProgramJsonStore = class _ProgramJsonStore {
  constructor(filePath, empty) {
    this.empty = empty;
    this.filePath = path.resolve(filePath);
  }
  static writeLocks = /* @__PURE__ */ new Map();
  filePath;
  async read() {
    try {
      const payload = JSON.parse(await readFile(this.filePath, "utf8"));
      if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
        return payload.data;
      }
    } catch {
    }
    return this.empty();
  }
  async write(data) {
    return await _ProgramJsonStore.withFileLock(this.filePath, async () => this.writeUnlocked(data));
  }
  async update(mutator) {
    return await _ProgramJsonStore.withFileLock(this.filePath, async () => {
      const data = await this.read();
      const result = await mutator(data);
      return this.writeUnlocked(result ?? data);
    });
  }
  async writeUnlocked(data) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify({ version: 1, data }, null, 2)}
`, "utf8");
    try {
      await renameWithWindowsRetry(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    return data;
  }
  static async withFileLock(filePath, operation) {
    const key = path.resolve(filePath).toLowerCase();
    const previous = _ProgramJsonStore.writeLocks.get(key) ?? Promise.resolve();
    let release = () => void 0;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current, () => current);
    _ProgramJsonStore.writeLocks.set(key, chained);
    await previous.catch(() => void 0);
    try {
      return await operation();
    } finally {
      release();
      if (_ProgramJsonStore.writeLocks.get(key) === chained) _ProgramJsonStore.writeLocks.delete(key);
    }
  }
};
function programDataFile(rootDir, programId, fileName) {
  return path.join(rootDir, "programs", safeSegment(programId), fileName);
}
function safeSegment(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
async function renameWithWindowsRetry(source, target) {
  const delays = [4, 12, 28, 60, 120];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      const code = error.code;
      if (attempt >= delays.length || code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw error;
      await delay(delays[attempt]);
    }
  }
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/storage/ids.ts
function recordingSessionDocumentId(recording) {
  return recording.recordingId;
}
function normalizedTimelineDocumentId(timeline) {
  return timeline.normalizedTimelineId;
}
function signalRegistryDocumentId(registry) {
  return registry.registryId;
}
function learnedTaskModelDocumentId(model) {
  return model.learnedTaskModelId;
}
function policyGraphDocumentId(policy) {
  return policy.policyId;
}
function canonicalArtifactIdentity(artifact) {
  if ("normalizedTimelineId" in artifact) {
    return withOptionalIdentityFields({
      kind: "normalized_timeline",
      id: normalizedTimelineDocumentId(artifact)
    }, readDomainId(artifact.metadata), artifact.taskId);
  }
  if ("recordingId" in artifact) {
    return withOptionalIdentityFields({
      kind: "recording_session",
      id: recordingSessionDocumentId(artifact)
    }, artifact.environment.domainId, artifact.taskId);
  }
  if ("registryId" in artifact) {
    return withOptionalIdentityFields({
      kind: "signal_registry",
      id: signalRegistryDocumentId(artifact)
    }, readDomainId(artifact.metadata));
  }
  if ("learnedTaskModelId" in artifact) {
    return withOptionalIdentityFields({
      kind: "learned_task_model",
      id: learnedTaskModelDocumentId(artifact)
    }, readDomainId(artifact.metadata), artifact.taskId);
  }
  return withOptionalIdentityFields({
    kind: "policy_graph",
    id: policyGraphDocumentId(artifact)
  }, readDomainId(artifact.metadata), artifact.taskId);
}
function withOptionalIdentityFields(base, domainId, taskId) {
  const identity = { ...base };
  if (domainId !== void 0) identity.domainId = domainId;
  if (taskId !== void 0) identity.taskId = taskId;
  return identity;
}
function readDomainId(metadata) {
  if (!metadata || !("domainId" in metadata)) return void 0;
  return typeof metadata.domainId === "string" || metadata.domainId === null ? metadata.domainId : void 0;
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/storage/memory-repository.ts
var AutomationStudioMemoryRepository = class {
  documents = /* @__PURE__ */ new Map();
  identities = /* @__PURE__ */ new Map();
  identify;
  constructor(options) {
    this.identify = options.identify;
  }
  async list(domainId) {
    const documents = [];
    for (const [id, document] of this.documents) {
      const identity = this.identities.get(id);
      if (domainId === void 0 || identity?.domainId === domainId) {
        documents.push(cloneDocument(document));
      }
    }
    return documents;
  }
  async get(id, domainId) {
    const identity = this.identities.get(id);
    if (!identity || domainId !== void 0 && identity.domainId !== domainId) return null;
    const document = this.documents.get(id);
    return document ? cloneDocument(document) : null;
  }
  async put(document) {
    const identity = this.identify(document);
    this.documents.set(identity.id, cloneDocument(document));
    this.identities.set(identity.id, identity);
    return cloneDocument(document);
  }
  async delete(id, domainId) {
    const identity = this.identities.get(id);
    if (!identity || domainId !== void 0 && identity.domainId !== domainId) return false;
    this.identities.delete(id);
    return this.documents.delete(id);
  }
};
function createCanonicalAutomationStudioMemoryRepositories() {
  return {
    recordingSessions: new AutomationStudioMemoryRepository({
      identify: (document) => ({
        ...canonicalArtifactIdentity(document),
        id: recordingSessionDocumentId(document)
      })
    }),
    normalizedTimelines: new AutomationStudioMemoryRepository({
      identify: (document) => ({
        ...canonicalArtifactIdentity(document),
        id: normalizedTimelineDocumentId(document)
      })
    }),
    signalRegistries: new AutomationStudioMemoryRepository({
      identify: (document) => ({
        ...canonicalArtifactIdentity(document),
        id: signalRegistryDocumentId(document)
      })
    }),
    learnedTaskModels: new AutomationStudioMemoryRepository({
      identify: (document) => ({
        ...canonicalArtifactIdentity(document),
        id: learnedTaskModelDocumentId(document)
      })
    }),
    policyGraphs: new AutomationStudioMemoryRepository({
      identify: (document) => ({
        ...canonicalArtifactIdentity(document),
        id: policyGraphDocumentId(document)
      })
    })
  };
}
function cloneDocument(document) {
  return structuredClone(document);
}

// ../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service.ts
var AutomationStudioService = class {
  repositories;
  projectIndexStore;
  legacyProjectStore;
  projectRootDir;
  nodeRootDir;
  recordingDomains = new RecordingDomainRegistry();
  recordingMutationLocks = /* @__PURE__ */ new Map();
  ready;
  storageReady;
  constructor(options = {}) {
    this.repositories = options.repositories ?? createCanonicalAutomationStudioMemoryRepositories();
    if (options.dataDir) {
      const automationDataDir = path2.join(options.dataDir, "programs", "automation-studio");
      this.projectRootDir = path2.join(automationDataDir, "projects");
      this.nodeRootDir = path2.join(automationDataDir, "nodes");
      this.projectIndexStore = new ProgramJsonStore(path2.join(this.projectRootDir, "index.json"), () => ({ categories: [], projects: [] }));
      this.legacyProjectStore = new ProgramJsonStore(programDataFile(options.dataDir, "automation-studio", "projects.json"), () => ({ categories: [], projects: [] }));
    }
    this.ready = options.seedFixture === true ? this.seedFixture() : Promise.resolve();
  }
  async snapshot(domainId) {
    await this.ready;
    return {
      tasks: [],
      recordings: [],
      policies: [],
      canonical: {
        recordingSessions: await this.repositories.recordingSessions.list(domainId),
        normalizedTimelines: await this.repositories.normalizedTimelines.list(domainId),
        signalRegistries: await this.repositories.signalRegistries.list(domainId),
        learnedTaskModels: await this.repositories.learnedTaskModels.list(domainId),
        policyGraphs: await this.repositories.policyGraphs.list(domainId)
      },
      problems: [
        {
          id: "automation-studio.host-artifacts",
          severity: "info",
          message: "Automation Studio is ready for host-owned artifacts. Create or load a project to begin recording and authoring."
        }
      ]
    };
  }
  async listRecordingSessions(projectId) {
    await this.ready;
    if (projectId) await this.loadProjectRecordings(projectId);
    return await this.repositories.recordingSessions.list();
  }
  async getRecordingSession(recordingId, projectId) {
    await this.ready;
    if (projectId) await this.loadProjectRecordings(projectId);
    const recording = await this.repositories.recordingSessions.get(recordingId);
    if (!recording) throw new Error(`Unknown Automation Studio recording: ${recordingId}`);
    return recording;
  }
  async createRecording(input) {
    await this.ready;
    const recording = createRecordingSession(input);
    await this.repositories.recordingSessions.put(recording);
    if (input.projectId) await this.writeProjectRecordingSession(input.projectId, recording);
    return recording;
  }
  async appendRecordingEvent(input) {
    return await this.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.getRecordingSession(input.recordingId, input.projectId);
      const next = appendRecordingEntry(recording, input.entry);
      await this.repositories.recordingSessions.put(next);
      if (input.projectId) await this.writeProjectRecordingSession(input.projectId, next);
      return next;
    });
  }
  async finalizeRecording(input) {
    return await this.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.getRecordingSession(input.recordingId, input.projectId);
      const finalized = finalizeRecordingSession(recording, input.endedAt);
      await this.repositories.recordingSessions.put(finalized);
      if (input.projectId) await this.writeProjectRecordingSession(input.projectId, finalized);
      return finalized;
    });
  }
  async normalizeRecording(input) {
    const recording = await this.getRecordingSession(input.recordingId, input.projectId);
    const normalized = normalizeRecordingTimeline(recording, input.options);
    await this.repositories.normalizedTimelines.put(normalized);
    if (input.projectId) await this.writeProjectNormalizedTimeline(input.projectId, normalized);
    return normalized;
  }
  async updateRecording(input) {
    return await this.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.getRecordingSession(input.recordingId, input.projectId);
      const metadata = {
        ...recording.metadata ?? {},
        ...typeof input.name === "string" ? { name: input.name.trim() } : {},
        ...typeof input.archived === "boolean" ? { archived: input.archived } : {}
      };
      const next = { ...recording, metadata };
      await this.repositories.recordingSessions.put(next);
      if (input.projectId) await this.writeProjectRecordingSession(input.projectId, next);
      return next;
    });
  }
  async deleteRecording(input) {
    await this.repositories.recordingSessions.delete(input.recordingId);
    if (input.projectId && this.projectRootDir) {
      await rm2(this.projectFile(input.projectId, "recordings", "sessions", safeSegment(input.recordingId)), { recursive: true, force: true });
      await this.writeRecordingIndex(input.projectId, (index) => ({
        recordings: (index.recordings ?? []).filter((item) => item.recordingId !== input.recordingId),
        normalizedTimelines: index.normalizedTimelines ?? []
      }));
    }
    return { deletedRecordingId: input.recordingId };
  }
  async appendRecordingNoteEntry(input) {
    return await this.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.getRecordingSession(input.recordingId, input.projectId);
      const text = typeof input.text === "string" ? input.text.trim() : "";
      if (!text) throw new Error("Note text is required.");
      const linkedEntryIds = Array.isArray(input.linkedEntryIds) ? input.linkedEntryIds.map(String).filter(Boolean) : [];
      const next = appendRecordingNote(recording, {
        text,
        source: "typed",
        scope: input.endOffsetMs !== void 0 ? "interval" : linkedEntryIds.length ? "action" : "task",
        ...typeof input.startOffsetMs === "number" ? { startOffsetMs: input.startOffsetMs } : {},
        ...typeof input.endOffsetMs === "number" ? { endOffsetMs: input.endOffsetMs } : {},
        ...linkedEntryIds.length ? { linkedEntryIds } : {}
      });
      await this.repositories.recordingSessions.put(next);
      if (input.projectId) await this.writeProjectRecordingSession(input.projectId, next);
      return next;
    });
  }
  async appendRecordingMarkerEntry(input) {
    const label = typeof input.label === "string" ? input.label.trim() : "";
    if (!label) throw new Error("Marker label is required.");
    const appendInput = {
      recordingId: input.recordingId,
      entry: {
        type: "marker",
        label,
        ...typeof input.monotonicOffsetMs === "number" ? { monotonicOffsetMs: input.monotonicOffsetMs, timestamp: Date.now() } : {},
        metadata: typeof input.linkedEntryId === "string" ? { linkedEntryId: input.linkedEntryId } : {}
      }
    };
    if (input.projectId !== void 0) appendInput.projectId = input.projectId;
    return await this.appendRecordingEvent(appendInput);
  }
  async createNormalizationReview(input) {
    const recording = await this.getRecordingSession(input.recordingId, input.projectId);
    let normalized = (await this.listProjectNormalizedTimelines(input.projectId)).find((item) => item.recordingId === input.recordingId);
    normalized ??= await this.normalizeRecording({ projectId: input.projectId, recordingId: input.recordingId });
    const rawIds = new Set(recording.timeline.map((entry) => entry.id));
    const mappings = recording.timeline.map((entry) => ({
      rawEntryId: entry.id,
      normalizedEntryIds: normalized.timeline.filter((candidate) => candidate.id === entry.id || candidate.correlationId === entry.id || candidate.metadata?.normalizedFrom === entry.id).map((candidate) => candidate.id),
      status: "preserved"
    }));
    for (const entry of normalized.timeline) {
      const sourceId = typeof entry.metadata?.normalizedFrom === "string" ? entry.metadata.normalizedFrom : entry.correlationId;
      if (sourceId && rawIds.has(sourceId)) continue;
      if (!rawIds.has(entry.id)) mappings.push({ rawEntryId: sourceId ?? entry.id, normalizedEntryIds: [entry.id], status: "derived", reason: "Derived during normalization." });
    }
    const sorted = [...normalized.timeline].sort((left, right) => left.monotonicOffsetMs - right.monotonicOffsetMs);
    const waitClips = sorted.slice(1).map((entry, index) => ({
      beforeEntryId: sorted[index].id,
      afterEntryId: entry.id,
      waitMs: Math.max(0, entry.monotonicOffsetMs - sorted[index].monotonicOffsetMs)
    })).filter((item) => item.waitMs >= 250);
    const review = {
      schemaVersion: "0.1",
      reviewId: `review.${safeSegment(input.recordingId)}.${Date.now()}`,
      recordingId: input.recordingId,
      normalizedTimelineId: normalized.normalizedTimelineId,
      mappings,
      waitClips,
      issues: normalized.issues,
      generatedAt: Date.now()
    };
    await this.writePipelineArtifact(input.projectId, "normalizationReviews", review.reviewId, review);
    return review;
  }
  async mineRecordingEvidence(input) {
    const timeline = input.normalizedTimelineId ? await this.repositories.normalizedTimelines.get(input.normalizedTimelineId) : (await this.listProjectNormalizedTimelines(input.projectId)).find((item) => item.recordingId === input.recordingId);
    if (!timeline) throw new Error("Normalized timeline is required before mining.");
    const actions = timeline.timeline.filter((entry) => entry.type === "action" || entry.type === "domain_event");
    const deltas = timeline.timeline.filter((entry) => entry.type === "state_delta");
    const windows = actions.map((entry, index) => ({
      id: `window.${entry.id}`,
      kind: "immediate_post_action",
      actionEntryId: entry.id,
      startOffsetMs: entry.monotonicOffsetMs,
      endOffsetMs: actions[index + 1]?.monotonicOffsetMs ?? timeline.timeline[timeline.timeline.length - 1]?.monotonicOffsetMs ?? entry.monotonicOffsetMs,
      sourceEvidence: [{ layer: "normalized_timeline", artifactId: timeline.normalizedTimelineId, entryId: entry.id }]
    }));
    const actionEffects = actions.flatMap((action) => deltas.filter((delta) => delta.monotonicOffsetMs >= action.monotonicOffsetMs).slice(0, 3).flatMap((delta) => delta.deltas?.map((stateDelta) => ({
      actionOccurrenceId: action.id,
      signalPath: stateDelta.path,
      relationship: "possible_effect",
      probability: 0.55,
      delayMs: { min: Math.max(0, delta.monotonicOffsetMs - action.monotonicOffsetMs), median: Math.max(0, delta.monotonicOffsetMs - action.monotonicOffsetMs), max: Math.max(0, delta.monotonicOffsetMs - action.monotonicOffsetMs) },
      evidence: [{ layer: "normalized_timeline", artifactId: timeline.normalizedTimelineId, entryId: delta.id, signalPath: stateDelta.path }]
    })) ?? []));
    const conditionCandidates = [...new Map(actionEffects.map((effect) => [effect.signalPath, effect])).values()].map((effect) => ({
      signalPath: effect.signalPath,
      role: "context_signal",
      probability: 0.5,
      evidence: effect.evidence
    }));
    const result = {
      schemaVersion: "0.1",
      miningRunId: `mining.${safeSegment(timeline.normalizedTimelineId)}.${Date.now()}`,
      normalizedTimelineId: timeline.normalizedTimelineId,
      windows,
      actionEffects,
      conditionCandidates,
      issues: actions.length ? [] : ["No action/domain events were available to mine."],
      generatedAt: Date.now(),
      metadata: { recordingId: timeline.recordingId }
    };
    await this.writePipelineArtifact(input.projectId, "miningRuns", result.miningRunId, result);
    return result;
  }
  async learnTaskModel(input) {
    const miningRun = input.miningRunId ? await this.readPipelineArtifact(input.projectId, "miningRuns", input.miningRunId) : (await this.listPipelineArtifacts(input.projectId)).miningRuns[0];
    if (!miningRun) throw new Error("A mining run is required before learning a task model.");
    const taskId = input.taskId ?? String(miningRun.metadata?.taskId ?? miningRun.metadata?.recordingId ?? "task.learned");
    const actionClusters = miningRun.windows.filter((window) => window.actionEntryId).map((window, index) => ({
      id: `cluster.${index + 1}`,
      label: `Step ${index + 1}`,
      actionTemplate: { id: `action.${index + 1}`, actionType: "learned.action", parameters: {}, sourceEvidence: window.sourceEvidence },
      positiveRequirements: miningRun.conditionCandidates.slice(0, 3).map((candidate) => ({ signalPath: candidate.signalPath, operator: "exists", weight: candidate.probability })),
      negativeRequirements: [],
      expectedEffects: miningRun.actionEffects.filter((effect) => effect.actionOccurrenceId === window.actionEntryId).map((effect) => ({ signalPath: effect.signalPath, condition: { signalPath: effect.signalPath, operator: "changed" }, probability: effect.probability, evidence: effect.evidence })),
      possibleSideEffects: [],
      confidence: Math.min(0.85, 0.45 + miningRun.actionEffects.length * 0.05),
      sourceOccurrences: window.actionEntryId ? [window.actionEntryId] : []
    }));
    const transitions = actionClusters.slice(0, -1).map((cluster, index) => ({
      id: `transition.${index + 1}`,
      fromClusterId: cluster.id,
      toClusterId: actionClusters[index + 1].id,
      probability: 0.8,
      evidence: []
    }));
    const model = {
      schemaVersion: "0.1",
      learnedTaskModelId: `model.${safeSegment(taskId)}.${Date.now()}`,
      taskId,
      version: "0.1",
      actionClusters,
      transitions,
      invariants: miningRun.conditionCandidates.slice(0, 5).map((candidate) => ({ signalPath: candidate.signalPath, operator: "exists" })),
      unresolvedQuestions: miningRun.issues.map((issue, index) => ({ id: `question.${index + 1}`, question: issue, severity: "important", evidence: [] })),
      sourceRecordings: [String(miningRun.metadata?.recordingId ?? "")].filter(Boolean),
      sourceMiningRuns: [miningRun.miningRunId],
      generatedAt: Date.now()
    };
    await this.repositories.learnedTaskModels.put(model);
    await this.writePipelineArtifact(input.projectId, "learnedTaskModels", model.learnedTaskModelId, model);
    return model;
  }
  async proposePolicyFromModel(input) {
    const model = input.learnedTaskModelId ? await this.repositories.learnedTaskModels.get(input.learnedTaskModelId) ?? await this.readPipelineArtifact(input.projectId, "learnedTaskModels", input.learnedTaskModelId) : (await this.listPipelineArtifacts(input.projectId)).learnedTaskModels[0];
    if (!model) throw new Error("A learned task model is required before proposing a policy.");
    const nodes = model.actionClusters.map((cluster) => ({
      id: `node.${cluster.id}`,
      label: cluster.label,
      description: `Generated from ${cluster.sourceOccurrences.length} recorded occurrence(s).`,
      eligibility: { type: "all", conditions: cluster.positiveRequirements },
      actions: [{ ...cluster.actionTemplate, id: cluster.actionTemplate.id }],
      successConditions: { type: "all", conditions: cluster.expectedEffects.map((effect) => effect.condition) },
      failureConditions: { type: "none", conditions: [] },
      timeout: { timeoutMs: 5e3 },
      retry: { maxAttempts: 1, backoffMs: 500 },
      recovery: { strategy: "pause" },
      outgoingEdges: [],
      sourceEvidence: cluster.actionTemplate.sourceEvidence ?? [],
      generatedMetadata: { generatedBy: "signal_miner", generatedAt: Date.now(), confidence: cluster.confidence }
    }));
    const edges = model.transitions.map((transition) => ({
      id: `edge.${transition.id}`,
      fromNodeId: `node.${transition.fromClusterId}`,
      toNodeId: `node.${transition.toClusterId}`,
      label: "Next",
      probability: transition.probability
    }));
    const policy = {
      schemaVersion: "0.1",
      policyId: `policy.${safeSegment(model.taskId)}.${Date.now()}`,
      taskId: model.taskId,
      version: "0.1",
      nodes: nodes.map((node) => ({ ...node, outgoingEdges: edges.filter((edge) => edge.fromNodeId === node.id) })),
      edges,
      sourceEvidence: [{ layer: "learned_task_model", artifactId: model.learnedTaskModelId }],
      generatedMetadata: { generatedBy: "signal_miner", generatedAt: Date.now(), confidence: average(nodes.map((node) => node.generatedMetadata.confidence ?? 0)) },
      metadata: { learnedTaskModelId: model.learnedTaskModelId }
    };
    const proposal = {
      schemaVersion: "0.1",
      proposalId: `proposal.${safeSegment(policy.policyId)}`,
      learnedTaskModelId: model.learnedTaskModelId,
      policy,
      status: "draft",
      summary: `${policy.nodes.length} nodes and ${policy.edges.length} edges proposed from learned evidence.`,
      generatedAt: Date.now()
    };
    await this.writePipelineArtifact(input.projectId, "policyProposals", proposal.proposalId, proposal);
    return proposal;
  }
  async approvePolicyProposal(input) {
    const proposal = await this.readPipelineArtifact(input.projectId, "policyProposals", input.proposalId);
    if (!proposal) throw new Error("Unknown policy proposal.");
    const approved = { ...proposal, status: "approved", approvedAt: Date.now() };
    await this.repositories.policyGraphs.put(approved.policy);
    await this.writePipelineArtifact(input.projectId, "policyProposals", approved.proposalId, approved);
    await new ProgramJsonStore(this.projectFile(input.projectId, "policies", `${safeSegment(approved.policy.policyId)}.json`), () => ({})).write({ policy: approved.policy });
    return approved;
  }
  async replayPolicyAgainstRecording(input) {
    const recording = await this.getRecordingSession(input.recordingId, input.projectId);
    const proposalPolicy = (await this.listPipelineArtifacts(input.projectId)).policyProposals.find((proposal) => !input.policyId || proposal.policy.policyId === input.policyId)?.policy;
    const policy = input.policyId ? await this.repositories.policyGraphs.get(input.policyId) ?? proposalPolicy : proposalPolicy ?? (await this.repositories.policyGraphs.list())[0];
    if (!policy) throw new Error("A policy is required before replay.");
    const recordedActions = recording.timeline.filter((entry) => entry.type === "action" || entry.type === "domain_event").map((entry) => entry.actionType ?? entry.eventType);
    const expectedActions = policy.nodes.flatMap((node) => node.actions.map((action) => action.actionType));
    const missingActions = expectedActions.filter((action) => !recordedActions.includes(action));
    const unexpectedActions = recordedActions.filter((action) => !expectedActions.includes(action));
    const timingWarnings = recording.timeline.slice(1).flatMap((entry, index) => {
      const previous = recording.timeline[index];
      const gap = Math.max(0, entry.monotonicOffsetMs - previous.monotonicOffsetMs);
      return gap > 3e4 ? [`Long recorded wait before ${entry.id}: ${gap}ms`] : [];
    });
    const result = {
      schemaVersion: "0.1",
      replayId: `replay.${safeSegment(recording.recordingId)}.${Date.now()}`,
      recordingId: recording.recordingId,
      policyId: policy.policyId,
      status: missingActions.length ? recordedActions.length ? "partial" : "failed" : "matched",
      matchedActions: expectedActions.length - missingActions.length,
      expectedActions: expectedActions.length,
      missingActions,
      unexpectedActions,
      timingWarnings,
      generatedAt: Date.now()
    };
    await this.writePipelineArtifact(input.projectId, "replayResults", result.replayId, result);
    return result;
  }
  async inspectStateDiff(input) {
    return { deltas: diffStateSnapshots(input.previous, input.current, input.includeStable !== void 0 ? { includeStable: input.includeStable } : {}) };
  }
  async listSignalRegistries() {
    await this.ready;
    return await this.repositories.signalRegistries.list();
  }
  registerRecordingDomain(definition) {
    return this.recordingDomains.register(definition);
  }
  unregisterRecordingDomain(domainId) {
    return this.recordingDomains.unregister(domainId);
  }
  listRecordingDomains() {
    return this.recordingDomains.list();
  }
  validateRecordingDomainEvent(input) {
    return this.recordingDomains.validate(input);
  }
  async appendRecordingDomainEvent(input) {
    return await this.withRecordingMutationLock(input.projectId, input.recordingId, async () => {
      const recording = await this.getRecordingSession(input.recordingId, input.projectId);
      const result = await processRecordingDomainEvent(this.recordingDomains, recording, input);
      if (result.accepted) {
        await this.repositories.recordingSessions.put(result.recording);
        if (input.projectId) await this.writeProjectRecordingSession(input.projectId, result.recording);
      }
      return result;
    });
  }
  async listProjectArtifacts(projectId) {
    await this.findProject(projectId);
    return {
      tasks: await this.readProjectArtifactList(projectId, "tasks"),
      routines: await this.readProjectArtifactList(projectId, "routines"),
      configs: await this.readProjectArtifactList(projectId, "configs"),
      flows: await this.readProjectArtifactList(projectId, "flows")
    };
  }
  async saveProjectArtifact(input) {
    await this.findProject(input.projectId);
    if (!input.artifact || typeof input.artifact !== "object" || Array.isArray(input.artifact)) throw new Error("Artifact object is required.");
    const artifact = input.artifact;
    const id = this.projectArtifactId(input.kind, artifact);
    const now = Date.now();
    const withTimestamps = {
      ...artifact,
      schemaVersion: typeof artifact.schemaVersion === "string" ? artifact.schemaVersion : "0.1",
      createdAt: typeof artifact.createdAt === "number" ? artifact.createdAt : now,
      updatedAt: now
    };
    await new ProgramJsonStore(this.projectArtifactFile(input.projectId, input.kind, id), () => ({})).write(withTimestamps);
    return withTimestamps;
  }
  async getProjectArtifact(projectId, kind, artifactId) {
    await this.findProject(projectId);
    const artifact = await new ProgramJsonStore(this.projectArtifactFile(projectId, kind, artifactId), () => ({})).read();
    if (!Object.keys(artifact).length) throw new Error(`Unknown Automation Studio ${kind}: ${artifactId}`);
    return artifact;
  }
  async createDefaultFlow(input) {
    const flow = createBlankAutomationStudioFlow({
      flowId: `${input.ownerKind}.${safeSegment(input.ownerId)}.flow`,
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      name: input.name,
      ...input.description ? { description: input.description } : {}
    });
    await this.saveProjectArtifact({ projectId: input.projectId, kind: "flow", artifact: flow });
    return flow;
  }
  async listProjectNormalizedTimelines(projectId) {
    await this.loadProjectRecordings(projectId);
    const index = await this.readRecordingIndex(projectId);
    const timelines = [];
    for (const item of index.normalizedTimelines ?? []) {
      const timeline = await this.repositories.normalizedTimelines.get(item.normalizedTimelineId);
      if (timeline) timelines.push(timeline);
    }
    return timelines;
  }
  async startRuntimeSession(input) {
    const flow = input.flow ?? (input.projectId && input.flowId ? await this.getProjectArtifact(input.projectId, "flow", input.flowId) : void 0);
    if (!flow) throw new Error("A flow document or project flow ID is required.");
    const now = Date.now();
    const session = {
      schemaVersion: "0.1",
      runId: randomUUID2(),
      ...input.projectId !== void 0 ? { projectId: input.projectId } : {},
      targetKind: input.targetKind ?? (flow.ownerKind === "policy" ? "flow" : flow.ownerKind),
      targetId: input.targetId ?? flow.ownerId,
      flowId: flow.flowId,
      status: "queued",
      queuedAt: now,
      flow,
      metadata: { ...input.metadata ?? {}, inputs: input.inputs ?? {} }
    };
    if (input.projectId) await this.writeRuntimeSession(input.projectId, session);
    return session;
  }
  async runRuntimeSession(input) {
    const existing = input.projectId && input.runId ? await this.getRuntimeSession(input.projectId, input.runId) : null;
    const startInput = {};
    if (input.projectId !== void 0) startInput.projectId = input.projectId;
    if (input.flow !== void 0) startInput.flow = input.flow;
    if (input.flowId !== void 0) startInput.flowId = input.flowId;
    if (input.inputs !== void 0) startInput.inputs = input.inputs;
    const session = existing ?? await this.startRuntimeSession(startInput);
    const startedAt = Date.now();
    const graphOptions = {
      inputs: input.inputs ?? session.metadata?.inputs ?? {}
    };
    if (input.maxSteps !== void 0) graphOptions.maxSteps = input.maxSteps;
    const trace = await runAutomationStudioGraph(session.flow, graphOptions);
    const next = {
      ...session,
      status: trace.status,
      startedAt: session.startedAt ?? startedAt,
      ...trace.finishedAt !== void 0 ? { finishedAt: trace.finishedAt } : {},
      trace
    };
    if (input.projectId) await this.writeRuntimeSession(input.projectId, next);
    return next;
  }
  async getRuntimeSession(projectId, runId) {
    await this.findProject(projectId);
    const stored = await new ProgramJsonStore(this.projectFile(projectId, "runtime", "sessions", `${safeSegment(runId)}.json`), () => ({})).read();
    return stored.session ?? null;
  }
  async listRuntimeSessions(projectId) {
    const index = await this.readRuntimeIndex(projectId);
    const sessions = [];
    for (const item of index.sessions ?? []) {
      const session = await this.getRuntimeSession(projectId, item.runId);
      if (session) sessions.push(session);
    }
    return sessions.sort((left, right) => (right.startedAt ?? right.queuedAt) - (left.startedAt ?? left.queuedAt));
  }
  async listPipelineArtifacts(projectId) {
    const index = await this.readPipelineIndex(projectId);
    const normalizationReviews = await this.readPipelineArtifactList(projectId, "normalizationReviews", index.normalizationReviews.map((item) => item.reviewId));
    const miningRuns = await this.readPipelineArtifactList(projectId, "miningRuns", index.miningRuns.map((item) => item.miningRunId));
    const learnedTaskModels = await this.readPipelineArtifactList(projectId, "learnedTaskModels", index.learnedTaskModels.map((item) => item.learnedTaskModelId));
    const policyProposals = await this.readPipelineArtifactList(projectId, "policyProposals", index.policyProposals.map((item) => item.proposalId));
    const replayResults = await this.readPipelineArtifactList(projectId, "replayResults", index.replayResults.map((item) => item.replayId));
    return { normalizationReviews, miningRuns, learnedTaskModels, policyProposals, replayResults };
  }
  async listProjects() {
    const state = await this.readProjectIndex();
    return {
      categories: this.sortCategories(state.categories ?? []),
      projects: state.projects.sort((left, right) => right.updatedAt - left.updatedAt)
    };
  }
  async createProject(input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new Error("Project name is required.");
    const now = Date.now();
    const categoryId = typeof input.categoryId === "string" && input.categoryId.trim() ? input.categoryId.trim() : null;
    const project = {
      id: randomUUID2(),
      name,
      description: typeof input.description === "string" ? input.description.trim() : "",
      categoryId,
      createdAt: now,
      updatedAt: now
    };
    await this.writeProjectIndex((state) => ({ ...state, projects: [project, ...state.projects] }));
    await this.writeProjectRecord({ ...project, customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} });
    return project;
  }
  async updateProject(input) {
    const projectId = String(input.projectId ?? "");
    const name = typeof input.name === "string" ? input.name.trim() : void 0;
    if (name !== void 0 && !name) throw new Error("Project name is required.");
    let updated;
    await this.writeProjectIndex((state) => ({
      ...state,
      projects: state.projects.map((project) => {
        if (project.id !== projectId) return project;
        updated = {
          ...project,
          ...name !== void 0 ? { name } : {},
          ...typeof input.description === "string" ? { description: input.description.trim() } : {},
          ...input.categoryId !== void 0 ? { categoryId: typeof input.categoryId === "string" && input.categoryId.trim() ? input.categoryId.trim() : null } : {},
          updatedAt: Date.now()
        };
        return updated;
      })
    }));
    if (!updated) throw new Error(`Unknown Automation Studio project: ${projectId}`);
    const existing = await this.findProject(projectId);
    await this.writeProjectRecord({ ...existing, ...updated });
    return updated;
  }
  async deleteProject(projectId) {
    await this.findProject(projectId);
    await this.writeProjectIndex((state) => ({
      ...state,
      projects: state.projects.filter((project) => project.id !== projectId)
    }));
    if (this.projectRootDir) await rm2(this.projectDirectory(projectId), { recursive: true, force: true });
    return { deletedProjectId: projectId };
  }
  async createProjectCategory(input) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new Error("Category name is required.");
    const now = Date.now();
    const state = await this.readProjectIndex();
    const category = { id: randomUUID2(), name, order: nextCategoryOrder(state.categories), createdAt: now, updatedAt: now };
    await this.writeProjectIndex((state2) => ({ ...state2, categories: [category, ...state2.categories ?? []] }));
    return category;
  }
  async updateProjectCategory(input) {
    const categoryId = String(input.categoryId ?? "");
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new Error("Category name is required.");
    let updated;
    await this.writeProjectIndex((state) => ({
      ...state,
      categories: (state.categories ?? []).map((category) => {
        if (category.id !== categoryId) return category;
        updated = { ...category, name, updatedAt: Date.now() };
        return updated;
      })
    }));
    if (!updated) throw new Error(`Unknown Automation Studio project category: ${categoryId}`);
    return updated;
  }
  async deleteProjectCategory(categoryId) {
    const affectedProjects = [];
    await this.writeProjectIndex((state) => ({
      ...state,
      categories: (state.categories ?? []).filter((category) => category.id !== categoryId),
      projects: state.projects.map((project) => {
        if (project.categoryId !== categoryId) return project;
        const updated = { ...project, categoryId: null, updatedAt: Date.now() };
        affectedProjects.push(updated);
        return updated;
      })
    }));
    for (const project of affectedProjects) {
      const existing = await this.findProject(project.id);
      await this.writeProjectRecord({ ...existing, ...project });
    }
    return { deletedCategoryId: categoryId };
  }
  async reorderProjectCategories(categoryIds) {
    const requestedIds = categoryIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim());
    let categories = [];
    await this.writeProjectIndex((state) => {
      const requested = new Set(requestedIds);
      const known = new Set((state.categories ?? []).map((category) => category.id));
      if (requestedIds.some((id) => !known.has(id))) throw new Error("Unknown Automation Studio project category in reorder request.");
      const orderedIds = [...requestedIds, ...(state.categories ?? []).filter((category) => !requested.has(category.id)).map((category) => category.id)];
      const orderById = new Map(orderedIds.map((id, index) => [id, index]));
      categories = (state.categories ?? []).map((category) => ({ ...category, order: orderById.get(category.id) ?? category.order, updatedAt: Date.now() }));
      return { ...state, categories };
    });
    return { categories: this.sortCategories(categories) };
  }
  async getProjectHierarchy(projectId) {
    const project = await this.findProject(projectId);
    return {
      customHierarchyNodes: project.customHierarchyNodes,
      deletedHierarchyIds: project.deletedHierarchyIds,
      workspacePrefs: project.workspacePrefs ?? {}
    };
  }
  async saveProjectHierarchy(projectId, hierarchy) {
    const nextHierarchy = {
      customHierarchyNodes: Array.isArray(hierarchy.customHierarchyNodes) ? hierarchy.customHierarchyNodes : [],
      deletedHierarchyIds: Array.isArray(hierarchy.deletedHierarchyIds) ? hierarchy.deletedHierarchyIds : [],
      workspacePrefs: hierarchy.workspacePrefs && typeof hierarchy.workspacePrefs === "object" && !Array.isArray(hierarchy.workspacePrefs) ? hierarchy.workspacePrefs : {}
    };
    let updatedProject;
    await this.writeProjectIndex((state) => ({
      ...state,
      projects: state.projects.map((project) => {
        if (project.id !== projectId) return project;
        updatedProject = { ...project, updatedAt: Date.now() };
        return updatedProject;
      })
    }));
    if (!updatedProject) throw new Error(`Unknown Automation Studio project: ${projectId}`);
    await this.writeProjectRecord({ ...updatedProject, ...nextHierarchy });
    return nextHierarchy;
  }
  async readProjectIndex() {
    await this.ensureStorageReady();
    const state = this.projectIndexStore ? await this.projectIndexStore.read() : { categories: [], projects: [] };
    return { categories: normalizeProjectCategories(state.categories ?? []), projects: state.projects ?? [] };
  }
  async writeProjectIndex(mutator) {
    await this.ensureStorageReady();
    if (!this.projectIndexStore) return mutator({ categories: [], projects: [] });
    return await this.projectIndexStore.update((state) => mutator({ categories: normalizeProjectCategories(state.categories ?? []), projects: state.projects ?? [] }));
  }
  sortCategories(categories) {
    return [...normalizeProjectCategories(categories)].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }
  async findProject(projectId) {
    const state = await this.readProjectIndex();
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) throw new Error(`Unknown Automation Studio project: ${projectId}`);
    return await this.readProjectRecord(project);
  }
  async readProjectRecord(project) {
    if (!this.projectRootDir) return { ...project, customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} };
    await this.ensureProjectStructure(project.id);
    const legacyHierarchy = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "index.json"), () => ({ customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} })).read();
    const nodes = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "nodes.json"), () => ({ customHierarchyNodes: legacyHierarchy.customHierarchyNodes ?? [] })).read();
    const deleted = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "deleted.json"), () => ({ deletedHierarchyIds: legacyHierarchy.deletedHierarchyIds ?? [] })).read();
    const workspace = await new ProgramJsonStore(this.projectFile(project.id, "workspace", "preferences.json"), () => ({ workspacePrefs: legacyHierarchy.workspacePrefs ?? {} })).read();
    return {
      ...project,
      customHierarchyNodes: Array.isArray(nodes.customHierarchyNodes) ? nodes.customHierarchyNodes : [],
      deletedHierarchyIds: Array.isArray(deleted.deletedHierarchyIds) ? deleted.deletedHierarchyIds : [],
      workspacePrefs: workspace.workspacePrefs && typeof workspace.workspacePrefs === "object" && !Array.isArray(workspace.workspacePrefs) ? workspace.workspacePrefs : {}
    };
  }
  async writeProjectRecord(project) {
    if (!this.projectRootDir) return;
    await this.ensureProjectStructure(project.id);
    const { customHierarchyNodes, deletedHierarchyIds, workspacePrefs, ...manifest } = project;
    await new ProgramJsonStore(this.projectFile(project.id, "manifest.json"), () => ({})).write(manifest);
    await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "nodes.json"), () => ({ customHierarchyNodes: [] })).write({ customHierarchyNodes });
    await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "deleted.json"), () => ({ deletedHierarchyIds: [] })).write({ deletedHierarchyIds });
    await new ProgramJsonStore(this.projectFile(project.id, "workspace", "preferences.json"), () => ({ workspacePrefs: {} })).write({ workspacePrefs });
  }
  async migrateLegacyProjectStore() {
    if (!this.projectIndexStore || !this.legacyProjectStore) return;
    const index = await this.projectIndexStore.read();
    if (index.projects.length > 0 || index.categories.length > 0) return;
    const legacy = await this.legacyProjectStore.read();
    if (!legacy.projects.length && !legacy.categories.length) return;
    await this.projectIndexStore.write({
      categories: normalizeProjectCategories(legacy.categories ?? []),
      projects: legacy.projects.map(({ customHierarchyNodes: _customHierarchyNodes, deletedHierarchyIds: _deletedHierarchyIds, workspacePrefs: _workspacePrefs, ...project }) => project)
    });
    for (const project of legacy.projects) await this.writeProjectRecord(project);
  }
  async prepareStorage() {
    await this.ensureNodeLibraryStructure();
    await this.migrateLegacyProjectStore();
  }
  async ensureStorageReady() {
    this.storageReady ??= this.prepareStorage();
    await this.storageReady;
  }
  async ensureNodeLibraryStructure() {
    if (!this.nodeRootDir) return;
    await Promise.all([
      mkdir2(path2.join(this.nodeRootDir, "custom"), { recursive: true }),
      mkdir2(path2.join(this.nodeRootDir, "packages"), { recursive: true }),
      ...automationNodeClasses.map((nodeClass) => mkdir2(path2.join(this.nodeRootDir, "custom", nodeClass), { recursive: true }))
    ]);
  }
  async ensureProjectStructure(projectId) {
    if (!this.projectRootDir) return;
    const root = this.projectDirectory(projectId);
    await Promise.all([
      mkdir2(root, { recursive: true }),
      mkdir2(path2.join(root, "hierarchy"), { recursive: true }),
      mkdir2(path2.join(root, "workspace"), { recursive: true }),
      mkdir2(path2.join(root, "tasks"), { recursive: true }),
      mkdir2(path2.join(root, "routines"), { recursive: true }),
      mkdir2(path2.join(root, "configs"), { recursive: true }),
      mkdir2(path2.join(root, "flows"), { recursive: true }),
      mkdir2(path2.join(root, "recordings"), { recursive: true }),
      mkdir2(path2.join(root, "recordings", "sessions"), { recursive: true }),
      mkdir2(path2.join(root, "recordings", "normalized"), { recursive: true }),
      mkdir2(path2.join(root, "recordings", "snapshots"), { recursive: true }),
      mkdir2(path2.join(root, "recordings", "indexes"), { recursive: true }),
      mkdir2(path2.join(root, "policies"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "normalization-reviews"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "mining-runs"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "learned-task-models"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "policy-proposals"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "replay-results"), { recursive: true }),
      mkdir2(path2.join(root, "pipeline", "indexes"), { recursive: true }),
      mkdir2(path2.join(root, "runtime"), { recursive: true }),
      mkdir2(path2.join(root, "runtime", "sessions"), { recursive: true }),
      mkdir2(path2.join(root, "runtime", "indexes"), { recursive: true }),
      mkdir2(path2.join(root, "state"), { recursive: true }),
      mkdir2(path2.join(root, "custom-nodes"), { recursive: true }),
      mkdir2(path2.join(root, "artifacts"), { recursive: true })
    ]);
  }
  projectDirectory(projectId) {
    if (!this.projectRootDir) return "";
    return path2.join(this.projectRootDir, safeSegment(projectId));
  }
  projectFile(projectId, ...parts) {
    return path2.join(this.projectDirectory(projectId), ...parts);
  }
  async readRecordingIndex(projectId) {
    await this.findProject(projectId);
    return await new ProgramJsonStore(this.projectFile(projectId, "recordings", "indexes", "recordings.json"), () => ({ recordings: [], normalizedTimelines: [] })).read();
  }
  async readRuntimeIndex(projectId) {
    await this.findProject(projectId);
    return await new ProgramJsonStore(this.projectFile(projectId, "runtime", "indexes", "sessions.json"), () => ({ sessions: [] })).read();
  }
  async readPipelineIndex(projectId) {
    await this.findProject(projectId);
    return await new ProgramJsonStore(this.projectFile(projectId, "pipeline", "indexes", "pipeline.json"), () => emptyPipelineIndex()).read();
  }
  async writeRuntimeSession(projectId, session) {
    await this.ensureProjectStructure(projectId);
    await new ProgramJsonStore(this.projectFile(projectId, "runtime", "sessions", `${safeSegment(session.runId)}.json`), () => ({})).write({ session });
    await new ProgramJsonStore(this.projectFile(projectId, "runtime", "indexes", "sessions.json"), () => ({ sessions: [] })).update((index) => ({
      sessions: upsertBy(index.sessions ?? [], "runId", {
        runId: session.runId,
        targetKind: session.targetKind,
        targetId: session.targetId,
        status: session.status,
        updatedAt: Date.now()
      })
    }));
  }
  pipelineFolder(kind) {
    if (kind === "normalizationReviews") return "normalization-reviews";
    if (kind === "miningRuns") return "mining-runs";
    if (kind === "learnedTaskModels") return "learned-task-models";
    if (kind === "policyProposals") return "policy-proposals";
    return "replay-results";
  }
  async writePipelineArtifact(projectId, kind, id, artifact) {
    await this.ensureProjectStructure(projectId);
    await new ProgramJsonStore(this.projectFile(projectId, "pipeline", this.pipelineFolder(kind), `${safeSegment(id)}.json`), () => ({})).write(artifact);
    await new ProgramJsonStore(this.projectFile(projectId, "pipeline", "indexes", "pipeline.json"), () => emptyPipelineIndex()).update((index) => upsertPipelineIndex(index, kind, id, Date.now(), artifact.status));
  }
  async readPipelineArtifact(projectId, kind, id) {
    await this.ensureProjectStructure(projectId);
    const artifact = await new ProgramJsonStore(this.projectFile(projectId, "pipeline", this.pipelineFolder(kind), `${safeSegment(id)}.json`), () => ({})).read();
    return Object.keys(artifact).length ? artifact : null;
  }
  async readPipelineArtifactList(projectId, kind, ids) {
    const artifacts = [];
    for (const id of ids) {
      const artifact = await this.readPipelineArtifact(projectId, kind, id);
      if (artifact) artifacts.push(artifact);
    }
    return artifacts;
  }
  async readProjectArtifactList(projectId, folder) {
    await this.ensureProjectStructure(projectId);
    if (!this.projectRootDir) return [];
    const dir = path2.join(this.projectDirectory(projectId), folder);
    let files = [];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }
    const artifacts = [];
    for (const file of files.filter((item) => item.endsWith(".json"))) {
      const data = await new ProgramJsonStore(path2.join(dir, file), () => ({})).read();
      if (Object.keys(data).length) artifacts.push(data);
    }
    return artifacts;
  }
  projectArtifactFile(projectId, kind, artifactId) {
    return this.projectFile(projectId, this.projectArtifactFolder(kind), `${safeSegment(artifactId)}.json`);
  }
  projectArtifactFolder(kind) {
    if (kind === "task") return "tasks";
    if (kind === "routine") return "routines";
    if (kind === "config") return "configs";
    return "flows";
  }
  projectArtifactId(kind, artifact) {
    const id = kind === "task" ? artifact.taskId : kind === "routine" ? artifact.routineId : kind === "config" ? artifact.configId : artifact.flowId;
    if (typeof id !== "string" || !id.trim()) throw new Error(`${kind} ID is required.`);
    return id;
  }
  async writeRecordingIndex(projectId, mutator) {
    await this.findProject(projectId);
    return await new ProgramJsonStore(this.projectFile(projectId, "recordings", "indexes", "recordings.json"), () => ({ recordings: [], normalizedTimelines: [] })).update(mutator);
  }
  async withRecordingMutationLock(projectId, recordingId, operation) {
    const key = `${safeSegment(projectId ?? "global")}:${safeSegment(recordingId)}`;
    const previous = this.recordingMutationLocks.get(key) ?? Promise.resolve();
    let release = () => void 0;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current, () => current);
    this.recordingMutationLocks.set(key, chained);
    await previous.catch(() => void 0);
    try {
      return await operation();
    } finally {
      release();
      if (this.recordingMutationLocks.get(key) === chained) this.recordingMutationLocks.delete(key);
    }
  }
  async writeProjectRecordingSession(projectId, recording) {
    await this.ensureProjectStructure(projectId);
    const recordingId = safeSegment(recording.recordingId);
    const sessionDir = path2.join(this.projectDirectory(projectId), "recordings", "sessions", recordingId);
    await mkdir2(path2.join(sessionDir, "events"), { recursive: true });
    await mkdir2(path2.join(sessionDir, "snapshots"), { recursive: true });
    await new ProgramJsonStore(path2.join(sessionDir, "recording.json"), () => ({ recording })).write({ recording });
    await new ProgramJsonStore(path2.join(sessionDir, "events", "timeline.json"), () => ({ timeline: [] })).write({ timeline: recording.timeline });
    await new ProgramJsonStore(path2.join(sessionDir, "snapshots", "initial-state.json"), () => ({ initialState: recording.initialState })).write({ initialState: recording.initialState });
    await this.writeRecordingIndex(projectId, (index) => ({
      recordings: upsertBy(index.recordings ?? [], "recordingId", {
        recordingId: recording.recordingId,
        ...recording.taskId !== void 0 ? { taskId: recording.taskId } : {},
        startedAt: recording.startedAt,
        ...recording.endedAt !== void 0 ? { endedAt: recording.endedAt } : {},
        updatedAt: Date.now()
      }),
      normalizedTimelines: index.normalizedTimelines ?? []
    }));
  }
  async writeProjectNormalizedTimeline(projectId, normalized) {
    await this.ensureProjectStructure(projectId);
    const fileName = `${safeSegment(normalized.normalizedTimelineId)}.json`;
    await new ProgramJsonStore(this.projectFile(projectId, "recordings", "normalized", fileName), () => ({ normalizedTimeline: normalized })).write({ normalizedTimeline: normalized });
    await this.writeRecordingIndex(projectId, (index) => ({
      recordings: index.recordings ?? [],
      normalizedTimelines: upsertBy(index.normalizedTimelines ?? [], "normalizedTimelineId", {
        normalizedTimelineId: normalized.normalizedTimelineId,
        recordingId: normalized.recordingId,
        generatedAt: normalized.generatedAt
      })
    }));
  }
  async loadProjectRecordings(projectId) {
    if (!this.projectRootDir) return;
    const index = await this.readRecordingIndex(projectId);
    for (const item of index.recordings ?? []) {
      const stored = await new ProgramJsonStore(
        this.projectFile(projectId, "recordings", "sessions", safeSegment(item.recordingId), "recording.json"),
        () => ({})
      ).read();
      const recording = stored.recording;
      if (recording?.recordingId) await this.repositories.recordingSessions.put(recording);
    }
    for (const item of index.normalizedTimelines ?? []) {
      const stored = await new ProgramJsonStore(
        this.projectFile(projectId, "recordings", "normalized", `${safeSegment(item.normalizedTimelineId)}.json`),
        () => ({})
      ).read();
      const normalized = stored.normalizedTimeline;
      if (normalized?.normalizedTimelineId) await this.repositories.normalizedTimelines.put(normalized);
    }
  }
  async seedFixture() {
    const fixture = createAutomationStudioFixture();
    await this.repositories.recordingSessions.put(fixture.recording);
    await this.repositories.normalizedTimelines.put(fixture.normalizedTimeline);
    await this.repositories.signalRegistries.put(fixture.signalRegistry);
    await this.repositories.learnedTaskModels.put(fixture.learnedTaskModel);
    await this.repositories.policyGraphs.put(fixture.policy);
  }
};
function normalizeProjectCategories(categories) {
  return categories.map((category, index) => ({
    ...category,
    order: typeof category.order === "number" && Number.isFinite(category.order) ? category.order : index
  }));
}
function nextCategoryOrder(categories) {
  if (!categories.length) return 0;
  return Math.max(...normalizeProjectCategories(categories).map((category) => category.order)) + 1;
}
function upsertBy(items, key, item) {
  const index = items.findIndex((candidate) => candidate[key] === item[key]);
  if (index < 0) return [item, ...items];
  return items.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate);
}
function emptyPipelineIndex() {
  return { normalizationReviews: [], miningRuns: [], learnedTaskModels: [], policyProposals: [], replayResults: [] };
}
function upsertPipelineIndex(index, kind, id, generatedAt, status) {
  const item = kind === "normalizationReviews" ? { reviewId: id, generatedAt } : kind === "miningRuns" ? { miningRunId: id, generatedAt } : kind === "learnedTaskModels" ? { learnedTaskModelId: id, generatedAt } : kind === "policyProposals" ? { proposalId: id, generatedAt, status: status === "approved" ? "approved" : "draft" } : { replayId: id, generatedAt };
  const key = Object.keys(item)[0];
  return {
    ...emptyPipelineIndex(),
    ...index,
    [kind]: upsertBy(index[kind] ?? [], key, item).sort((left, right) => right.generatedAt - left.generatedAt)
  };
}
function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : 0;
}

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
var WEB_AUTOMATION_SCHEMA_VERSION = "0.1";
var WEB_AUTOMATION_EVENTS = {
  clientReady: "web.client.ready",
  tabStateChanged: "web.tab.state_changed",
  pageNavigated: "web.page.navigated",
  elementClicked: "web.element.clicked",
  elementInputChanged: "web.element.input_changed",
  elementChanged: "web.element.changed",
  formSubmitted: "web.form.submitted",
  elementFocused: "web.element.focused",
  elementBlurred: "web.element.blurred",
  keyboardPressed: "web.keyboard.pressed",
  mouseWheel: "web.mouse.wheel",
  scrollChanged: "web.scroll.changed",
  domMutated: "web.dom.mutated",
  snapshotCaptured: "web.snapshot.captured",
  actionExecuted: "web.action.executed",
  clientError: "web.client.error"
};

// src/actions/schemas.ts
var selectorSchema = {
  type: "object",
  properties: {
    selector: { type: "string", label: "CSS selector" },
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var webAutomationActionDefinitions = [
  {
    actionType: "web.browser.navigate",
    label: "Navigate",
    description: "Navigate a browser tab to a URL.",
    parameterSchema: { type: "object", required: ["url"], properties: { url: { type: "string", label: "URL" } } }
  },
  { actionType: "web.dom.click", label: "Click", description: "Click a DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.type",
    label: "Type Text",
    description: "Enter text into an editable DOM element.",
    parameterSchema: { type: "object", required: ["selector"], properties: { selector: { type: "string" }, text: { type: "string" }, value: { type: "string" } } }
  },
  { actionType: "web.dom.clear", label: "Clear Field", description: "Clear an editable DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.select",
    label: "Select Option",
    description: "Set a select element value.",
    parameterSchema: { type: "object", required: ["selector"], properties: { selector: { type: "string" }, value: { type: "string" } } }
  },
  {
    actionType: "web.dom.scroll",
    label: "Scroll",
    description: "Scroll the page or targeted context.",
    parameterSchema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, smooth: { type: "boolean" } } }
  },
  {
    actionType: "web.dom.keypress",
    label: "Key Press",
    description: "Dispatch a keyboard event.",
    parameterSchema: { type: "object", properties: { selector: { type: "string" }, key: { type: "string" }, text: { type: "string" } } }
  },
  { actionType: "web.dom.wait_for_selector", label: "Wait For Selector", description: "Wait until an element exists.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.wait_for_text",
    label: "Wait For Text",
    description: "Wait until page text appears.",
    parameterSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, timeoutMs: { type: "integer" } } }
  },
  { actionType: "web.dom.extract", label: "Extract", description: "Extract text, value, or attributes from an element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.capture_snapshot",
    label: "Capture Snapshot",
    description: "Capture a structured DOM snapshot.",
    parameterSchema: { type: "object", properties: {} }
  }
];

// src/recording/observations.ts
var webAutomationObservationExtractor = ({ event: event3 }) => ({
  observationType: event3.eventType,
  ...event3.payload !== void 0 ? { payload: event3.payload } : {},
  metadata: {
    domainId: event3.domainId,
    eventType: event3.eventType,
    ...event3.metadata ?? {}
  }
});

// src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";
function createWebAutomationInitialState(timestamp = Date.now()) {
  return {
    timestamp,
    namespaces: {
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        schemaId: WEB_AUTOMATION_DOMAIN_ID,
        schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
        values: {},
        metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
      }
    }
  };
}
function withWebStateValue(snapshot, path3, value, input = {}) {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {}
  };
  const observedAt = input.observedAt ?? Date.now();
  const nextValue = {
    type: inferStateType(value),
    value,
    observedAt,
    ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
    volatility: "normal",
    comparable: true,
    ...input.metadata !== void 0 ? { metadata: input.metadata } : {}
  };
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path3]: nextValue
        }
      }
    }
  };
}
function inferStateType(value) {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

// src/recording/reducers.ts
var webAutomationStateReducer = ({ event: event3, previousState }) => {
  const payload = event3.payload ?? {};
  const timestamp = event3.timestamp ?? Date.now();
  let next = previousState;
  const source = {
    observedAt: timestamp,
    ...event3.sourceId !== void 0 ? { sourceId: event3.sourceId } : {},
    metadata: { eventType: event3.eventType }
  };
  if (typeof payload.url === "string") next = withWebStateValue(next, "page.url", payload.url, source);
  if (typeof payload.title === "string") next = withWebStateValue(next, "page.title", payload.title, source);
  if (payload.viewport && typeof payload.viewport === "object") next = withWebStateValue(next, "page.viewport", payload.viewport, source);
  if (payload.element && typeof payload.element === "object") next = withWebStateValue(next, "page.lastInteraction", payload.element, source);
  if (typeof payload.inputValue === "string" && event3.target?.selector) {
    next = withWebStateValue(next, `forms.${String(event3.target.selector)}`, payload.inputValue, source);
  }
  if (payload.scroll && typeof payload.scroll === "object") next = withWebStateValue(next, "page.scroll", payload.scroll, source);
  if (payload.snapshot && typeof payload.snapshot === "object") next = withWebStateValue(next, "page.latestSnapshot", payload.snapshot, source);
  if (payload.actionResult && typeof payload.actionResult === "object") next = withWebStateValue(next, "runtime.lastActionResult", payload.actionResult, source);
  if (event3.eventType === "web.client.error") next = withWebStateValue(next, "runtime.lastError", payload, source);
  return next;
};

// src/recording/events.ts
var elementSchema = {
  type: "object",
  properties: {
    selector: { type: "string", label: "Selector" },
    tagName: { type: "string", label: "Tag name" },
    text: { type: "string", label: "Text" },
    value: { type: "string", label: "Value" },
    role: { type: "string", label: "ARIA role" },
    name: { type: "string", label: "Accessible name" },
    bounds: { type: "object", label: "Bounds" },
    attributes: { type: "object", label: "Attributes" }
  }
};
var basePayloadSchema = {
  type: "object",
  required: true,
  properties: {
    url: { type: "string", label: "URL" },
    title: { type: "string", label: "Title" },
    sequence: { type: "integer", label: "Sequence" },
    element: elementSchema,
    inputValue: { type: "string", label: "Input value" },
    key: { type: "string", label: "Key" },
    scroll: { type: "object", label: "Scroll position" },
    mutation: { type: "object", label: "DOM mutation summary" },
    snapshot: { type: "object", label: "Snapshot" },
    actionResult: { type: "object", label: "Action result" },
    recordingState: { type: "string", label: "Recording state" }
  }
};
function event(eventType, label, description) {
  return {
    eventType,
    label,
    description,
    payloadSchema: basePayloadSchema,
    stateReducer: webAutomationStateReducer,
    observationExtractor: webAutomationObservationExtractor
  };
}
var webAutomationRecordingEvents = [
  event(WEB_AUTOMATION_EVENTS.clientReady, "Client ready", "The web automation client became available in a page context."),
  event(WEB_AUTOMATION_EVENTS.tabStateChanged, "Tab state changed", "The active tab or tab metadata changed."),
  event(WEB_AUTOMATION_EVENTS.pageNavigated, "Page navigated", "The active web page navigated."),
  event(WEB_AUTOMATION_EVENTS.elementClicked, "Element clicked", "A user clicked a DOM element."),
  event(WEB_AUTOMATION_EVENTS.elementInputChanged, "Input changed", "A user changed text or input state."),
  event(WEB_AUTOMATION_EVENTS.elementChanged, "Element changed", "A DOM control changed value."),
  event(WEB_AUTOMATION_EVENTS.formSubmitted, "Form submitted", "A form was submitted."),
  event(WEB_AUTOMATION_EVENTS.elementFocused, "Element focused", "A DOM element received focus."),
  event(WEB_AUTOMATION_EVENTS.elementBlurred, "Element blurred", "A DOM element lost focus."),
  event(WEB_AUTOMATION_EVENTS.keyboardPressed, "Keyboard pressed", "A keyboard event was recorded."),
  event(WEB_AUTOMATION_EVENTS.mouseWheel, "Mouse wheel", "A user moved the mouse wheel or equivalent pointing-device wheel input."),
  event(WEB_AUTOMATION_EVENTS.scrollChanged, "Scroll changed", "The page or context scroll position changed."),
  event(WEB_AUTOMATION_EVENTS.domMutated, "DOM mutated", "A DOM mutation summary was recorded."),
  event(WEB_AUTOMATION_EVENTS.snapshotCaptured, "Snapshot captured", "A structured page snapshot was captured."),
  event(WEB_AUTOMATION_EVENTS.actionExecuted, "Action executed", "A requested automation action completed."),
  event(WEB_AUTOMATION_EVENTS.clientError, "Client error", "The client reported an error.")
];

// src/recording/domain.ts
var webAutomationRecordingDomain = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  label: "Web Automation",
  schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
  description: "Validated recording events, state updates, and observations for browser-based web automation.",
  events: webAutomationRecordingEvents,
  statePaths: [
    { namespace: "web", path: "page.url", type: "string", label: "Page URL", volatility: "normal" },
    { namespace: "web", path: "page.title", type: "string", label: "Page title", volatility: "normal" },
    { namespace: "web", path: "page.viewport", type: "json", label: "Viewport", volatility: "normal" },
    { namespace: "web", path: "page.lastInteraction", type: "json", label: "Last interaction", volatility: "rapid" },
    { namespace: "web", path: "page.scroll", type: "json", label: "Scroll", volatility: "rapid" },
    { namespace: "web", path: "page.latestSnapshot", type: "json", label: "Latest snapshot", volatility: "normal" },
    { namespace: "web", path: "runtime.lastActionResult", type: "json", label: "Last action result", volatility: "normal" },
    { namespace: "web", path: "runtime.lastError", type: "json", label: "Last client error", volatility: "normal" }
  ],
  metadata: {
    actionDefinitions: webAutomationActionDefinitions
  }
};

// src/actions/types.ts
var LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION = {
  "browser.navigate": "web.browser.navigate",
  "dom.click": "web.dom.click",
  "dom.type": "web.dom.type",
  "dom.clear": "web.dom.clear",
  "dom.select": "web.dom.select",
  "dom.scroll": "web.dom.scroll",
  "dom.keypress": "web.dom.keypress",
  "dom.wait_for_selector": "web.dom.wait_for_selector",
  "dom.wait_for_text": "web.dom.wait_for_text",
  "dom.extract": "web.dom.extract",
  "dom.capture_snapshot": "web.dom.capture_snapshot"
};
var WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER = Object.fromEntries(
  Object.entries(LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION).map(([legacy, canonical]) => [canonical, legacy])
);

// src/client/gateway-mapping.ts
function webAutomationEventTypeForClientKind(kind) {
  if (kind === "content.ready") return WEB_AUTOMATION_EVENTS.clientReady;
  if (kind === "browser.tab") return WEB_AUTOMATION_EVENTS.tabStateChanged;
  if (kind === "browser.navigation") return WEB_AUTOMATION_EVENTS.pageNavigated;
  if (kind === "dom.click") return WEB_AUTOMATION_EVENTS.elementClicked;
  if (kind === "dom.input") return WEB_AUTOMATION_EVENTS.elementInputChanged;
  if (kind === "dom.change") return WEB_AUTOMATION_EVENTS.elementChanged;
  if (kind === "dom.submit") return WEB_AUTOMATION_EVENTS.formSubmitted;
  if (kind === "dom.focus") return WEB_AUTOMATION_EVENTS.elementFocused;
  if (kind === "dom.blur") return WEB_AUTOMATION_EVENTS.elementBlurred;
  if (kind === "dom.keydown") return WEB_AUTOMATION_EVENTS.keyboardPressed;
  if (kind === "dom.wheel") return WEB_AUTOMATION_EVENTS.mouseWheel;
  if (kind === "dom.scroll") return WEB_AUTOMATION_EVENTS.scrollChanged;
  if (kind === "dom.mutation") return WEB_AUTOMATION_EVENTS.domMutated;
  if (kind === "dom.snapshot") return WEB_AUTOMATION_EVENTS.snapshotCaptured;
  if (kind === "action.result") return WEB_AUTOMATION_EVENTS.actionExecuted;
  return WEB_AUTOMATION_EVENTS.clientError;
}
function createWebAutomationRecordingEvent(payload, input = {}) {
  const eventType = webAutomationEventTypeForClientKind(payload.kind);
  const target = payload.element;
  return {
    eventId: `web.${payload.sequence}.${payload.eventTimestampMs}`,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    eventType,
    timestamp: payload.eventTimestampMs,
    ...input.tabId === void 0 ? {} : { sourceId: `tab:${input.tabId}${input.frameId === void 0 ? "" : `:frame:${input.frameId}`}` },
    ...target !== void 0 ? { target } : {},
    payload: compactJsonObject2({
      url: payload.url,
      title: payload.title,
      sequence: payload.sequence,
      element: payload.element,
      inputValue: payload.inputValue,
      key: payload.key,
      scroll: payload.scroll,
      mutation: payload.mutation,
      snapshot: payload.snapshot,
      actionResult: payload.actionResult,
      ...payload.metadata?.recordingState !== void 0 ? { recordingState: payload.metadata.recordingState } : {}
    }),
    metadata: compactJsonObject2({
      clientKind: payload.kind,
      ...payload.metadata ?? {}
    })
  };
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/domain.test.ts
var service = new AutomationStudioService({ seedFixture: false });
service.registerRecordingDomain(webAutomationRecordingDomain);
var validation = service.validateRecordingDomainEvent({
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  eventType: WEB_AUTOMATION_EVENTS.elementClicked,
  payload: { url: "https://example.test", title: "Example", sequence: 1 }
});
assert.equal(validation.ok, true);
var event2 = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 1,
  url: "https://example.test",
  title: "Example",
  eventTimestampMs: 10,
  element: { selector: "button" }
});
assert.equal(event2.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(event2.eventType, WEB_AUTOMATION_EVENTS.elementClicked);
var initialState = createWebAutomationInitialState(1);
assert.equal(initialState.namespaces.web?.schemaId, WEB_AUTOMATION_DOMAIN_ID);
console.log("Web automation domain smoke test passed.");
