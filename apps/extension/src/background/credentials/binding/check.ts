import { parseFluxIQDiscoveryDocument } from "@fluxiq/contracts/platform";
import { HostedCredentialError } from "../failure";
import type { HostedCredentialAudience, HostedCredentialBinding } from "./types";

const checked = new WeakSet<object>();

/** Checks discovery evidence; flow/version support is a later connection-policy decision. */
export function checkHostedCredentialBinding(discovery: unknown, selectedOrigin: string): HostedCredentialBinding {
  try {
    const parsed = parseFluxIQDiscoveryDocument(discovery, selectedOrigin);
    if (!parsed.success || !parsed.data.instance.id || selectedOrigin.includes("*")) throw new HostedCredentialError("binding_invalid");
    const document = parsed.data;
    const gateway = new URL(document.gatewayUrl);
    if (gateway.href !== document.gatewayUrl || document.gatewayUrl.includes("*")) throw new HostedCredentialError("binding_invalid");
    const endpoint = (path: string): string => {
      const url = new URL(path, document.origin);
      if (url.origin !== document.origin || url.username || url.password || url.hash || url.href.includes("*")) throw new HostedCredentialError("binding_invalid");
      return url.href;
    };
    const binding = Object.freeze({ origin: document.origin, instanceId: document.instance.id!, gatewayUrl: gateway.href, authorizeUrl: endpoint(document.connect.authorizeUrl), tokenUrl: endpoint(document.connect.tokenUrl), revokeUrl: endpoint(document.connect.revokeUrl) }) as HostedCredentialBinding;
    checked.add(binding);
    return binding;
  } catch {
    throw new HostedCredentialError("binding_invalid");
  }
}

export function requireCheckedBinding(binding: HostedCredentialBinding): string {
  if (!binding || !checked.has(binding)) throw new HostedCredentialError("binding_invalid");
  return JSON.stringify([binding.origin, binding.instanceId, binding.gatewayUrl, binding.authorizeUrl, binding.tokenUrl, binding.revokeUrl]);
}

export function bindingAudience(binding: HostedCredentialBinding): HostedCredentialAudience {
  requireCheckedBinding(binding);
  return { origin: binding.origin, instanceId: binding.instanceId, gatewayUrl: binding.gatewayUrl, authorizeUrl: binding.authorizeUrl, tokenUrl: binding.tokenUrl, revokeUrl: binding.revokeUrl };
}
