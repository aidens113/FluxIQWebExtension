import { HostedCredentialTransportError } from "./failure";

export async function hostedCredentialOperationId(messageId: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new HostedCredentialTransportError("crypto_unavailable");
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(messageId));
    return `ready-${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    throw new HostedCredentialTransportError("crypto_unavailable");
  }
}
