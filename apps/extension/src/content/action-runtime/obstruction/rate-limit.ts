// The obstruction a rate-limit refusal reports (CC8, interface I4): kind
// `rate_limit`, with `retryAfterMs` only when the page stated a time, and -- when
// the refusal came as a notice over the page -- that notice's id, name and ways
// out, so Core can close it and slow its pace in one handler. A refusal that
// came as a line beside the control (a busy page) has no layer, and reports the
// kind alone.

import type { WebAutomationObstruction } from "@fluxiq-web-extension/domain/client";
import { layerKind, layerObstruction, overlaysOverPage } from "../interference";

/** Core's bound on a stated wait, in milliseconds (interface I2). */
const RETRY_AFTER_MAX_MS = 600_000;

/** The rate-limit obstruction for a refusal that named `retryAfterMs`, or no wait when it is absent. Never throws. */
export function rateLimitObstruction(retryAfterMs?: number): WebAutomationObstruction {
  let layer: WebAutomationObstruction | undefined;
  try {
    const notice = overlaysOverPage().find((candidate) => layerKind(candidate) === "rate_limit");
    layer = notice === undefined ? undefined : layerObstruction(notice);
  } catch {
    /* best-effort: a notice that cannot be read leaves the kind and the wait */
  }
  const stated = retryAfterMs !== undefined && Number.isFinite(retryAfterMs) && retryAfterMs >= 1 ? Math.min(RETRY_AFTER_MAX_MS, Math.round(retryAfterMs)) : undefined;
  return {
    ...(layer?.id ? { id: layer.id } : {}),
    ...(layer?.name ? { name: layer.name } : {}),
    kind: "rate_limit",
    ...(stated === undefined ? {} : { retryAfterMs: stated }),
    dismiss: layer?.dismiss ?? []
  };
}
