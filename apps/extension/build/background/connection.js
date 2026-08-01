import { HEARTBEAT_INTERVAL_MS, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../shared/constants";
import { browserDescriptor } from "../shared/browser";
import { browserExtensionCapabilities, createClientEnvelope } from "../shared/protocol";
import { activeTab, allTabs, sendToTab } from "./tabs";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";
export class FluxIQConnection {
    settings;
    session;
    socket = null;
    heartbeatTimer;
    reconnectTimer;
    reconnectAttempt = 0;
    connectionState = "disconnected";
    recordingState = "idle";
    lastError;
    lastMessageAt;
    activeTabId;
    activeTabUrl;
    pairingReferenceCode;
    queueSize = 0;
    shouldStayConnected = false;
    listeners = new Set();
    constructor(settings, session) {
        this.settings = settings;
        this.session = session;
    }
    status() {
        const status = {
            connectionState: this.connectionState,
            recordingState: this.recordingState,
            gatewayUrl: this.settings.gatewayUrl,
            settings: this.settings,
            clientId: this.session.clientId,
            queueSize: this.queueSize
        };
        if (this.session.sessionId)
            status.sessionId = this.session.sessionId;
        if (this.activeTabId !== undefined)
            status.activeTabId = this.activeTabId;
        if (this.activeTabUrl)
            status.activeTabUrl = this.activeTabUrl;
        if (this.pairingReferenceCode)
            status.pairingReferenceCode = this.pairingReferenceCode;
        if (this.lastError)
            status.lastError = this.lastError;
        if (this.lastMessageAt !== undefined)
            status.lastMessageAt = this.lastMessageAt;
        return status;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.status());
        return () => this.listeners.delete(listener);
    }
    updateSettings(settings) {
        this.settings = settings;
    }
    async connect() {
        this.shouldStayConnected = true;
        this.clearReconnect();
        this.setState("connecting");
        await this.refreshActiveTab();
        this.socket?.close();
        this.socket = new WebSocket(this.settings.gatewayUrl);
        this.socket.addEventListener("open", () => void this.onOpen());
        this.socket.addEventListener("message", (event) => void this.onMessage(event));
        this.socket.addEventListener("close", () => this.onClose());
        this.socket.addEventListener("error", () => this.onError("WebSocket connection failed."));
    }
    disconnect() {
        this.shouldStayConnected = false;
        this.clearReconnect();
        this.stopHeartbeat();
        this.socket?.close();
        this.socket = null;
        this.setState("disconnected");
    }
    async startRecording() {
        this.recordingState = "recording";
        this.emitStatus();
        await this.broadcastToContent({ type: "recording", recording: true, settings: this.settings });
        await this.handleRecordingEvent({
            kind: "browser.tab",
            sequence: Date.now(),
            url: this.activeTabUrl ?? "",
            title: "",
            eventTimestampMs: Date.now(),
            metadata: { recordingState: "started" }
        });
    }
    async stopRecording() {
        this.recordingState = "idle";
        this.emitStatus();
        await this.broadcastToContent({ type: "recording", recording: false, settings: this.settings });
        await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload({
            kind: "browser.tab",
            sequence: Date.now(),
            url: this.activeTabUrl ?? "",
            title: "",
            eventTimestampMs: Date.now(),
            metadata: { recordingState: "stopped" }
        }));
    }
    async handleRecordingEvent(payload, tabId, frameId) {
        if (this.recordingState !== "recording" && payload.kind !== "content.ready")
            return;
        await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId));
    }
    async handleTabUpdated(tab) {
        if (tab.active && tab.id !== undefined) {
            this.activeTabId = tab.id;
            this.activeTabUrl = tab.url;
            this.emitStatus();
        }
        if (!tab.id)
            return;
        await this.sendClientMessage("client.tab_state", compactObject({ tabId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }));
    }
    async onOpen() {
        this.reconnectAttempt = 0;
        this.lastError = undefined;
        this.setState(this.session.token ? "connecting" : "pairing");
        this.startHeartbeat();
        await this.sendHello();
    }
    onClose() {
        this.stopHeartbeat();
        this.socket = null;
        if (this.shouldStayConnected && this.settings.autoReconnect) {
            this.scheduleReconnect();
        }
        else {
            this.setState("disconnected");
        }
    }
    onError(message) {
        this.lastError = message;
        this.setState("error");
    }
    async onMessage(event) {
        this.lastMessageAt = Date.now();
        let message;
        try {
            message = JSON.parse(String(event.data));
        }
        catch {
            this.lastError = "Received invalid JSON from FluxIQ gateway.";
            this.emitStatus();
            return;
        }
        if (message.type === "server.ping") {
            this.lastMessageAt = Date.now();
            this.emitStatus();
            return;
        }
        if (message.type === "server.pairing_required") {
            this.pairingReferenceCode = message.payload.referenceCode;
            this.setState("pairing");
            this.lastError = message.payload.reason || "Approve this client in FluxIQ.";
            this.emitStatus();
            return;
        }
        if (message.type === "server.error") {
            this.lastError = message.payload.message;
            this.setState("error");
            return;
        }
        if (message.type === "server.session_ready") {
            this.session = compactObject({
                ...this.session,
                sessionId: message.payload.sessionId,
                token: message.payload.token,
                serverUrl: this.settings.gatewayUrl,
                connectedAt: Date.now()
            });
            this.pairingReferenceCode = undefined;
            await writeSession(this.session);
            this.setState("connected");
            await this.sendBrowserState();
            await this.flushQueue();
            return;
        }
        if (message.type === "server.start_recording") {
            await this.handleServerCommandPayload({ ...message.payload, command: "start_recording" }, message.id);
            return;
        }
        if (message.type === "server.stop_recording") {
            await this.handleServerCommandPayload({ ...message.payload, command: "stop_recording" }, message.id);
            return;
        }
        if (message.type === "server.capture_snapshot") {
            await this.handleServerCommandPayload({ ...message.payload, command: "capture_snapshot" }, message.id);
            return;
        }
        if (message.type === "server.set_active_tab") {
            await this.handleServerCommandPayload({ ...message.payload, command: "set_active_tab" }, message.id);
            return;
        }
        if (message.type === "server.execute_action") {
            await this.handleServerCommandPayload({ command: "execute_action", action: browserActionFromGatewayCommand(message.payload) }, message.id);
            return;
        }
        if (message.type === "server.disconnect") {
            this.disconnect();
        }
    }
    async handleServerCommandPayload(payload, messageId) {
        if (payload.command === "ping") {
            this.lastMessageAt = Date.now();
            this.emitStatus();
            return;
        }
        if (payload.command === "disconnect") {
            this.disconnect();
            return;
        }
        if (payload.command === "start_recording") {
            await this.startRecording();
            return;
        }
        if (payload.command === "stop_recording") {
            await this.stopRecording();
            return;
        }
        if (payload.command === "set_active_tab") {
            const tabId = Number(payload.tabId);
            this.activeTabId = tabId;
            await chrome.tabs.update(tabId, { active: true });
            this.emitStatus();
            return;
        }
        if (payload.command === "capture_snapshot") {
            const tabId = this.activeTabId;
            if (tabId === undefined)
                return;
            const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
            await this.sendClientMessage("client.dom_snapshot", gatewaySnapshotFromDomSnapshot(snapshot));
            return;
        }
        if (payload.command === "execute_action") {
            const action = payload.action;
            const tabId = action.tabId ?? this.activeTabId;
            if (tabId === undefined) {
                await this.sendActionResult({
                    commandId: action.commandId,
                    actionType: action.actionType,
                    status: "failed",
                    message: "No active tab is available.",
                    startedAt: Date.now(),
                    finishedAt: Date.now()
                });
                return;
            }
            if (action.actionType === "browser.navigate" && action.url) {
                const startedAt = Date.now();
                await chrome.tabs.update(tabId, { url: action.url });
                await this.sendActionResult({
                    commandId: action.commandId,
                    actionType: action.actionType,
                    status: "succeeded",
                    message: "Navigation requested.",
                    url: action.url,
                    startedAt,
                    finishedAt: Date.now()
                });
                return;
            }
            const result = await sendToTab(tabId, { type: "executeAction", action }, action.frameId);
            await this.sendActionResult(result, tabId, action.frameId);
        }
    }
    async sendHello() {
        const tab = await activeTab();
        await this.sendClientMessage("client.hello", compactObject({
            clientId: this.session.clientId,
            clientType: "browser-extension",
            name: "FluxIQ Browser Extension",
            version: browserDescriptor().extensionVersion,
            token: this.session.token,
            capabilities: browserExtensionCapabilities,
            metadata: {
                browser: browserDescriptor(),
                settings: {
                    captureMutations: this.settings.captureMutations,
                    captureInputValues: this.settings.captureInputValues,
                    captureSnapshots: this.settings.captureSnapshots
                }
            }
        }));
    }
    async sendBrowserState() {
        await this.sendClientMessage("client.browser_state", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
    }
    async sendActionResult(result, tabId, frameId) {
        await this.sendClientMessage("client.action_result", gatewayActionResultFromBrowserResult(result));
        await this.handleRecordingEvent(compactObject({
            kind: "action.result",
            sequence: Date.now(),
            url: result.url ?? this.activeTabUrl ?? "",
            title: result.title ?? "",
            eventTimestampMs: result.finishedAt,
            element: result.element,
            snapshot: result.snapshot,
            actionResult: result
        }), tabId, frameId);
    }
    async sendClientMessage(type, payload, _tabId, _frameId) {
        const message = createClientEnvelope(compactObject({
            type,
            clientId: this.session.clientId,
            sessionId: this.session.sessionId,
            payload
        }));
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return;
        }
        this.queueSize = await queueEvent(message);
        this.emitStatus();
    }
    async flushQueue() {
        if (this.socket?.readyState !== WebSocket.OPEN)
            return;
        const queued = await readQueuedEvents();
        for (const message of queued)
            this.socket.send(JSON.stringify(message));
        await clearQueuedEvents();
        this.queueSize = 0;
        this.emitStatus();
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.connectionState === "connected")
                void this.sendBrowserState();
        }, HEARTBEAT_INTERVAL_MS);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = undefined;
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.setState("reconnecting");
        const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt);
        this.reconnectAttempt += 1;
        this.reconnectTimer = setTimeout(() => void this.connect(), delay);
    }
    clearReconnect() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
    }
    async refreshActiveTab() {
        const tab = await activeTab();
        this.activeTabId = tab?.tabId;
        this.activeTabUrl = tab?.url;
        this.emitStatus();
    }
    async broadcastToContent(message) {
        const tabs = await chrome.tabs.query({});
        await Promise.allSettled(tabs.map((tab) => tab.id === undefined ? Promise.resolve() : sendToTab(tab.id, message)));
    }
    setState(state) {
        this.connectionState = state;
        this.emitStatus();
    }
    emitStatus() {
        const status = this.status();
        for (const listener of this.listeners)
            listener(status);
        void chrome.runtime.sendMessage({ type: "fluxiq.statusChanged", status }).catch(() => undefined);
    }
}
function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function browserStateFromTabs(active, tabs, recordingState) {
    return compactObject({
        activeTabId: active?.tabId === undefined ? undefined : String(active.tabId),
        recording: recordingState === "recording",
        tabs: tabs.map((tab) => compactObject({
            tabId: String(tab.tabId),
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.favIconUrl,
            active: tab.active,
            metadata: compactObject({
                windowId: tab.windowId,
                status: tab.status
            })
        })),
        permissions: ["activeTab", "scripting", "storage", "tabs"]
    });
}
function gatewayRecordingEventFromPayload(payload, tabId, frameId) {
    return compactObject({
        eventId: `event.${payload.sequence}.${payload.eventTimestampMs}`,
        eventType: payload.kind,
        timestamp: payload.eventTimestampMs,
        sourceId: tabId === undefined ? undefined : `tab:${tabId}${frameId === undefined ? "" : `:frame:${frameId}`}`,
        target: payload.element ? elementTarget(payload.element) : undefined,
        payload: compactObject({
            url: payload.url,
            title: payload.title,
            sequence: payload.sequence,
            inputValue: payload.inputValue,
            key: payload.key,
            scroll: payload.scroll,
            mutation: payload.mutation,
            snapshot: payload.snapshot,
            actionResult: payload.actionResult
        }),
        metadata: payload.metadata
    });
}
function gatewaySnapshotFromDomSnapshot(snapshot) {
    return {
        snapshotId: `dom.${Date.now()}`,
        timestamp: Date.now(),
        kind: "dom",
        state: {
            url: snapshot.url,
            title: snapshot.title,
            viewport: snapshot.viewport,
            focusedElement: snapshot.focusedElement,
            selectedText: snapshot.selectedText ?? null,
            interactiveElements: snapshot.interactiveElements
        },
        payload: snapshot
    };
}
function browserActionFromGatewayCommand(command) {
    const parameters = command.parameters ?? {};
    const target = command.target ?? {};
    return compactObject({
        commandId: command.commandId,
        actionType: command.actionType,
        selector: stringValue(target.selector) ?? stringValue(parameters.selector),
        text: stringValue(parameters.text),
        value: stringValue(parameters.value),
        key: stringValue(parameters.key),
        url: stringValue(parameters.url),
        timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs),
        coordinates: pointValue(target.coordinates ?? parameters.coordinates),
        options: parameters
    });
}
function gatewayActionResultFromBrowserResult(result) {
    return compactObject({
        commandId: result.commandId,
        status: result.status,
        startedAt: result.startedAt,
        completedAt: result.finishedAt,
        message: result.message,
        target: result.element ? elementTarget(result.element) : undefined,
        payload: compactObject({
            url: result.url,
            title: result.title,
            snapshot: result.snapshot,
            extracted: result.extracted
        }),
        error: result.status === "failed" ? result.message : undefined
    });
}
function elementTarget(element) {
    return compactObject({
        selector: element.selector,
        tagName: element.tagName,
        text: element.text,
        bounds: element.bounds,
        attributes: element.attributes
    });
}
function stringValue(value) {
    return typeof value === "string" ? value : undefined;
}
function numberValue(value) {
    return typeof value === "number" ? value : undefined;
}
function pointValue(value) {
    if (!value || typeof value !== "object")
        return undefined;
    const point = value;
    return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : undefined;
}
//# sourceMappingURL=connection.js.map