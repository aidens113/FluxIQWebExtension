import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "../contracts";
export class MockClientGatewayClient {
    gateway;
    sessionId;
    clientId;
    constructor(gateway, options = {}) {
        this.gateway = gateway;
        this.clientId = options.clientId ?? `mock.${Math.random().toString(36).slice(2)}`;
        this.sessionId = gateway.connect().sessionId;
        void this.send("client.hello", {
            clientId: this.clientId,
            clientType: options.clientType ?? "custom",
            name: options.name ?? this.clientId
        });
    }
    async pair(pairingCode) {
        await this.send("client.pairing_submit", { pairingCode });
    }
    async send(type, payload) {
        await this.gateway.receive(this.sessionId, {
            id: `mock-message.${Math.random().toString(36).slice(2)}`,
            type,
            protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
            timestamp: Date.now(),
            clientId: this.clientId,
            sessionId: this.sessionId,
            payload
        });
    }
    outbound() {
        return this.gateway.outbound(this.sessionId);
    }
}
