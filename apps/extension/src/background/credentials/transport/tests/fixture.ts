import type { ClientGatewayCredentialWriteMetadata } from "@fluxiq/client-gateway-websocket";
import { createHostedCredentialTokenStorage } from "../index";
import type { BoundHostedCredentials, HostedCredentialRepository } from "../../model";
import { fixture, response, seed } from "../../tests/fixture";

export async function adapterFixture() {
  const backing = fixture();
  const snapshot = await seed(backing);
  const selection = { current: true };
  const isCurrent = () => selection.current;
  const adapter = createHostedCredentialTokenStorage({ repository: backing.repository, snapshot, isCurrent });
  const grant = response(backing.binding, { credential: "synthetic-rotated-credential".padEnd(48, "r"), credentialExpiresAt: 30_000 });
  const metadata: ClientGatewayCredentialWriteMetadata = { messageId: "ready-message-one", sessionId: "wire.adapter", credentialExpiresAt: grant.credentialExpiresAt, user: grant.user, workspace: grant.workspace };
  return { ...backing, snapshot, selection, isCurrent, adapter, grant, metadata };
}

export function repositoryWithPorts(repository: HostedCredentialRepository, overrides: Partial<BoundHostedCredentials>): HostedCredentialRepository {
  return { forBinding: binding => ({ ...repository.forBinding(binding), ...overrides }), close: () => repository.close() };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}
