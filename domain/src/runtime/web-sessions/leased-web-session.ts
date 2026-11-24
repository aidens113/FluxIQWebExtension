import { AutomationStudioHostLeaseScope, AutomationStudioHostResourceStaleLeaseError } from "fluxiq/automation";

/**
 * The browser Core lent to this execution, never another session from the gateway.
 *
 * A lease scope is either unbound or bound to one Core instance's domain (Core t911,
 * `runtime/project-agents/host-resources/`); a project build's trials, its part runs and a
 * held page all run bound. `AutomationStudioHostLeaseScope.gatewaySource` reads only an
 * unbound scope, so its `isCurrent` answers no for every bound lease, current or not. Asked
 * about one, it made every page read inside a build's trial throw this stale-lease error
 * after the trial's first step (t1029). So it is asked only about the unbound lease it can
 * see. A bound lease is fenced where Core stamps it: its client gateway reads the
 * instance's own bound source and refuses a command under a released or reissued lease
 * unsent (`host_lease.stale`). Either way a held lease names its own browser and never
 * falls back to another one.
 */
export function leasedWebSessionId(): string | undefined {
  const lease = AutomationStudioHostLeaseScope.current();
  if (lease === undefined) return undefined;
  const unbound = AutomationStudioHostLeaseScope.gatewaySource.current();
  if (unbound !== undefined && !AutomationStudioHostLeaseScope.gatewaySource.isCurrent(unbound)) throw new AutomationStudioHostResourceStaleLeaseError(lease);
  return lease.sessionId;
}
