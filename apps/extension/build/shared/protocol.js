export const CLIENT_GATEWAY_PROTOCOL_VERSION = "0.1";
export const browserExtensionCapabilities = [
    { id: "browser.state", label: "Browser state", kind: "state" },
    { id: "dom.snapshot", label: "DOM snapshot", kind: "snapshot" },
    { id: "recording.events", label: "Recording events", kind: "recording" },
    {
        id: "browser.actions",
        label: "Browser actions",
        kind: "action",
        actionTypes: [
            "browser.navigate",
            "dom.click",
            "dom.type",
            "dom.clear",
            "dom.select",
            "dom.scroll",
            "dom.keypress",
            "dom.wait_for_selector",
            "dom.wait_for_text",
            "dom.extract",
            "dom.capture_snapshot"
        ]
    }
];
export function createClientEnvelope(params) {
    const envelope = {
        id: `${params.clientId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        type: params.type,
        protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
        timestamp: Date.now(),
        clientId: params.clientId,
        payload: params.payload
    };
    if (params.sessionId)
        envelope.sessionId = params.sessionId;
    if (params.correlationId)
        envelope.correlationId = params.correlationId;
    return envelope;
}
//# sourceMappingURL=protocol.js.map