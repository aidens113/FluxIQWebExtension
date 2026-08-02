import { FluxIQClientGatewayWebSocketClient } from "./transport";
export class FluxIQAutomationStudioWebSocketClient {
    gateway;
    constructor(options) {
        this.gateway = "gateway" in options ? options.gateway : new FluxIQClientGatewayWebSocketClient(options);
    }
    connect() {
        return this.gateway.connect();
    }
    close(code, reason) {
        return this.gateway.close(code, reason);
    }
    on = (...args) => this.gateway.on(...args);
    createRecording(input) {
        return this.gateway.send("client.start_recording", {
            recordingId: input.recordingId,
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
            ...(input.environment?.domainId !== undefined ? { domainId: input.environment.domainId } : {}),
            initialState: input.initialState,
            ...(input.environment !== undefined ? { environment: input.environment } : {}),
            ...(input.sources !== undefined ? { sources: input.sources } : {}),
            ...(input.actionChannels !== undefined ? { actionChannels: input.actionChannels } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        });
    }
    appendRecordingEvent(input) {
        return this.gateway.send("client.recording_entry", {
            recordingId: input.recordingId,
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            entry: input.entry
        });
    }
    appendRecordingDomainEvent(input) {
        return this.gateway.send("client.recording_event", {
            eventType: input.eventType,
            domainId: input.domainId,
            recordingId: input.recordingId,
            ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
            ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
            ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
            ...(input.target !== undefined ? { target: input.target } : {}),
            ...(input.payload !== undefined ? { payload: input.payload } : {}),
            ...(input.metadata !== undefined || input.projectId !== undefined
                ? { metadata: { ...(input.metadata ?? {}), ...(input.projectId !== undefined ? { projectId: input.projectId } : {}) } }
                : {})
        });
    }
    finalizeRecording(input) {
        return this.gateway.send("client.stop_recording", {
            recordingId: input.recordingId,
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {})
        });
    }
}
