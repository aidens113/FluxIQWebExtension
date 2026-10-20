// The shapes the background half of a traced command's page capture passes
// between its own modules and to the channel that awaits it. The wire shapes
// -- the request on a command, the reference on its result -- are Core's
// (`ClientGatewayTraceRequest`, `ClientGatewayTraceResultMetadata`).

import type { ClientGatewayTraceArtifactRole, ClientGatewayTraceResultMetadata } from "fluxiq/client-gateway";
import type { CoreApiCredentials } from "../connection/index";

/** What the channel awaits for a traced command: the references to put on its result, never a failure. */
export type TraceCapture = {
  capture(tabId: number | undefined): Promise<ClientGatewayTraceResultMetadata>;
};

/** The time and concurrency a capture and its uploads are held to (`upload-bounds.ts`). */
export type TraceUploadBounds = {
  /** How long the top frame may take to answer the capture message. */
  captureTimeoutMs: number;
  /** How long one upload may take. */
  uploadTimeoutMs: number;
  /** How long every upload of one capture may take together; one not started by then is counted unavailable. */
  uploadDeadlineMs: number;
  /** How many uploads run at once. */
  uploadConcurrency: number;
};

/** Sends one message to one frame of a tab and resolves with its answer (`background/tabs.ts`). */
export type TraceMessageSender = (tabId: number, message: unknown, frameId?: number) => Promise<unknown>;

/** PUTs one artifact's bytes to Core's trace store under its digest; rejects on anything but success. */
export type TraceArtifactUploader = (
  credentials: CoreApiCredentials,
  sha256: string,
  bytes: Uint8Array<ArrayBuffer>,
  mediaType: string,
  timeoutMs: number
) => Promise<void>;

/** One part of a capture, hashed and ready to upload. */
export type HashedTraceArtifact = {
  sha256: string;
  mediaType: string;
  byteLength: number;
  role: ClientGatewayTraceArtifactRole;
  source: string;
  bytes: Uint8Array<ArrayBuffer>;
};
