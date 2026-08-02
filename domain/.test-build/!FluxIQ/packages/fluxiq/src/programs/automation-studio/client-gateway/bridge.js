export class AutomationStudioClientGatewayBridge {
    gateway;
    automationStudio;
    activeRecordings = new Map();
    constructor(options) {
        this.gateway = options.gateway;
        this.automationStudio = options.automationStudio;
        this.gateway.onEvent((event) => this.handleGatewayEvent(event));
    }
    async startRecording(input) {
        const session = this.session(input.sessionId);
        const recordingId = input.recordingId ?? `client.${session.clientId}.${Date.now()}`;
        const projectId = input.projectId ?? session.projectId;
        const domainId = input.domainId ?? stringMetadataValue(session.metadata, "domainId") ?? null;
        const actionTypes = session.capabilities.flatMap((capability) => capability.actionTypes ?? []);
        const recording = await this.automationStudio.createRecording({
            ...(projectId !== undefined ? { projectId } : {}),
            recordingId,
            ...(input.taskId ? { taskId: input.taskId } : {}),
            environment: {
                id: `client.${session.clientId}`,
                label: session.name,
                kind: session.clientType,
                domainId,
                capabilities: session.capabilities.map((capability) => capability.id),
                metadata: compactJsonObject({ sessionId: session.sessionId, ...(session.version ? { version: session.version } : {}), ...(session.metadata ?? {}) })
            },
            sources: [
                {
                    id: `client.${session.clientId}.events`,
                    label: `${session.name} events`,
                    kind: "event",
                    metadata: { sessionId: session.sessionId, clientType: session.clientType }
                },
                {
                    id: `client.${session.clientId}.observations`,
                    label: `${session.name} observations`,
                    kind: "observation",
                    metadata: { sessionId: session.sessionId, clientType: session.clientType }
                }
            ],
            actionChannels: [
                {
                    id: `client.${session.clientId}.actions`,
                    label: `${session.name} action channel`,
                    actionTypes,
                    capabilities: session.capabilities.map((capability) => capability.id),
                    metadata: { sessionId: session.sessionId, clientType: session.clientType }
                }
            ],
            initialState: emptyClientStateSnapshot(session),
            metadata: { createdFrom: "client-gateway", sessionId: session.sessionId, ...(input.metadata ?? {}) }
        });
        this.activeRecordings.set(session.sessionId, { ...(projectId !== undefined ? { projectId } : {}), recordingId, domainId });
        await this.gateway.startRecording(session.sessionId, {
            recordingId,
            ...(projectId !== undefined ? { projectId } : {}),
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            ...(domainId ? { domainId } : {})
        });
        return recording;
    }
    async stopRecording(sessionId) {
        const active = this.activeRecordings.get(sessionId);
        await this.gateway.stopRecording(sessionId, active?.recordingId);
        if (!active)
            return null;
        const recording = await this.automationStudio.finalizeRecording({ ...(active.projectId !== undefined ? { projectId: active.projectId } : {}), recordingId: active.recordingId });
        this.activeRecordings.delete(sessionId);
        return recording;
    }
    async executeAction(sessionId, command) {
        const response = this.gateway.executeAction(sessionId, command);
        const result = await response.result;
        await this.appendActionResult(sessionId, command, result);
        return result;
    }
    async handleGatewayEvent(event) {
        if (event.type === "client.start_recording") {
            await this.startRecordingFromClient(event.session, event.message.payload);
            return;
        }
        if (event.type === "client.stop_recording") {
            await this.stopRecordingFromClient(event.session, event.message.payload);
            return;
        }
        if (event.type === "client.recording_entry") {
            await this.automationStudio.appendRecordingEvent({
                ...(event.message.payload.projectId !== undefined ? { projectId: event.message.payload.projectId } : {}),
                recordingId: event.message.payload.recordingId,
                entry: event.message.payload.entry
            });
            return;
        }
        if (event.type === "client.recording_event") {
            await this.appendRecordingEvent(event.session, event.message.payload, event.message.id);
            return;
        }
        if (event.type === "client.snapshot") {
            await this.appendSnapshot(event.session, event.message.payload, event.message.id);
            return;
        }
        if (event.type === "client.state_update") {
            await this.appendStateUpdate(event.session, event.message.payload, event.message.id);
            return;
        }
        if (event.type === "client.error") {
            const active = this.activeRecordings.get(event.session.sessionId);
            if (active)
                await this.automationStudio.appendRecordingEvent({
                    ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
                    recordingId: active.recordingId,
                    entry: {
                        type: "marker",
                        label: `Client error: ${event.message.payload.message}`,
                        ...(event.message.timestamp !== undefined ? { timestamp: event.message.timestamp } : {}),
                        sourceId: `client.${event.session.clientId}.events`,
                        metadata: compactJsonObject({ ...(event.message.payload.code ? { code: event.message.payload.code } : {}), ...(event.message.payload.metadata ?? {}) })
                    }
                });
        }
    }
    async startRecordingFromClient(session, input) {
        const domainId = input.domainId ?? stringMetadataValue(input.metadata, "domainId") ?? stringMetadataValue(session.metadata, "domainId") ?? null;
        const recording = await this.automationStudio.createRecording({
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            recordingId: input.recordingId,
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
            environment: input.environment
                ? input.environment
                : {
                    id: `client.${session.clientId}`,
                    label: session.name,
                    kind: session.clientType,
                    domainId,
                    capabilities: session.capabilities.map((capability) => capability.id),
                    metadata: compactJsonObject({ sessionId: session.sessionId, ...(session.version ? { version: session.version } : {}), ...(session.metadata ?? {}) })
                },
            sources: input.sources ?? [
                {
                    id: `client.${session.clientId}.events`,
                    label: `${session.name} events`,
                    kind: "event",
                    metadata: { sessionId: session.sessionId, clientType: session.clientType }
                },
                {
                    id: `client.${session.clientId}.observations`,
                    label: `${session.name} observations`,
                    kind: "observation",
                    metadata: { sessionId: session.sessionId, clientType: session.clientType }
                }
            ],
            actionChannels: input.actionChannels ?? [],
            initialState: input.initialState ?? emptyClientStateSnapshot(session),
            metadata: compactJsonObject({ createdFrom: "client-gateway", sessionId: session.sessionId, ...(input.metadata ?? {}) })
        });
        this.activeRecordings.set(session.sessionId, { ...(input.projectId !== undefined ? { projectId: input.projectId } : {}), recordingId: recording.recordingId, domainId });
        return recording;
    }
    async stopRecordingFromClient(session, input) {
        const active = this.activeRecordings.get(session.sessionId);
        const projectId = input.projectId ?? active?.projectId;
        const recording = await this.automationStudio.finalizeRecording({
            ...(projectId !== undefined ? { projectId } : {}),
            recordingId: input.recordingId,
            ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {})
        });
        this.activeRecordings.delete(session.sessionId);
        return recording;
    }
    async appendRecordingEvent(session, event, messageId) {
        const active = this.activeRecordings.get(session.sessionId);
        if (!active)
            return;
        const domainId = event.domainId ?? active.domainId ?? stringMetadataValue(event.metadata, "domainId");
        if (domainId) {
            const result = await this.automationStudio.appendRecordingDomainEvent({
                ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
                recordingId: active.recordingId,
                domainId,
                eventType: event.eventType,
                ...(event.eventId !== undefined ? { eventId: event.eventId } : {}),
                ...(event.timestamp !== undefined ? { timestamp: event.timestamp } : {}),
                sourceId: event.sourceId ?? `client.${session.clientId}.events`,
                ...(event.target !== undefined ? { target: event.target } : {}),
                ...(event.payload !== undefined ? { payload: event.payload } : {}),
                metadata: compactJsonObject({
                    clientGatewayMessageId: messageId,
                    clientId: session.clientId,
                    ...(event.metadata ?? {})
                })
            });
            if (!result.accepted) {
                const message = result.issues.map((issue) => issue.path ? `${issue.path}: ${issue.message}` : issue.message).join("; ");
                await this.appendRejectedRecordingMarker(active, session, event, messageId, message || `Recording event ${domainId}.${event.eventType} was rejected.`);
            }
            return;
        }
        await this.appendRejectedRecordingMarker(active, session, event, messageId, "Recording event domainId is required.");
    }
    async appendRejectedRecordingMarker(active, session, event, messageId, reason) {
        await this.automationStudio.appendRecordingEvent({
            ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
            recordingId: active.recordingId,
            entry: {
                type: "marker",
                label: `Rejected recording event: ${event.eventType}`,
                ...(event.timestamp !== undefined ? { timestamp: event.timestamp } : {}),
                sourceId: event.sourceId ?? `client.${session.clientId}.events`,
                correlationId: event.eventId ?? messageId,
                metadata: compactJsonObject({
                    reason,
                    eventType: event.eventType,
                    ...(event.domainId !== undefined ? { domainId: event.domainId } : {}),
                    ...(event.metadata !== undefined ? { clientMetadata: event.metadata } : {})
                })
            }
        });
    }
    async appendSnapshot(session, snapshot, messageId) {
        const active = this.activeRecordings.get(session.sessionId);
        if (!active)
            return;
        if (snapshot.kind === "state" && snapshot.state) {
            await this.automationStudio.appendRecordingEvent({
                ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
                recordingId: active.recordingId,
                entry: {
                    type: "observation",
                    observationType: "client.state_snapshot",
                    ...(snapshot.timestamp !== undefined ? { timestamp: snapshot.timestamp } : {}),
                    sourceId: `client.${session.clientId}.observations`,
                    correlationId: snapshot.snapshotId ?? messageId,
                    payload: compactJsonObject({ state: snapshot.state, ...(snapshot.metadata !== undefined ? { metadata: snapshot.metadata } : {}) })
                }
            });
            return;
        }
        await this.automationStudio.appendRecordingEvent({
            ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
            recordingId: active.recordingId,
            entry: {
                type: "observation",
                observationType: `client.${snapshot.kind}_snapshot`,
                ...(snapshot.timestamp !== undefined ? { timestamp: snapshot.timestamp } : {}),
                sourceId: `client.${session.clientId}.observations`,
                correlationId: snapshot.snapshotId ?? messageId,
                payload: compactJsonObject({
                    ...(snapshot.payload !== undefined ? { payload: snapshot.payload } : {}),
                    ...(snapshot.metadata !== undefined ? { metadata: snapshot.metadata } : {})
                })
            }
        });
    }
    async appendStateUpdate(session, stateUpdate, messageId) {
        const active = this.activeRecordings.get(session.sessionId);
        if (!active)
            return;
        await this.automationStudio.appendRecordingEvent({
            ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
            recordingId: active.recordingId,
            entry: {
                type: "observation",
                observationType: "client.state_update",
                sourceId: `client.${session.clientId}.observations`,
                correlationId: messageId,
                payload: stateUpdate
            }
        });
    }
    async appendActionResult(sessionId, command, result) {
        const session = this.session(sessionId);
        const active = this.activeRecordings.get(sessionId);
        if (!active)
            return;
        await this.automationStudio.appendRecordingEvent({
            ...(active.projectId !== undefined ? { projectId: active.projectId } : {}),
            recordingId: active.recordingId,
            entry: {
                type: "action",
                actionType: command.actionType,
                parameters: command.parameters ?? {},
                ...(command.target ? { target: { type: String(command.target.type ?? "client-target"), metadata: command.target } } : {}),
                origin: "runtime",
                startedAt: result.startedAt ?? Date.now(),
                ...(result.completedAt !== undefined ? { completedAt: result.completedAt } : {}),
                sourceId: `client.${session.clientId}.events`,
                correlationId: result.commandId,
                result: {
                    status: result.status,
                    ...(result.message ?? result.error ? { message: result.message ?? result.error } : {}),
                    metadata: compactJsonObject({ ...(result.payload !== undefined ? { payload: result.payload } : {}), ...(result.metadata ?? {}) })
                }
            }
        });
    }
    session(sessionId) {
        const session = this.gateway.snapshot().sessions.find((item) => item.sessionId === sessionId);
        if (!session)
            throw new Error(`Unknown client gateway session: ${sessionId}`);
        return session;
    }
}
function emptyClientStateSnapshot(session) {
    return {
        timestamp: Date.now(),
        namespaces: {
            client: {
                schemaId: "fluxiq.client-gateway.client-state",
                schemaVersion: "0.1",
                values: {
                    clientId: { type: "string", value: session.clientId, observedAt: Date.now(), sourceId: `client.${session.clientId}.events` },
                    clientType: { type: "string", value: session.clientType, observedAt: Date.now(), sourceId: `client.${session.clientId}.events` }
                }
            }
        }
    };
}
function compactJsonObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
function stringMetadataValue(metadata, key) {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
