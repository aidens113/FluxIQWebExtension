import type { ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { HostedCredentialSnapshot } from "../model";

/** Matching data is only a replay candidate: the repository must verify its durable receipt. */
export function matchesHostedCredentialResponse(snapshot: HostedCredentialSnapshot, response: ConnectTokenResponse): boolean {
  return snapshot.credential === response.credential && snapshot.expiresAtMs === response.credentialExpiresAt && snapshot.userId === response.user.userId && snapshot.workspaceId === response.workspace.workspaceId && snapshot.connectedClientId === response.connectedClientId && snapshot.binding.gatewayUrl === response.gatewayUrl;
}
