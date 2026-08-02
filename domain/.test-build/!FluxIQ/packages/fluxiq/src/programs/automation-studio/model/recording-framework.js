import { diffStateSnapshots } from "./state-diff";
export function createRecordingSession(input) {
    const startedAt = input.startedAt ?? Date.now();
    const environment = {
        id: input.environment?.id ?? "environment.unspecified",
        label: input.environment?.label ?? "Unspecified environment",
        kind: input.environment?.kind ?? "unspecified",
        ...(input.environment?.domainId !== undefined ? { domainId: input.environment.domainId } : { domainId: null }),
        ...(input.environment?.capabilities !== undefined ? { capabilities: input.environment.capabilities } : {}),
        ...(input.environment?.metadata !== undefined ? { metadata: input.environment.metadata } : {})
    };
    return {
        schemaVersion: "0.1",
        recordingId: input.recordingId,
        ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
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
export function appendRecordingEntry(recording, input) {
    const timestamp = input.timestamp ?? Date.now();
    const sequence = nextTimelineSequence(recording);
    const entry = {
        ...input,
        id: input.id ?? `entry.${sequence}`,
        recordingId: recording.recordingId,
        timestamp,
        monotonicOffsetMs: input.monotonicOffsetMs ?? Math.max(0, timestamp - recording.startedAt),
        sequence,
        sourceId: input.sourceId ?? recording.sources[0]?.id ?? "source.host"
    };
    return { ...recording, timeline: [...recording.timeline, entry] };
}
export function appendRecordingStateCheckpoint(recording, state, input = {}) {
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
export function appendRecordingStateDelta(recording, previous, current, input = {}) {
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
export function appendRecordingNote(recording, note) {
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
export function finalizeRecordingSession(recording, endedAt = Date.now()) {
    return { ...recording, endedAt: Math.max(endedAt, recording.startedAt) };
}
function appendTimelineEntry(recording, entry) {
    const next = {
        ...entry,
        recordingId: recording.recordingId,
        sequence: nextTimelineSequence(recording),
        monotonicOffsetMs: Math.max(0, entry.timestamp - recording.startedAt)
    };
    return { ...recording, timeline: [...recording.timeline, next] };
}
function baseAppendFields(recording, input) {
    const timestamp = input.timestamp ?? Date.now();
    return {
        id: input.id ?? `entry.${nextTimelineSequence(recording)}`,
        timestamp,
        sourceId: input.sourceId ?? recording.sources[0]?.id ?? "source.host",
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    };
}
function nextTimelineSequence(recording) {
    return recording.timeline.reduce((max, entry) => Math.max(max, entry.sequence), -1) + 1;
}
