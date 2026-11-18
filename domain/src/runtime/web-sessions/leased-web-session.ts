import { AutomationStudioHostLeaseScope, AutomationStudioHostResourceStaleLeaseError } from "fluxiq/automation";

/** The browser Core lent to this execution, never another session from the gateway. */
export function leasedWebSessionId(): string | undefined {
  const lease = AutomationStudioHostLeaseScope.current();
  if (lease !== undefined && !AutomationStudioHostLeaseScope.gatewaySource.isCurrent(lease)) throw new AutomationStudioHostResourceStaleLeaseError(lease);
  return lease?.sessionId;
}
