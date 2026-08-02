import { appendRecordingEntry, appendRecordingStateCheckpoint, appendRecordingStateDelta } from "./recording-framework";
export class RecordingDomainRegistry {
    domains = new Map();
    register(definition) {
        const domainId = definition.domainId.trim();
        if (!domainId)
            throw new Error("Recording domain ID is required.");
        if (!definition.events.length)
            throw new Error(`Recording domain ${domainId} must define at least one event type.`);
        const seen = new Set();
        for (const event of definition.events) {
            if (!event.eventType.trim())
                throw new Error(`Recording domain ${domainId} has an event without an eventType.`);
            if (seen.has(event.eventType))
                throw new Error(`Recording domain ${domainId} defines duplicate event type: ${event.eventType}`);
            seen.add(event.eventType);
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
        return this.get(domainId)?.events.find((event) => event.eventType === eventType);
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
        const event = this.getEvent(input.domainId, input.eventType);
        if (!event) {
            issues.push({ path: "eventType", code: "event.unknown", message: `Domain ${input.domainId} does not accept event type: ${input.eventType}` });
            return { ok: false, issues };
        }
        if (event.payloadSchema)
            issues.push(...validateSchema(input.payload ?? {}, event.payloadSchema, "payload"));
        if (event.metadataSchema)
            issues.push(...validateSchema(input.metadata ?? {}, event.metadataSchema, "metadata"));
        return { ok: issues.length === 0, issues };
    }
}
export async function processRecordingDomainEvent(registry, recording, input) {
    const validation = registry.validate(input);
    const domain = registry.get(input.domainId);
    const definition = domain ? registry.getEvent(input.domainId, input.eventType) : undefined;
    if (!validation.ok || !domain || !definition) {
        return { accepted: false, recording, stateDeltas: [], issues: validation.issues };
    }
    const timestamp = input.timestamp ?? Date.now();
    const entryId = input.eventId ?? `entry.${recording.timeline.length}`;
    const eventRecording = appendRecordingEntry(recording, {
        type: "domain_event",
        id: entryId,
        eventType: input.eventType,
        timestamp,
        ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
        ...(input.eventId !== undefined ? { correlationId: input.eventId } : {}),
        payload: compactJsonObject({
            ...(input.target !== undefined ? { target: input.target } : {}),
            ...(input.payload !== undefined ? { payload: input.payload } : {})
        }),
        metadata: compactJsonObject({
            domainId: input.domainId,
            domainLabel: domain.label,
            eventLabel: definition.label,
            ...(input.metadata ?? {})
        })
    });
    const previousState = latestStateSnapshot(eventRecording);
    const context = { recording: eventRecording, event: input, previousState, definition, domain };
    let next = eventRecording;
    let state;
    let stateMetadata;
    const reducerOutput = definition.stateReducer ? await definition.stateReducer(context) : undefined;
    if (reducerOutput && "timestamp" in reducerOutput && "namespaces" in reducerOutput) {
        state = reducerOutput;
    }
    else if (reducerOutput) {
        state = reducerOutput.state;
        stateMetadata = reducerOutput.metadata;
    }
    if (state) {
        next = appendRecordingStateDelta(next, previousState, state, {
            timestamp,
            ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
            metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, ...(stateMetadata ?? {}) })
        });
        next = appendRecordingStateCheckpoint(next, state, {
            timestamp,
            ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
            metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, reason: "domain-event" })
        });
    }
    const observation = definition.observationExtractor?.(context);
    if (observation) {
        next = appendRecordingEntry(next, {
            type: "observation",
            observationType: observation.observationType,
            timestamp,
            ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
            ...(observation.signals ? { signals: observation.signals } : {}),
            ...(observation.payload ? { payload: observation.payload } : {}),
            metadata: compactJsonObject({ domainId: input.domainId, eventType: input.eventType, ...(observation.metadata ?? {}) })
        });
    }
    const stateDeltaEntry = findLastTimelineEntry(next, "state_delta");
    const stateDeltas = stateDeltaEntry?.type === "state_delta" ? stateDeltaEntry.deltas : [];
    return { accepted: true, recording: next, entryId, domain, definition, stateDeltas, ...(state ? { state } : {}), issues: [] };
}
export function latestStateSnapshot(recording) {
    const checkpoint = findLastTimelineEntry(recording, "state_checkpoint");
    return checkpoint?.type === "state_checkpoint" ? checkpoint.state : recording.initialState;
}
function findLastTimelineEntry(recording, type) {
    for (let index = recording.timeline.length - 1; index >= 0; index -= 1) {
        const entry = recording.timeline[index];
        if (entry?.type === type)
            return entry;
    }
    return undefined;
}
function validateSchema(value, schema, path) {
    const issues = [];
    if (value === undefined || value === null) {
        if (schema.required)
            issues.push({ path, code: "value.required", message: `${schema.label ?? path} is required.` });
        if (value === null && schema.type !== "null" && schema.type !== "json")
            issues.push({ path, code: "value.type", message: `${schema.label ?? path} must be ${schema.type}.` });
        return issues;
    }
    if (!matchesSchemaType(value, schema.type)) {
        issues.push({ path, code: "value.type", message: `${schema.label ?? path} must be ${schema.type}.` });
        return issues;
    }
    if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
        issues.push({ path, code: "value.enum", message: `${schema.label ?? path} must be one of the allowed values.` });
    }
    if (schema.type === "object" && schema.properties) {
        const object = isJsonObject(value) ? value : {};
        for (const [key, child] of Object.entries(schema.properties)) {
            issues.push(...validateSchema(object[key], child, `${path}.${key}`));
        }
    }
    if (schema.type === "array" && schema.items && Array.isArray(value)) {
        value.forEach((item, index) => issues.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
    }
    return issues;
}
function matchesSchemaType(value, type) {
    if (type === "json")
        return true;
    if (type === "array")
        return Array.isArray(value);
    if (type === "object")
        return isJsonObject(value);
    if (type === "integer")
        return typeof value === "number" && Number.isInteger(value);
    if (type === "null")
        return value === null;
    return typeof value === type;
}
function isJsonObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function compactJsonObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
