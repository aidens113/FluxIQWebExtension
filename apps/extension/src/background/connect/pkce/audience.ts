import type { HostedCredentialAudience } from "../../credentials";

export function copyPkceAudience(binding: HostedCredentialAudience): HostedCredentialAudience {
  return Object.freeze({ origin: binding.origin, instanceId: binding.instanceId, gatewayUrl: binding.gatewayUrl, authorizeUrl: binding.authorizeUrl, tokenUrl: binding.tokenUrl, revokeUrl: binding.revokeUrl });
}
