import { randomUUID } from "node:crypto";
import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "./contracts";
export class ClientGatewayService {
    enabled;
    publicUrl;
    pairingTtlMs;
    commandTimeoutMs;
    now;
    sessions = new Map();
    pairings = new Map();
    tokenToSession = new Map();
    pendingCommands = new Map();
    handlers = new Set();
    auditLog = [];
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.publicUrl = options.publicUrl;
        this.pairingTtlMs = options.pairingTtlMs ?? 5 * 60_000;
        this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
        this.now = options.now ?? Date.now;
    }
    snapshot() {
        this.pruneExpiredPairings();
        return {
            enabled: this.enabled,
            ...(this.publicUrl ? { publicUrl: this.publicUrl } : {}),
            sessions: [...this.sessions.values()].map(({ socket: _socket, outbound: _outbound, pendingPairingCode: _pendingPairingCode, ...session }) => ({ ...session })),
            pairings: [...this.pairings.values()],
            auditLog: this.auditLog.slice(-100)
        };
    }
    createPairing(input = {}) {
        const pairingCode = this.createPairingCode();
        const pairing = {
            pairingCode,
            referenceCode: pairingCode,
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            ...(input.userId !== undefined ? { userId: input.userId } : {}),
            ...(input.requestedBySessionId !== undefined ? { requestedAt: this.now(), requestedBySessionId: input.requestedBySessionId } : {}),
            ...(input.requestedByClientId !== undefined ? { requestedByClientId: input.requestedByClientId } : {}),
            ...(input.requestedByClientName !== undefined ? { requestedByClientName: input.requestedByClientName } : {}),
            expiresAt: this.now() + (input.ttlMs ?? this.pairingTtlMs)
        };
        this.pairings.set(pairingCode, pairing);
        this.audit("pairing.created", "Client pairing challenge created.", { pairingCode, projectId: input.projectId ?? null });
        return pairing;
    }
    async approvePairing(pairingCode) {
        this.pruneExpiredPairings();
        const pairing = this.pairings.get(pairingCode);
        if (!pairing || pairing.consumedAt || !pairing.requestedBySessionId)
            return null;
        return this.completePairing(pairing.requestedBySessionId, pairingCode);
    }
    dismissPairing(pairingCode) {
        const pairing = this.pairings.get(pairingCode);
        if (!pairing)
            return false;
        this.pairings.delete(pairingCode);
        if (pairing.requestedBySessionId) {
            const session = this.sessions.get(pairing.requestedBySessionId);
            if (session?.pendingPairingCode === pairingCode)
                delete session.pendingPairingCode;
            if (session && session.status === "pairing_required") {
                void this.send(session.sessionId, this.serverMessage("server.error", {
                    message: "Client pairing request was rejected in FluxIQ.",
                    code: "pairing.rejected"
                }, session));
            }
        }
        this.audit("pairing.dismissed", "Client pairing challenge dismissed.", {
            pairingCode,
            sessionId: pairing.requestedBySessionId ?? pairing.sessionId ?? null,
            clientId: pairing.requestedByClientId ?? null
        });
        return true;
    }
    connect(input = {}) {
        const now = this.now();
        const clientId = input.hello?.clientId ?? `client.${randomUUID()}`;
        const session = {
            sessionId: randomUUID(),
            clientId,
            clientType: input.hello?.clientType ?? "custom",
            name: input.hello?.name ?? clientId,
            ...(input.hello?.version ? { version: input.hello.version } : {}),
            status: "connected",
            connectedAt: now,
            lastSeenAt: now,
            capabilities: input.hello?.capabilities ?? [],
            ...(input.hello?.metadata ? { metadata: input.hello.metadata } : {}),
            ...(input.socket ? { socket: input.socket } : {}),
            outbound: []
        };
        this.sessions.set(session.sessionId, session);
        this.audit("session.connected", "Client connected.", { sessionId: session.sessionId, clientId });
        if (input.hello)
            void this.handleHello(session.sessionId, input.hello);
        return this.publicSession(session);
    }
    disconnect(sessionId, reason = "disconnected") {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const next = { ...session, status: "disconnected", disconnectedAt: this.now(), lastSeenAt: this.now() };
        this.sessions.set(sessionId, next);
        if (next.token)
            this.tokenToSession.delete(next.token);
        void next.socket?.close?.(1000, reason);
        this.audit("session.disconnected", "Client disconnected.", { sessionId, reason });
        void this.emit({ type: "session.disconnected", session: this.publicSession(next) });
        return this.publicSession(next);
    }
    onEvent(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    async receiveRaw(sessionId, rawMessage) {
        const parsed = JSON.parse(rawMessage);
        await this.receive(sessionId, parsed);
    }
    async receive(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Unknown client gateway session: ${sessionId}`);
        session.lastSeenAt = this.now();
        if (message.type === "client.hello") {
            await this.handleHello(sessionId, message.payload);
            return;
        }
        if (message.type === "client.pairing_submit") {
            await this.submitPairing(sessionId, message.payload.pairingCode);
            return;
        }
        if (session.status !== "ready") {
            await this.send(sessionId, this.serverMessage("server.pairing_required", { reason: "Session must pair before sending client data." }, session));
            return;
        }
        if (message.type === "client.capabilities") {
            session.capabilities = message.payload.capabilities;
            return;
        }
        if (message.type === "client.state_update") {
            session.stateUpdate = message.payload;
            await this.emit({ type: "client.state_update", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.start_recording") {
            session.activeRecordingId = message.payload.recordingId;
            if (message.payload.projectId !== undefined)
                session.projectId = message.payload.projectId;
            await this.emit({ type: "client.start_recording", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.stop_recording") {
            await this.emit({ type: "client.stop_recording", session: this.publicSession(session), message });
            session.activeRecordingId = null;
            return;
        }
        if (message.type === "client.recording_entry") {
            await this.emit({ type: "client.recording_entry", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.recording_event") {
            await this.emit({ type: "client.recording_event", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.snapshot") {
            await this.emit({ type: "client.snapshot", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.action_result") {
            const pending = this.pendingCommands.get(message.payload.commandId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingCommands.delete(message.payload.commandId);
                pending.resolve(message.payload);
            }
            await this.emit({ type: "client.action_result", session: this.publicSession(session), message });
            return;
        }
        if (message.type === "client.error")
            await this.emit({ type: "client.error", session: this.publicSession(session), message });
    }
    async startRecording(sessionId, input) {
        const session = this.requireReadySession(sessionId);
        session.activeRecordingId = input.recordingId;
        if (input.projectId !== undefined)
            session.projectId = input.projectId;
        await this.send(sessionId, this.serverMessage("server.start_recording", input, session));
    }
    async stopRecording(sessionId, recordingId) {
        const session = this.requireReadySession(sessionId);
        const payload = recordingId ?? session.activeRecordingId ? { recordingId: recordingId ?? session.activeRecordingId ?? "" } : {};
        await this.send(sessionId, this.serverMessage("server.stop_recording", payload, session));
        session.activeRecordingId = null;
    }
    async captureSnapshot(sessionId, input = {}) {
        const session = this.requireReadySession(sessionId);
        await this.send(sessionId, this.serverMessage("server.capture_snapshot", {
            ...(input.kind !== undefined ? { kind: input.kind } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        }, session));
    }
    executeAction(sessionId, command) {
        const session = this.requireReadySession(sessionId);
        const commandId = randomUUID();
        const message = this.serverMessage("server.execute_action", { ...command, commandId }, session);
        const timeoutMs = command.timeoutMs ?? this.commandTimeoutMs;
        const result = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingCommands.delete(commandId);
                resolve({ commandId, status: "timed_out", message: `Client action timed out after ${timeoutMs}ms.` });
            }, timeoutMs);
            this.pendingCommands.set(commandId, { sessionId, resolve, timeout });
        });
        void this.send(sessionId, message);
        this.audit("command.dispatched", "Action command dispatched to client.", { sessionId, commandId, actionType: command.actionType });
        return { commandId, message, result };
    }
    async sendPing(sessionId) {
        const session = this.requireSession(sessionId);
        await this.send(sessionId, this.serverMessage("server.ping", { nonce: randomUUID() }, session));
    }
    outbound(sessionId) {
        return this.sessions.get(sessionId)?.outbound ?? [];
    }
    clearOutbound(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session)
            session.outbound = [];
    }
    async handleHello(sessionId, hello) {
        const session = this.requireSession(sessionId);
        session.clientId = hello.clientId ?? session.clientId;
        session.clientType = hello.clientType;
        session.name = hello.name ?? session.name;
        if (hello.version !== undefined)
            session.version = hello.version;
        session.capabilities = hello.capabilities ?? session.capabilities;
        if (hello.metadata !== undefined)
            session.metadata = hello.metadata;
        if (hello.token && this.tokenToSession.get(hello.token) === sessionId) {
            session.status = "ready";
            session.token = hello.token;
            session.pairedAt ??= this.now();
            await this.send(sessionId, this.serverMessage("server.session_ready", { sessionId, token: hello.token, ...(session.projectId !== undefined ? { projectId: session.projectId } : {}) }, session));
            await this.emit({ type: "session.ready", session: this.publicSession(session) });
            return;
        }
        session.status = "pairing_required";
        const pairing = this.ensureSessionPairing(session);
        await this.send(sessionId, this.serverMessage("server.pairing_required", {
            referenceCode: pairing.referenceCode ?? pairing.pairingCode,
            reason: "Approve this client in FluxIQ before sending data."
        }, session));
    }
    async submitPairing(sessionId, pairingCode) {
        const session = this.requireSession(sessionId);
        const pairedSession = await this.completePairing(sessionId, pairingCode);
        if (!pairedSession) {
            await this.send(sessionId, this.serverMessage("server.error", { message: "Invalid or expired pairing code.", code: "pairing.invalid" }, session));
        }
    }
    async completePairing(sessionId, pairingCode) {
        this.pruneExpiredPairings();
        const pairing = this.pairings.get(pairingCode);
        const session = this.sessions.get(sessionId);
        if (!pairing || pairing.consumedAt || !session)
            return null;
        const token = randomUUID();
        pairing.consumedAt = this.now();
        pairing.sessionId = sessionId;
        delete session.pendingPairingCode;
        this.removeOtherSessionPairings(sessionId, pairingCode);
        session.status = "ready";
        session.token = token;
        if (pairing.projectId !== undefined)
            session.projectId = pairing.projectId;
        session.pairedAt = this.now();
        this.tokenToSession.set(token, sessionId);
        await this.send(sessionId, this.serverMessage("server.session_ready", { sessionId, token, ...(pairing.projectId !== undefined ? { projectId: pairing.projectId } : {}) }, session));
        this.audit("session.paired", "Client session paired.", { sessionId, pairingCode, projectId: pairing.projectId ?? null });
        await this.emit({ type: "session.ready", session: this.publicSession(session) });
        return this.publicSession(session);
    }
    requireReadySession(sessionId) {
        const session = this.requireSession(sessionId);
        if (session.status !== "ready")
            throw new Error("Client session is not paired.");
        return session;
    }
    requireSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Unknown client gateway session: ${sessionId}`);
        return session;
    }
    async send(sessionId, message) {
        const session = this.requireSession(sessionId);
        session.outbound.push(message);
        await session.socket?.send(JSON.stringify(message));
    }
    serverMessage(type, payload, session) {
        return {
            id: randomUUID(),
            type,
            protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
            timestamp: this.now(),
            ...(session ? { sessionId: session.sessionId, clientId: session.clientId } : {}),
            payload
        };
    }
    async emit(event) {
        await Promise.all([...this.handlers].map((handler) => handler(event)));
    }
    audit(type, message, metadata) {
        this.auditLog.push({
            id: randomUUID(),
            timestamp: this.now(),
            type,
            message,
            ...(metadata?.sessionId ? { sessionId: String(metadata.sessionId) } : {}),
            ...(metadata ? { metadata } : {})
        });
    }
    publicSession(session) {
        const { socket: _socket, outbound: _outbound, pendingPairingCode: _pendingPairingCode, ...publicSession } = session;
        return { ...publicSession };
    }
    createPairingCode() {
        let code = "";
        do {
            code = String(Math.floor(100000 + Math.random() * 900000));
        } while (this.pairings.has(code));
        return code;
    }
    pruneExpiredPairings() {
        const now = this.now();
        for (const [code, pairing] of this.pairings) {
            if (pairing.expiresAt < now && !pairing.consumedAt)
                this.pairings.delete(code);
        }
    }
    ensureSessionPairing(session) {
        this.pruneExpiredPairings();
        if (session.pendingPairingCode) {
            const existing = this.pairings.get(session.pendingPairingCode);
            if (existing && !existing.consumedAt && existing.expiresAt >= this.now())
                return existing;
        }
        const pairing = this.createPairing({
            ...(session.projectId !== undefined ? { projectId: session.projectId } : {}),
            requestedBySessionId: session.sessionId,
            requestedByClientId: session.clientId,
            requestedByClientName: session.name
        });
        session.pendingPairingCode = pairing.pairingCode;
        return pairing;
    }
    removeOtherSessionPairings(sessionId, exceptPairingCode) {
        for (const [code, pairing] of this.pairings) {
            if (code !== exceptPairingCode && pairing.requestedBySessionId === sessionId && !pairing.consumedAt)
                this.pairings.delete(code);
        }
    }
}
