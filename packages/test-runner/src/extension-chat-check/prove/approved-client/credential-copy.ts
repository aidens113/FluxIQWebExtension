import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "fluxiq/client-gateway";
import type { Page } from "@playwright/test";

/** Preserves the copied-token reuse proof. Credentials stay private and never enter evidence. */
export async function connectWithCredentialCopy(control: Page, gatewayUrl: string): Promise<{ close(): void }> {
  const stored = await control.evaluate(async () => {
    const all = await (globalThis as any).chrome.storage.local.get(null) as Record<string, { token?: string; clientId?: string } | undefined>;
    const entry = Object.values(all).find((value) => typeof value?.token === "string" && typeof value?.clientId === "string");
    return entry ? { token: entry.token, clientId: entry.clientId } : undefined;
  });
  if (!stored?.token || !stored.clientId) throw new Error("This browser holds no credential to copy.");
  const socket = new WebSocket(gatewayUrl);
  const send = (type: string, payload: Record<string, unknown>) => socket.send(JSON.stringify({ id: `copy.${Date.now()}.${Math.random()}`, type, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), payload }));
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The credential copy was not answered.")), 20_000);
      const fail = () => {
        clearTimeout(timer);
        reject(new Error("The credential copy could not connect."));
      };
      socket.addEventListener("open", () => send("client.hello", { clientId: stored.clientId, clientType: "extension", name: "Copied extension credential", token: stored.token, capabilities: [], metadata: { domainId: "web-automation" } }));
      socket.addEventListener("message", (event) => {
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          fail();
          return;
        }
        if (!message || typeof message !== "object" || Array.isArray(message)) {
          fail();
          return;
        }
        if ((message as { type?: unknown }).type !== "server.session_ready") return;
        send("client.credential_received", {});
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", fail);
      socket.addEventListener("close", fail);
    });
  } catch (error) {
    socket.close();
    throw error;
  }
  return { close: () => socket.close() };
}
