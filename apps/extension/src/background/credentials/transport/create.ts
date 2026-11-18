import { HostedCredentialTransportError } from "./failure";
import { HostedCredentialTokenStorageAdapter } from "./adapter";
import { hostedCredentialScope } from "./scope";
import type { HostedCredentialTokenStorage, HostedCredentialTokenStorageInput } from "./types";

export function createHostedCredentialTokenStorage(input: HostedCredentialTokenStorageInput): HostedCredentialTokenStorage {
  try {
    const scope = hostedCredentialScope(input.snapshot);
    return new HostedCredentialTokenStorageAdapter(input.repository.forBinding(scope.binding), scope, input.isCurrent);
  } catch (error) {
    if (error instanceof HostedCredentialTransportError) throw error;
    throw new HostedCredentialTransportError("operation_failed");
  }
}
