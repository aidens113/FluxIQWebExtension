import type { ClientGatewayClientMessage, ClientGatewayCredentialWriteMetadata, FluxIQWebSocketLike } from "@fluxiq/client-gateway-websocket";

/** Test-only socket, with no network or browser API. */
export class CredentialTestSocket implements FluxIQWebSocketLike {
  static latest: CredentialTestSocket;
  readyState = 0;
  readonly sent: ClientGatewayClientMessage[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    CredentialTestSocket.latest = this;
    queueMicrotask(() => {
      this.readyState = 1;
      this.dispatch("open", {});
    });
  }

  send(data: string): void { this.sent.push(JSON.parse(data) as ClientGatewayClientMessage); }
  close(): void { this.readyState = 3; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: (event: unknown) => void): void { this.listeners.get(type)?.delete(listener); }

  ready(token: string, metadata: ClientGatewayCredentialWriteMetadata): void {
    const { messageId, ...payload } = metadata;
    this.dispatch("message", { data: JSON.stringify({ id: messageId, type: "server.session_ready", protocolVersion: "0.1", timestamp: 1, payload: { ...payload, token } }) });
  }
  recording(): void { this.dispatch("message", { data: JSON.stringify({ id: "recording-message", type: "server.start_recording", protocolVersion: "0.1", timestamp: 2, payload: { recordingId: "recording-test" } }) }); }
  acknowledgements(): number { return this.sent.filter(message => message.type === "client.credential_received").length; }

  private dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

export async function nextTask(): Promise<void> { await new Promise<void>(resolve => setImmediate(resolve)); }
