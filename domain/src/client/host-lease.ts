// The host lease a build command carries, as the browser reads and enforces it
// (automation-project-agents plan, `Extension And Domain Wiring` 1).
//
// Core's scheduler grants one builder at a time the web domain's one browser
// resource (`../runtime/host-resources/`) and its gateway stamps each command
// with the lease it was issued under. Core refuses a command from a role that
// no longer holds the lease before it is sent; the browser checks again, so a
// command that was already on its way when the lease moved still cannot act.
// Serialization is Core's; this check catches mistakes and late copies.
//
// The rule, per resource key, against the highest lease the browser has seen:
//
//  - a higher epoch is adopted -- the resource was granted again;
//  - the same epoch and holder is the current lease;
//  - a lower epoch is `host_lease.stale`: a lease that was released or reissued;
//  - the same epoch with another holder is `host_lease.holder_mismatch`, which
//    a correct Core never sends, since an epoch names one grant to one holder.
//
// A lease that is present but cannot be read is refused as
// `host_lease.missing`: Core stamped something, and a browser that cannot tell
// whose it is must not act on it. A command with no lease at all runs as it
// always has -- a saved Flow's playback and a candidate build issue no leases.
//
// The refusal is a failure that did nothing (`effect: "unacted"`), never
// retryable as sent: the same command under the same lease would be refused
// again, so the holder must be told rather than retried.

import type { ClientGatewayActionCommand, ClientGatewayActionResult } from "@fluxiq/client-gateway-websocket";
import type { CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES } from "fluxiq/client-gateway";

/** Core's `ClientGatewayHostLease`, read off the command it rides on. */
export type WebAutomationHostLease = NonNullable<ClientGatewayActionCommand["lease"]>;

/**
 * Core's refusal codes, restated because Core's constant lives beside its
 * gateway service, which the extension bundle must not pull in. `satisfies`
 * makes a changed or added code on Core's side a compile error here.
 */
export const WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES = Object.freeze({
  stale: "host_lease.stale",
  holderMismatch: "host_lease.holder_mismatch",
  missing: "host_lease.missing"
} as const) satisfies typeof CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES;

export type WebAutomationHostLeaseRefusalCode = (typeof WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES)[keyof typeof WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES];

/** What a command said about its lease: none, one the browser can read, or one it cannot. */
export type WebAutomationHostLeaseReading =
  | { kind: "none" }
  | { kind: "lease"; lease: WebAutomationHostLease }
  | { kind: "unreadable" };

/** How a readable lease stands against the highest the browser has seen for its resource. */
export type WebAutomationHostLeaseJudgement = "adopt" | "current" | "stale" | "holder_mismatch";

/** Reads the `lease` field of a command, copying only the fields the contract names. */
export function webAutomationHostLeaseReading(value: unknown): WebAutomationHostLeaseReading {
  if (value === undefined) return { kind: "none" };
  if (!isRecord(value)) return { kind: "unreadable" };
  const { resourceKey, epoch, holder } = value;
  if (!isText(resourceKey) || !Number.isSafeInteger(epoch) || (epoch as number) < 0 || !isRecord(holder)) return { kind: "unreadable" };
  if (!isText(holder.role) || !isText(holder.briefId)) return { kind: "unreadable" };
  return { kind: "lease", lease: { resourceKey, epoch: epoch as number, holder: { role: holder.role, briefId: holder.briefId } } };
}

/** The rule above. `seen` is the highest lease kept for the same resource key, or none. */
export function webAutomationHostLeaseJudgement(lease: WebAutomationHostLease, seen: WebAutomationHostLease | undefined): WebAutomationHostLeaseJudgement {
  if (seen === undefined || lease.epoch > seen.epoch) return "adopt";
  if (lease.epoch < seen.epoch) return "stale";
  return lease.holder.role === seen.holder.role && lease.holder.briefId === seen.holder.briefId ? "current" : "holder_mismatch";
}

/** The refusal code a judgement that refuses maps to; `undefined` for one that lets the command run. */
export function webAutomationHostLeaseRefusalCode(judgement: WebAutomationHostLeaseJudgement): WebAutomationHostLeaseRefusalCode | undefined {
  if (judgement === "stale") return WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES.stale;
  if (judgement === "holder_mismatch") return WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES.holderMismatch;
  return undefined;
}

/**
 * The `client.action_result` a refused command is answered with. It names the
 * resource and epochs, which are Core's own bookkeeping, and nothing about the
 * page.
 */
export function webAutomationHostLeaseRefusal(
  commandId: string,
  code: WebAutomationHostLeaseRefusalCode,
  at: number,
  seenEpoch?: number
): ClientGatewayActionResult {
  const message = REFUSAL_MESSAGES[code];
  const actual = seenEpoch === undefined ? message : `${message} The browser has seen epoch ${seenEpoch} for this resource.`;
  return {
    commandId,
    status: "failed",
    startedAt: at,
    completedAt: at,
    message,
    error: message,
    failure: {
      category: "blocked_by_capability_or_policy",
      code,
      retryable: false,
      stage: "dispatch",
      expected: "a command issued under the current host lease",
      actual,
      effect: "unacted"
    },
    payload: { commandId, status: "refused", code }
  };
}

const REFUSAL_MESSAGES: Readonly<Record<WebAutomationHostLeaseRefusalCode, string>> = Object.freeze({
  "host_lease.stale": "The command was issued under a host lease that has since been granted again, so the browser did not act on it.",
  "host_lease.holder_mismatch": "The command's host lease names another holder than the one the browser has for that grant, so the browser did not act on it.",
  "host_lease.missing": "The command's host lease could not be read, so the browser did not act on it."
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
