import type { ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { BoundHostedCredentials, HostedCredentialSnapshot } from "../../../credentials";
import type { HostedPkceStoredAttempt } from "../model";

/** Journal only this delivered proof; this module never performs revocation HTTP. */
export async function cleanupPkceProof(bound: BoundHostedCredentials, record: HostedPkceStoredAttempt, response: ConnectTokenResponse, adopted?: HostedCredentialSnapshot): Promise<Readonly<{ journalled: true } | { journalled: false; failureCode: "cleanup_required" }>> {
  try {
    if (adopted) {
      // A rotated/replaced revision wins. Never queue its adopted predecessor
      // after a conflict: both proofs may authorize the same connected client.
      await bound.forget({ expectedRevision: adopted.revision, operationId: `${record.attemptId}.forget` });
      return { journalled: true };
    }
    const current = await bound.read();
    if (current?.connectedClientId === response.connectedClientId || current?.credential === response.credential) return { journalled: false, failureCode: "cleanup_required" };
    await bound.queueRevocation({ operationId: `${record.attemptId}.cleanup`, credential: response.credential });
    return { journalled: true };
  } catch { return { journalled: false, failureCode: "cleanup_required" }; }
}
