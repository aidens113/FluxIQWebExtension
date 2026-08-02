import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "fluxiq/client-gateway";
export function createClientGatewayMessage(type, payload, options = {}) {
    return {
        id: options.idFactory?.() ?? `client-message.${Math.random().toString(36).slice(2)}`,
        type,
        protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
        timestamp: options.now?.() ?? Date.now(),
        ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        ...(options.clientId !== undefined ? { clientId: options.clientId } : {}),
        ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
        payload
    };
}
export function parseServerMessage(data) {
    const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : "";
    if (!text)
        return null;
    const parsed = JSON.parse(text);
    if (typeof parsed.type !== "string" || !parsed.type.startsWith("server."))
        return null;
    return parsed;
}
