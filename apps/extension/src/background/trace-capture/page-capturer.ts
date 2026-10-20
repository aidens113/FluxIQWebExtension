// The page capture for one traced command, uploaded to Core's trace store and
// answered as the references its result carries (traces and offline trials,
// P2, decisions D12-D14).
//
// It asks the command's tab's top frame for the capture, hashes the document
// and each resource, PUTs every digest this worker has not already stored at
// this Core for the command's trace scope (`stored-digests.ts`;
// `connection/core-api.ts`, `uploadTraceArtifact`), and answers
// `ClientGatewayTraceResultMetadata`: the artifacts now stored, and how many
// the page or the upload could not provide. Nothing goes through the socket
// or its offline queue -- the bytes travel by HTTP, and only the small
// reference rides on the result.
//
// It never fails the command. A capture that fails answers no artifacts and
// counts itself unavailable; an upload that fails or runs out of time is
// left out of the artifacts and counted. Each wait is bounded
// (`upload-bounds.ts`), and so is what it remembers (`remembered-scopes.ts`).

import type { ClientGatewayTraceArtifactReference, ClientGatewayTraceResultMetadata } from "fluxiq/client-gateway";
import { uploadTraceArtifact, type CoreApiCredentials } from "../connection/core-api";
import { sendToTab } from "../tabs";
import { hashCaptureParts } from "./hash-capture-parts";
import { TRACE_REMEMBERED_SCOPES } from "./remembered-scopes";
import { requestPageCapture } from "./request-page-capture";
import { StoredDigests } from "./stored-digests";
import { TRACE_UPLOAD_BOUNDS } from "./upload-bounds";
import type { HashedTraceArtifact, TraceArtifactUploader, TraceCapture, TraceMessageSender, TraceUploadBounds } from "./types";

export type TracePageCapturerDeps = {
  /** Core's address and the pairing token, read at each capture so a re-pairing is used at once. */
  readonly credentials: () => CoreApiCredentials;
  readonly send?: TraceMessageSender;
  readonly upload?: TraceArtifactUploader;
  readonly bounds?: TraceUploadBounds;
  /** How many Core-and-scope upload records are kept (`remembered-scopes.ts`). */
  readonly rememberedScopes?: number;
};

export class TracePageCapturer implements TraceCapture {
  private readonly stored: StoredDigests;

  constructor(private readonly deps: TracePageCapturerDeps) {
    this.stored = new StoredDigests(deps.rememberedScopes ?? TRACE_REMEMBERED_SCOPES);
  }

  async capture(tabId: number | undefined, scope?: string): Promise<ClientGatewayTraceResultMetadata> {
    const bounds = this.deps.bounds ?? TRACE_UPLOAD_BOUNDS;
    if (tabId === undefined) return { artifacts: [], unavailable: 1 };
    const reply = await requestPageCapture(this.deps.send ?? sendToTab, tabId, bounds.captureTimeoutMs);
    if (!reply.ok) {
      console.warn("FluxIQ trace page capture unavailable", { reason: reply.reason });
      return { artifacts: [], unavailable: 1 };
    }
    const { parts, unreadable } = await hashCaptureParts(reply);
    const credentials = this.deps.credentials();
    const stored = this.stored.record(credentials.coreApiUrl, scope);
    await this.uploadMissing(parts, stored, credentials, bounds);
    const artifacts = parts.filter((part) => stored.has(part.sha256)).map(reference);
    return { artifacts, unavailable: reply.unavailable + unreadable + (parts.length - artifacts.length) };
  }

  /** Uploads each digest not yet in `stored` (this Core and scope), a few at a time, until the deadline; a failure is left unstored. */
  private async uploadMissing(parts: readonly HashedTraceArtifact[], stored: Set<string>, credentials: CoreApiCredentials, bounds: TraceUploadBounds): Promise<void> {
    const pending = new Map<string, HashedTraceArtifact>();
    for (const part of parts) {
      if (!stored.has(part.sha256) && !pending.has(part.sha256)) pending.set(part.sha256, part);
    }
    if (pending.size === 0) return;
    if (!credentials.token) {
      console.warn("FluxIQ trace artifacts not uploaded", { reason: "not paired", count: pending.size });
      return;
    }
    const upload = this.deps.upload ?? uploadTraceArtifact;
    const queue = [...pending.values()];
    const deadline = Date.now() + bounds.uploadDeadlineMs;
    const work = async (): Promise<void> => {
      for (let part = queue.shift(); part !== undefined; part = queue.shift()) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) continue;
        try {
          await upload(credentials, part.sha256, part.bytes, part.mediaType, Math.min(bounds.uploadTimeoutMs, remainingMs));
          stored.add(part.sha256);
        } catch (error) {
          console.warn("FluxIQ trace artifact upload failed", { sha256: part.sha256, error: error instanceof Error ? error.name : typeof error });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(bounds.uploadConcurrency, queue.length)) }, work));
  }
}

function reference(part: HashedTraceArtifact): ClientGatewayTraceArtifactReference {
  return { sha256: part.sha256, mediaType: part.mediaType, byteLength: part.byteLength, role: part.role, source: part.source };
}
