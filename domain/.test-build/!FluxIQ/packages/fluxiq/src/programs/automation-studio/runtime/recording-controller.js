import { appendRecordingStateCheckpoint, appendRecordingStateDelta, createRecordingSession } from "../model";
export class AutomationStudioRecordingController {
    recording;
    unsubscribe;
    previousSnapshot;
    constructor(options) {
        const initialState = options.stateStore?.snapshot() ?? options.initialState;
        this.recording = createRecordingSession({ ...options, initialState });
        this.previousSnapshot = initialState;
        if (options.checkpointOnStart)
            this.recording = appendRecordingStateCheckpoint(this.recording, initialState, { metadata: { reason: "recording_started" } });
        if (options.stateStore) {
            this.unsubscribe = options.stateStore.subscribe((event) => {
                if (event.deltas.length) {
                    this.recording = appendRecordingStateDelta(this.recording, this.previousSnapshot, event.snapshot, {
                        ...(event.source ? { sourceId: event.source } : {}),
                        ...(event.metadata ? { metadata: event.metadata } : {})
                    });
                }
                this.previousSnapshot = event.snapshot;
            });
        }
    }
    current() {
        return structuredClone(this.recording);
    }
    appendCheckpoint(state, metadata) {
        this.recording = appendRecordingStateCheckpoint(this.recording, state, metadata ? { metadata } : {});
        this.previousSnapshot = state;
        return this.current();
    }
    stop(endedAt = Date.now()) {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.recording = { ...this.recording, endedAt: Math.max(endedAt, this.recording.startedAt) };
        return this.current();
    }
}
