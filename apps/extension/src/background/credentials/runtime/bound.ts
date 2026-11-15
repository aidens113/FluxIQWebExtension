import type { BoundHostedCredentials } from "../model";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";
import { commitCredential } from "./commit";
import { forgetCredential } from "./forget";
import { acknowledgeCredentialRevocation, listCredentialRevocations, queueCredentialRevocation } from "./revocations";
import { credentialSnapshot, emptyBindingRecord, readBindingRecord } from "./state";
import { credentialBoundary } from "./boundary";

export function boundHostedCredentials(context: CredentialContext): BoundHostedCredentials {
  return Object.freeze<BoundHostedCredentials>({
    getOrCreateInstallation: () => credentialBoundary(() => context.database.run("readwrite", async transaction => {
      const existing = await readBindingRecord(context, transaction);
      const row = existing ?? emptyBindingRecord(context);
      if (!existing) await idbRequest(transaction.objectStore("bindings").add(row));
      return { installId: row.installId, revision: row.revision };
    })),
    read: () => credentialBoundary(async () => {
      const row = await context.database.run("readonly", transaction => readBindingRecord(context, transaction));
      return row?.credential ? credentialSnapshot(context, row) : null;
    }),
    commit: input => credentialBoundary(() => commitCredential(context, input)),
    forget: input => credentialBoundary(() => forgetCredential(context, input)),
    queueRevocation: input => credentialBoundary(() => queueCredentialRevocation(context, input)),
    pendingRevocations: () => credentialBoundary(() => listCredentialRevocations(context)),
    acknowledgeRevocation: revocationId => credentialBoundary(() => acknowledgeCredentialRevocation(context, revocationId))
  });
}
