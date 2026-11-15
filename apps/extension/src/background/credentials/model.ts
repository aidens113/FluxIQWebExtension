import type { ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { HostedCredentialBinding } from "./binding";

export type HostedInstallationIdentity = Readonly<{ installId: string; revision: number }>;

/** Private material for a bound background consumer; never a panel/runtime status payload. */
export type HostedCredentialSnapshot = HostedInstallationIdentity & Readonly<{
  binding: HostedCredentialBinding;
  credential: string;
  expiresAtMs: number;
  connectedClientId: string;
  userId: string;
  workspaceId: string;
  lineageId: string;
  lineageKey: string;
}>;

export type HostedCredentialCommit = {
  operationId: string;
  expectedRevision: number;
  kind: "new-trust" | "rotation";
  response: ConnectTokenResponse;
};

export type HostedPendingRevocation = Readonly<{ revocationId: string; binding: HostedCredentialBinding; credential: string; createdAtMs: number }>;

export interface BoundHostedCredentials {
  getOrCreateInstallation(): Promise<HostedInstallationIdentity>;
  read(): Promise<HostedCredentialSnapshot | null>;
  commit(input: HostedCredentialCommit): Promise<HostedCredentialSnapshot>;
  forget(input: { expectedRevision: number; operationId: string }): Promise<HostedInstallationIdentity>;
  queueRevocation(input: { operationId: string; credential: string }): Promise<HostedPendingRevocation | null>;
  pendingRevocations(): Promise<HostedPendingRevocation[]>;
  acknowledgeRevocation(revocationId: string): Promise<void>;
}

export interface HostedCredentialRepository {
  forBinding(binding: HostedCredentialBinding): BoundHostedCredentials;
  close(): Promise<void>;
}
