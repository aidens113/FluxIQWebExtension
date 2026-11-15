import { FLUXIQ_CONNECT_CLIENT_ID, connectAuthorizeRequestSchema, connectRedirectUri } from "@fluxiq/contracts/platform";
import type { HostedPkceContext } from "./context";
import type { HostedPkceStoredAttempt } from "./model";

export function pkceAuthorizeUrl(context: HostedPkceContext, record: Extract<HostedPkceStoredAttempt, { phase: "waiting" }>, challenge: string): string {
  const fields = connectAuthorizeRequestSchema.parse({ client_id: FLUXIQ_CONNECT_CLIENT_ID, redirect_uri: connectRedirectUri(record.binding.origin), code_challenge: challenge, code_challenge_method: "S256", state: record.state, client_install_id: record.installId, client_label: context.selection.clientLabel });
  const url = new URL(record.binding.authorizeUrl);
  for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  return url.href;
}
