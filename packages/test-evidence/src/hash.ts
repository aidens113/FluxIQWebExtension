import { createHash, randomUUID } from "node:crypto";

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createCorrelationId(prefix = "corr"): string {
  return `${prefix}-${randomUUID()}`;
}
