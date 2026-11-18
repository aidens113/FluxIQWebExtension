import { connectTokenResponseSchema, type ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { ClientGatewayCredentialWriteMetadata } from "@fluxiq/client-gateway-websocket";
import { HostedCredentialTransportError } from "./failure";
import type { HostedCredentialScope } from "./scope";

export function hostedReadyResponse(scope: HostedCredentialScope, token: string, metadata?: ClientGatewayCredentialWriteMetadata): { messageId: string; response: ConnectTokenResponse } {
  if (metadata === undefined) throw new HostedCredentialTransportError("metadata_missing");
  try {
    const keys = ["sessionId", "projectId", "user", "workspace", "credentialExpiresAt", "messageId"];
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || Object.keys(metadata).some(key => !keys.includes(key)) || typeof metadata.messageId !== "string" || !/^[\x21-\x7e]{1,256}$/u.test(metadata.messageId) || typeof metadata.sessionId !== "string" || !/^[\x21-\x7e]{1,128}$/u.test(metadata.sessionId) || metadata.projectId !== undefined && metadata.projectId !== null && typeof metadata.projectId !== "string" || !Number.isSafeInteger(metadata.credentialExpiresAt)) throw new HostedCredentialTransportError("metadata_invalid");
    const parsed = connectTokenResponseSchema.safeParse({ credential: token, credentialExpiresAt: metadata.credentialExpiresAt, user: metadata.user, workspace: metadata.workspace, connectedClientId: scope.connectedClientId, gatewayUrl: scope.binding.gatewayUrl });
    if (!parsed.success) throw new HostedCredentialTransportError("metadata_invalid");
    if (parsed.data.user.userId !== scope.userId || parsed.data.workspace.workspaceId !== scope.workspaceId) throw new HostedCredentialTransportError("trust_changed");
    return { messageId: metadata.messageId, response: parsed.data };
  } catch (error) {
    if (error instanceof HostedCredentialTransportError) throw error;
    throw new HostedCredentialTransportError("metadata_invalid");
  }
}
