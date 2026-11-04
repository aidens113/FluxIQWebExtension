// Receipts for a recorded act, computed from the trace alone, in the sense of Core's
// exploration reducer (`changed_nothing`, `undone`). The saved builds kept no digest for
// the reducer to read, so this makes one from what the look before and after an act
// showed: the page's address and each control's selector, visible text, value and
// checked state. Equality only, so a page that merely reflowed still counts as a change.
//
// This errs toward no receipt. A saved run with a live feed gets none, and then the
// verdict says `recording.acts_covered` is violated: a false failure, never a false
// pass. `undone` is only an act answered by a later act, never a move: a page you
// navigated away from and back to still holds what you did to it.

import { createHash } from "node:crypto";
import type { ClientGatewayTraceRecordedPayload, ClientGatewayTraceStateDomain, ClientGatewayTraceStateReceipt, ClientGatewayTraceStateRecordedCall } from "fluxiq/client-gateway";

export function traceStateReceipts(calls: readonly ClientGatewayTraceStateRecordedCall[], domain: ClientGatewayTraceStateDomain): ReadonlyMap<number, ClientGatewayTraceStateReceipt> {
  const receipts = new Map<number, ClientGatewayTraceStateReceipt>();
  const looks = calls.map((call) => (domain.labelCall(call.operation) === "read" ? lookDigest(call.answer) : null));
  const acts = calls.flatMap((call, index) => (domain.labelCall(call.operation) === "act" && domain.readAnswer(call.answer).outcome === "succeeded" ? [index] : []));
  for (const [position, index] of acts.entries()) {
    const before = lookBefore(looks, index);
    const after = lookAfter(looks, index);
    if (before === null || after === null) continue;
    if (before === after) {
      receipts.set(index, "changed_nothing");
      continue;
    }
    const next = acts[position + 1];
    if (next === undefined || receipts.has(index)) continue;
    if (lookAfter(looks, next) === before) {
      receipts.set(index, "undone");
      receipts.set(next, "undone");
    }
  }
  return receipts;
}

function lookBefore(looks: readonly (string | null)[], index: number): string | null {
  for (let at = index - 1; at >= 0; at -= 1) {
    if (looks[at] !== null) return looks[at]!;
  }
  return null;
}

function lookAfter(looks: readonly (string | null)[], index: number): string | null {
  for (let at = index + 1; at < looks.length; at += 1) {
    if (looks[at] !== null) return looks[at]!;
  }
  return null;
}

/** A digest of what a look showed; null when the answer holds no page view. */
function lookDigest(answer: ClientGatewayTraceRecordedPayload | null): string | null {
  const payload = recordOf(answer?.payload);
  const snapshot = recordOf(payload?.snapshot);
  if (snapshot === undefined || !Array.isArray(snapshot.interactiveElements)) return null;
  const controls = snapshot.interactiveElements.map((element: unknown) => {
    const control = recordOf(element);
    return [control?.selector, control?.visibleText, control?.value, control?.checked, control?.selectedValue];
  });
  const hash = createHash("sha256");
  hash.update(JSON.stringify([snapshot.url, controls.map((control) => JSON.stringify(control)).sort()]));
  return hash.digest("hex");
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
