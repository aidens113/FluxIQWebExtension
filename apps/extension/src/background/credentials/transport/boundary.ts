import { HostedCredentialError } from "../failure";
import { HostedCredentialTransportError } from "./failure";

export async function hostedCredentialTransportBoundary<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof HostedCredentialTransportError || error instanceof HostedCredentialError) throw error;
    throw new HostedCredentialTransportError("operation_failed");
  }
}
