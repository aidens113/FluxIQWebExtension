import { FLUXIQ_CONNECT_CLIENT_ID, connectRedirectUri, connectTokenErrorSchema, connectTokenRequestSchema, connectTokenResponseSchema, type ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { HostedPkceContext } from "../context";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceStoredAttempt } from "../model";

/** Deliberately parses a delivered proof even when its controller was cancelled. */
export async function requestPkceToken(context: HostedPkceContext, record: Extract<HostedPkceStoredAttempt, { phase: "waiting" }>, code: string): Promise<ConnectTokenResponse> {
  const body = connectTokenRequestSchema.parse({ grant_type: "authorization_code", code, code_verifier: record.verifier, redirect_uri: connectRedirectUri(record.binding.origin), client_id: FLUXIQ_CONNECT_CLIENT_ID, client_install_id: record.installId });
  const controller = new AbortController();
  context.aborts.add(controller);
  try {
    let response: Response;
    try { response = await context.options.fetch(record.binding.tokenUrl, { method: "POST", headers: { "Content-Type": "application/json", "fluxiq-client": "browser-extension" }, body: JSON.stringify(body), credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal }); }
    catch { throw new HostedPkceFailure("exchange_uncertain"); }
    let value: unknown;
    try { value = await response.json(); }
    catch { throw new HostedPkceFailure(response.status === 200 ? "response_invalid" : "exchange_uncertain"); }
    if (response.status === 200) {
      const parsed = connectTokenResponseSchema.safeParse(value);
      if (!parsed.success) throw new HostedPkceFailure("response_invalid");
      return parsed.data;
    }
    if (response.status === 503 || response.status >= 500) throw new HostedPkceFailure("exchange_uncertain");
    const parsed = connectTokenErrorSchema.safeParse(value);
    if (!parsed.success) throw new HostedPkceFailure("response_invalid");
    throw new HostedPkceFailure(parsed.data.error);
  } finally { context.aborts.delete(controller); }
}
