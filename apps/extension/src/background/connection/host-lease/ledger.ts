// The highest host lease this browser has seen for each resource key
// (automation-project-agents plan, `Extension And Domain Wiring` 1), against
// which every leased command is judged (`webAutomationHostLeaseJudgement`).
//
// Kept in the browser's session storage beside the in-flight records
// (`../in-flight/record-area.ts`), one key per resource
// (`fluxiq.hostLease.<resourceKey>`), so a restarted service worker still knows
// which epoch is current: without it, a stale builder's late command reaching
// a fresh worker would be adopted as a new grant. A memory of what this worker
// judged sits in front of storage, so a storage fault never loses a lease
// already seen; the fault is handed back for the caller to report.
//
// Judgements run one after another. Two commands judged at once would each
// read the old epoch, and the lower one could then be written last.

import {
  WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES,
  webAutomationHostLeaseJudgement,
  webAutomationHostLeaseReading,
  webAutomationHostLeaseRefusal,
  webAutomationHostLeaseRefusalCode,
  type WebAutomationHostLease,
  type WebAutomationHostLeaseJudgement
} from "@fluxiq-web-extension/domain/client";
import type { ClientGatewayActionResult } from "../../../shared/protocol";
import type { InFlightRecordArea } from "../in-flight/index";

/** How a lease was judged, the lease it was judged against, and a storage fault met on the way. */
export type HostLeaseAdmission = {
  readonly judgement: WebAutomationHostLeaseJudgement;
  readonly seen: WebAutomationHostLease | undefined;
  readonly fault?: unknown;
};

/** What a command's lease earns it: a refusal to send instead of running it, or nothing; and a storage fault to report. */
export type HostLeaseVerdict = {
  readonly refusal?: ClientGatewayActionResult;
  readonly fault?: unknown;
};

const KEY_PREFIX = "fluxiq.hostLease.";

export class HostLeaseLedger {
  private readonly memory = new Map<string, WebAutomationHostLease>();
  private turn: Promise<unknown> = Promise.resolve();

  constructor(private readonly area: InFlightRecordArea) {}

  /** Judges `lease` against the highest seen for its resource, and keeps it when it is higher. */
  admit(lease: WebAutomationHostLease): Promise<HostLeaseAdmission> {
    const next = this.turn.then(async () => await this.judge(lease));
    // The next judgement waits for this one however it ends; its caller hears how.
    this.turn = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * The verdict on a command's `lease` field as it came off the wire: no lease
   * runs as it always has; one that cannot be read is refused as missing; a
   * readable one is admitted, and refused when stale or another holder's.
   */
  async verdict(commandId: string, lease: unknown, now: () => number = Date.now): Promise<HostLeaseVerdict> {
    const reading = webAutomationHostLeaseReading(lease);
    if (reading.kind === "none") return {};
    if (reading.kind === "unreadable") return { refusal: webAutomationHostLeaseRefusal(commandId, WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES.missing, now()) };
    const admission = await this.admit(reading.lease);
    const code = webAutomationHostLeaseRefusalCode(admission.judgement);
    const refusal = code === undefined ? undefined : webAutomationHostLeaseRefusal(commandId, code, now(), admission.seen?.epoch);
    return { ...(refusal === undefined ? {} : { refusal }), ...(admission.fault === undefined ? {} : { fault: admission.fault }) };
  }

  private async judge(lease: WebAutomationHostLease): Promise<HostLeaseAdmission> {
    const key = KEY_PREFIX + lease.resourceKey;
    let fault: unknown;
    let seen = this.memory.get(key);
    if (seen === undefined) {
      try {
        seen = storedLease((await this.area.get(null))[key]);
      } catch (error) {
        fault = error;
      }
    }
    const judgement = webAutomationHostLeaseJudgement(lease, seen);
    if (judgement === "adopt") {
      this.memory.set(key, lease);
      try {
        await this.area.set({ [key]: lease });
      } catch (error) {
        fault ??= error;
      }
    } else if (seen !== undefined) {
      this.memory.set(key, seen);
    }
    return fault === undefined ? { judgement, seen } : { judgement, seen, fault };
  }
}

/** A stored lease read field by field, as any wire lease is; a value that is not one counts as none. */
function storedLease(value: unknown): WebAutomationHostLease | undefined {
  const reading = webAutomationHostLeaseReading(value);
  return reading.kind === "lease" ? reading.lease : undefined;
}
