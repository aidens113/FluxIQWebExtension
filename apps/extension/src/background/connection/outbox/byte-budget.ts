// How many bytes the offline queue may take in the browser's session storage,
// the byte budget Core's outbox drops the oldest entries against
// (`ClientGatewayOutbox`, reason `byte_budget`), so a run of large DOM
// snapshots queued while FluxIQ is unreachable can never fill the area and make
// a send throw.
//
// Chrome counts every key's length and its value's JSON against
// `chrome.storage.session.QUOTA_BYTES` (10 MB since Chrome 112, 1 MB before).
// Core measures each queued entry as the UTF-8 length of its JSON, so the queue
// is given four fifths of the quota; the rest holds the in-flight records, the
// ids received, the host leases and the queue's own lineage and loss record. A
// browser that names no quota (worker memory, or Firefox) gets the share of
// 10 MB, which still bounds what a worker holds.

const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024;
const QUEUE_SHARE = 0.8;

export function extensionOutboxByteBudget(quotaBytes: unknown = sessionQuotaBytes()): number {
  const quota = typeof quotaBytes === "number" && Number.isFinite(quotaBytes) && quotaBytes > 0 ? quotaBytes : DEFAULT_QUOTA_BYTES;
  return Math.floor(quota * QUEUE_SHARE);
}

function sessionQuotaBytes(): unknown {
  return (globalThis as { chrome?: { storage?: { session?: { QUOTA_BYTES?: unknown } } } }).chrome?.storage?.session?.QUOTA_BYTES;
}
