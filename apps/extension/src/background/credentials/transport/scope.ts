import { requireCheckedBinding } from "../binding";
import type { HostedCredentialSnapshot } from "../model";
import { HostedCredentialTransportError } from "./failure";

export type HostedCredentialScope = Readonly<Pick<HostedCredentialSnapshot, "binding" | "installId" | "userId" | "workspaceId" | "connectedClientId" | "lineageId" | "lineageKey"> & { bindingKey: string }>;

export function hostedCredentialScope(snapshot: HostedCredentialSnapshot): HostedCredentialScope {
  try {
    const { binding, installId, userId, workspaceId, connectedClientId, lineageId, lineageKey } = snapshot;
    if (![installId, userId, workspaceId, connectedClientId, lineageId, lineageKey].every(value => typeof value === "string" && value.length > 0)) throw new HostedCredentialTransportError("trust_changed");
    return Object.freeze({ binding, bindingKey: requireCheckedBinding(binding), installId, userId, workspaceId, connectedClientId, lineageId, lineageKey });
  } catch {
    throw new HostedCredentialTransportError("trust_changed");
  }
}

export function scopedCredentialSnapshot(scope: HostedCredentialScope, snapshot: HostedCredentialSnapshot | null): HostedCredentialSnapshot {
  const keys = ["installId", "userId", "workspaceId", "connectedClientId", "lineageId", "lineageKey"] as const;
  if (!snapshot || requireCheckedBinding(snapshot.binding) !== scope.bindingKey || keys.some(key => snapshot[key] !== scope[key]) || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1) throw new HostedCredentialTransportError("trust_changed");
  return Object.freeze({ ...snapshot });
}
