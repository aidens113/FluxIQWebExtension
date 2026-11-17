import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "@fluxiq/contracts/client-gateway";
import { FLUXIQ_CONNECT_PATHS, parseFluxIQDiscoveryDocument } from "@fluxiq/contracts/platform";
import { checkHostedCredentialBinding, type HostedCredentialAudience, type HostedCredentialBinding } from "../../credentials";
import type { HostedPkceContext } from "./context";
import { HostedPkceFailure } from "./failure";

function compatible(current: string, minimum: string): boolean {
  const left = current.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  if (![...left, ...right].every(Number.isSafeInteger)) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index]! > right[index]!;
  }
  return true;
}

export function samePkceAudience(left: HostedCredentialAudience, right: HostedCredentialAudience): boolean {
  return left.origin === right.origin && left.instanceId === right.instanceId && left.gatewayUrl === right.gatewayUrl
    && left.authorizeUrl === right.authorizeUrl && left.tokenUrl === right.tokenUrl && left.revokeUrl === right.revokeUrl;
}

export async function discoverPkceBinding(context: HostedPkceContext): Promise<HostedCredentialBinding> {
  context.guard();
  let response: Response;
  try { response = await context.options.fetch(new URL(FLUXIQ_CONNECT_PATHS.discovery, context.selection.origin).href, { method: "GET", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" }); }
  catch { throw new HostedPkceFailure("discovery_unavailable"); }
  context.guard();
  if (response.status !== 200) throw new HostedPkceFailure("discovery_unavailable");
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new HostedPkceFailure("discovery_invalid"); }
  context.guard();
  const parsed = parseFluxIQDiscoveryDocument(body, context.selection.origin);
  if (!parsed.success) throw new HostedPkceFailure("discovery_invalid");
  const document = parsed.data;
  if (document.instance.profile !== "service" || !document.instance.id || document.connect.flows?.authorizationCodePkce !== true
    || !document.protocols.clientGateway.includes(CLIENT_GATEWAY_PROTOCOL_VERSION)) throw new HostedPkceFailure("unsupported_server");
  const minimum = document.minimumClient["browser-extension"];
  if (!minimum || !compatible(context.selection.extensionVersion, minimum)) throw new HostedPkceFailure("client_incompatible");
  try { return checkHostedCredentialBinding(document, context.selection.origin); }
  catch { throw new HostedPkceFailure("discovery_invalid"); }
}
