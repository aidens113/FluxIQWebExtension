import { recordedRequestDigest } from "../request-digest.js";
import { recordedCaptureAttachment } from "./attachment.js";

/** What the stopped boundary proved about the starting store, before any entry. */
export type RecordedStartFacts = Readonly<{ projectId: string; flowId: string; taskId: string; oracleDigest: string; storeDigest: string; capturedAt: string }>;

/**
 * The receipt binding one stopped starting store to one exact build entry.
 * `capturedAt` stays the time the closed store was copied, which is what
 * `before_entry` claims; the entry may be bound later, at the service boundary
 * where it is actually known (`./service-entry.ts`).
 */
export function recordedStartReceipt(facts: RecordedStartFacts, entry: unknown) {
  const entryDigest = recordedRequestDigest(JSON.stringify(entry));
  const receipt = { version: 1, position: "before_entry", snapshotMethod: "closed-store-copy", excludedTopLevel: ["security"], projectId: facts.projectId, flowId: facts.flowId, taskId: facts.taskId, oracleDigest: facts.oracleDigest, entryDigest, storeDigest: facts.storeDigest, capturedAt: facts.capturedAt };
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  return { entryDigest, receipt, receiptBytes, attach: recordedCaptureAttachment(receipt, receiptBytes) };
}
