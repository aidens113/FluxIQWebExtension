// The web domain's host-resource port: what Core's scheduler
// (`AutomationStudioHostResourceScheduler`) grants builder leases through
// (automation-project-agents plan, `Host Actions`).
//
//  - **Capacity 1** (`./capacity.ts`): one builder drives the browser at a time.
//  - **The resource** is the paired extension's automation tab, named
//    `web.automation:<clientId>` (`./resource-key.ts`). Every grant also names
//    the gateway session it lives on (`sessionId`), so Core scopes its strict
//    lease checks to that one client.
//  - **A grant needs exactly one browser** a build may drive
//    (`./leasable-session.ts`). With none, or two, the port answers
//    `at_capacity`, and Core waits for a release or `retryWaiting()`; it never
//    guesses which browser a lease names. A lease still held answers the same,
//    so the port itself never hands out a second one.
//  - **Epochs rise strictly**, across releases and across a Core restart: each
//    is the later of one above the last and the clock in milliseconds, so a
//    port made after a restart starts above every epoch the previous one gave
//    (unless that one granted more than one lease per millisecond, which a
//    lease that lasts a whole build never does). The extension refuses a
//    command whose epoch is below the highest it has seen for the resource,
//    which is what stops a stale builder's late command.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import type {
  AutomationStudioHostResourceAcquireResult,
  AutomationStudioHostResourceGrant,
  AutomationStudioHostResourceLease,
  AutomationStudioHostResourcePort
} from "fluxiq/automation-studio";
import { WEB_AUTOMATION_HOST_RESOURCE_CAPACITY } from "./capacity";
import { webAutomationLeasableSession } from "./leasable-session";
import { webAutomationHostResourceKey } from "./resource-key";

export type WebAutomationHostResourcePortDeps = {
  /** The client gateway's sessions now (`fluxiq.programs.clientGateway.snapshot().sessions`). */
  readonly sessions: () => readonly ClientGatewaySession[];
  /** The clock epochs are seeded from; tests replace it. */
  readonly now?: () => number;
};

export function createWebAutomationHostResourcePort(deps: WebAutomationHostResourcePortDeps): AutomationStudioHostResourcePort {
  const now = deps.now ?? Date.now;
  let lastEpoch = 0;
  let held: AutomationStudioHostResourceGrant | undefined;
  return {
    capacity: WEB_AUTOMATION_HOST_RESOURCE_CAPACITY,
    acquire(): AutomationStudioHostResourceAcquireResult {
      if (held !== undefined) return "at_capacity";
      const session = webAutomationLeasableSession(deps.sessions());
      if (session === undefined) return "at_capacity";
      lastEpoch = Math.max(lastEpoch + 1, Math.floor(now()));
      held = Object.freeze({ resourceKey: webAutomationHostResourceKey(session.clientId), epoch: lastEpoch, sessionId: session.sessionId });
      return held;
    },
    release(lease: AutomationStudioHostResourceLease): void {
      if (held !== undefined && held.resourceKey === lease.resourceKey && held.epoch === lease.epoch) held = undefined;
    }
  };
}
