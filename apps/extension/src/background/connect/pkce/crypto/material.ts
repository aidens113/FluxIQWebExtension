import { HostedPkceFailure } from "../failure";
import type { HostedPkceOptions } from "../model";
import { pkceBase64Url } from "./base64";

export function createPkceMaterial(crypto: HostedPkceOptions["crypto"]): Readonly<{ attemptId: string; state: string; verifier: string }> {
  try {
    const random = (): string => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return pkceBase64Url(bytes);
    };
    const state = random();
    const verifier = random();
    const attemptEntropy = random();
    if (new Set([state, verifier, attemptEntropy]).size !== 3) throw new HostedPkceFailure("crypto_unavailable");
    const attemptId = `attempt.${attemptEntropy}`;
    return Object.freeze({ attemptId, state, verifier });
  } catch {
    throw new HostedPkceFailure("crypto_unavailable");
  }
}
