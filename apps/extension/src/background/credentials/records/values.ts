import { connectFieldSchemas, connectTokenResponseSchema, type ConnectTokenResponse } from "@fluxiq/contracts/platform";
import { HostedCredentialError } from "../failure";

export function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{8,128}$/u.test(value);
}

export function opaqueCredential(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 512;
}

export function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

export function installationId(value: unknown): value is string {
  return connectFieldSchemas.installId.safeParse(value).success;
}

export function checkedResponse(value: unknown, now: number, gatewayUrl: string): ConnectTokenResponse {
  try {
    const parsed = connectTokenResponseSchema.safeParse(value);
    if (!parsed.success || !Number.isSafeInteger(parsed.data.credentialExpiresAt) || parsed.data.gatewayUrl !== gatewayUrl) throw new HostedCredentialError("credential_invalid");
    if (parsed.data.credentialExpiresAt <= now) throw new HostedCredentialError("credential_expired");
    return parsed.data;
  } catch (error) {
    if (error instanceof HostedCredentialError) throw error;
    throw new HostedCredentialError("credential_invalid");
  }
}
