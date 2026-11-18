import { requireCheckedBinding } from "./binding";
import { HostedCredentialError } from "./failure";
import type { HostedCredentialRepository } from "./model";
import { boundHostedCredentials } from "./runtime";
import { CredentialDatabase } from "./storage";

export type HostedCredentialRepositoryOptions = { indexedDB?: IDBFactory; databaseName?: string; now?: () => number; randomUUID?: () => string };

export function createHostedCredentialRepository(options: HostedCredentialRepositoryOptions = {}): HostedCredentialRepository {
  let factory: IDBFactory;
  try {
    const selected = options.indexedDB ?? globalThis.indexedDB;
    if (!selected || typeof selected.open !== "function") throw new HostedCredentialError("storage_unavailable");
    factory = selected;
  } catch {
    throw new HostedCredentialError("storage_unavailable");
  }
  const database = new CredentialDatabase(factory, options.databaseName ?? "fluxiq.private.credentials.v1");
  const clock = options.now ?? Date.now;
  const now = () => {
    try {
      const value = clock();
      if (!Number.isSafeInteger(value) || value < 0) throw new HostedCredentialError("storage_unavailable");
      return value;
    } catch {
      throw new HostedCredentialError("storage_unavailable");
    }
  };
  const mint = options.randomUUID ?? (() => globalThis.crypto.randomUUID());
  return Object.freeze<HostedCredentialRepository>({
    forBinding: binding => boundHostedCredentials({ binding, key: requireCheckedBinding(binding), database, now, mint }),
    close: () => database.close()
  });
}
