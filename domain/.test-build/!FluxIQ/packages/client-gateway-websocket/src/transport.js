import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "fluxiq/client-gateway";
import { parseServerMessage } from "./messages";
export class FluxIQClientGatewayWebSocketClient {
    options;
    handlers = new Map();
    socket = null;
    sessionId;
    token;
    constructor(options) {
        this.options = options;
    }
    get connected() {
        return Boolean(this.socket && this.socket.readyState === 1);
    }
    get currentSessionId() {
        return this.sessionId;
    }
    async connect() {
        if (this.socket && this.socket.readyState <= 1)
            return;
        const WebSocketImpl = this.options.WebSocketImpl ?? globalThis.WebSocket;
        if (!WebSocketImpl)
            throw new Error("A WebSocket implementation is required.");
        const socket = new WebSocketImpl(this.options.url ?? "ws://127.0.0.1:4777/client");
        this.socket = socket;
        await waitForOpen(socket);
        this.attachSocketHandlers(socket);
        this.emit({ type: "open" });
        const storedToken = await this.options.tokenStorage?.read();
        this.token = this.options.client.token ?? storedToken;
        await this.send("client.hello", {
            ...this.options.client,
            ...(this.token ? { token: this.token } : {})
        });
    }
    async close(code, reason) {
        this.socket?.close(code, reason);
        this.socket = null;
    }
    on(type, handler) {
        const set = this.handlers.get(type) ?? new Set();
        set.add(handler);
        this.handlers.set(type, set);
        return () => set.delete(handler);
    }
    async send(type, payload, options = {}) {
        const message = {
            id: this.options.idFactory?.() ?? `client-message.${Math.random().toString(36).slice(2)}`,
            type,
            protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
            timestamp: this.options.now?.() ?? Date.now(),
            ...(this.sessionId !== undefined ? { sessionId: this.sessionId } : {}),
            ...(this.options.client.clientId !== undefined ? { clientId: this.options.client.clientId } : {}),
            ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
            payload
        };
        const socket = this.socket;
        if (!socket || socket.readyState !== 1)
            throw new Error("FluxIQ client gateway WebSocket is not connected.");
        socket.send(JSON.stringify(message));
        return message;
    }
    async sendStateUpdate(state) {
        return await this.send("client.state_update", state);
    }
    async sendRecordingEvent(event) {
        return await this.send("client.recording_event", event);
    }
    async sendSnapshot(snapshot) {
        return await this.send("client.snapshot", snapshot);
    }
    async sendActionResult(result) {
        return await this.send("client.action_result", result);
    }
    async sendError(message, input = {}) {
        return await this.send("client.error", {
            message,
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        });
    }
    attachSocketHandlers(socket) {
        addListener(socket, "message", (event) => {
            const data = typeof event === "object" && event && "data" in event ? event.data : event;
            const message = parseServerMessage(data);
            if (message)
                void this.handleServerMessage(message);
        });
        addListener(socket, "close", (event) => {
            this.socket = null;
            this.emit({ type: "close", event });
        });
        addListener(socket, "error", (event) => this.emit({ type: "error", event }));
    }
    async handleServerMessage(message) {
        if (message.sessionId)
            this.sessionId = message.sessionId;
        this.emit({ type: "message", message });
        if (message.type === "server.session_ready") {
            this.sessionId = message.payload.sessionId;
            this.token = message.payload.token;
            await this.options.tokenStorage?.write(message.payload.token);
            this.emit({ type: "session_ready", message });
            return;
        }
        if (message.type === "server.pairing_required")
            this.emit({ type: "pairing_required", message });
        else if (message.type === "server.start_recording")
            this.emit({ type: "start_recording", message });
        else if (message.type === "server.stop_recording")
            this.emit({ type: "stop_recording", message });
        else if (message.type === "server.capture_snapshot")
            this.emit({ type: "capture_snapshot", message });
        else if (message.type === "server.execute_action")
            this.emit({ type: "execute_action", message });
    }
    emit(event) {
        for (const handler of this.handlers.get(event.type) ?? [])
            void handler(event);
    }
}
function waitForOpen(socket) {
    return new Promise((resolve, reject) => {
        const onOpen = () => {
            cleanup();
            resolve();
        };
        const onError = (event) => {
            cleanup();
            reject(event instanceof Error ? event : new Error("FluxIQ client gateway WebSocket failed to open."));
        };
        const cleanup = () => {
            removeListener(socket, "open", onOpen);
            removeListener(socket, "error", onError);
        };
        addListener(socket, "open", onOpen);
        addListener(socket, "error", onError);
    });
}
function addListener(socket, type, listener) {
    if (socket.addEventListener)
        socket.addEventListener(type, listener);
    else
        socket[`on${type}`] = listener;
}
function removeListener(socket, type, listener) {
    if (socket.removeEventListener)
        socket.removeEventListener(type, listener);
    else if (socket[`on${type}`] === listener)
        socket[`on${type}`] = null;
}
