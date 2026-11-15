import { HostedCredentialError } from "../failure";

export async function credentialBoundary<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof HostedCredentialError) throw error;
    throw new HostedCredentialError("storage_unavailable");
  }
}
