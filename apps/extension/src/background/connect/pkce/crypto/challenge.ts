import { connectFieldSchemas } from "@fluxiq/contracts/platform";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceOptions } from "../model";
import { pkceBase64Url } from "./base64";

export async function createPkceChallenge(verifier: string, crypto: HostedPkceOptions["crypto"]): Promise<string> {
  try {
    if (!connectFieldSchemas.codeVerifier.safeParse(verifier).success) throw new HostedPkceFailure("crypto_unavailable");
    const challenge = pkceBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    if (!connectFieldSchemas.codeChallenge.safeParse(challenge).success) throw new HostedPkceFailure("crypto_unavailable");
    return challenge;
  } catch {
    throw new HostedPkceFailure("crypto_unavailable");
  }
}
