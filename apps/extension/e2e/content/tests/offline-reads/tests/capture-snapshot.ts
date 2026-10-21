// The page captured as the background captures it for a traced command, and
// read back as the snapshot an offline read is given. The production capturer
// (`background/trace-capture/`, `TracePageCapturer`) asks the content script
// through `TRACE_PAGE_CAPTURE_MESSAGE`, here delivered by the harness as the
// tab would deliver it, hashes the document and each resource, and uploads
// every part; the upload here keeps the bytes instead of sending them to Core.
// The capture answers with the references the background sets on the traced
// command's gateway result (`trace`), the bytes it uploaded (`bytes`, by
// digest, as a trace store holds them), and the snapshot made from both,
// primary first, as a trace reads them back.

import type { WebPageSnapshot, WebPageSnapshotPart } from "@fluxiq-web-extension/domain/node";
import type { ClientGatewayTraceResultMetadata } from "fluxiq/client-gateway";
import { TracePageCapturer } from "../../../../../src/background/trace-capture/index.js";
import type { ContentHarness } from "../../../index.js";

export type PageCapture = Readonly<{ trace: ClientGatewayTraceResultMetadata; bytes: ReadonlyMap<string, Uint8Array>; snapshot: WebPageSnapshot }>;

/** Never sent anywhere: the capturer uploads only when paired, and the upload here is a local store. */
const PLACEHOLDER_CREDENTIALS = { coreApiUrl: "http://offline-reads.invalid", token: "offline-reads-placeholder" };
const TAB_ID = 1;

export async function captureSnapshot(harness: ContentHarness): Promise<PageCapture> {
  const uploaded = new Map<string, Uint8Array>();
  const capturer = new TracePageCapturer({
    credentials: () => PLACEHOLDER_CREDENTIALS,
    send: async (_tabId, message) => {
      const delivery = await harness.deliver(message);
      if (!delivery.responded) throw new Error("the content script did not answer the capture");
      return delivery.response;
    },
    upload: async (_credentials, sha256, bytes) => {
      uploaded.set(sha256, bytes);
    }
  });
  const trace = await capturer.capture(TAB_ID, "offline-reads");
  const parts: WebPageSnapshotPart[] = trace.artifacts.map((artifact) => {
    const bytes = uploaded.get(artifact.sha256);
    if (!bytes) throw new Error("the capturer named a part it did not upload");
    return { sha256: artifact.sha256, mediaType: artifact.mediaType, role: artifact.role, source: artifact.source ?? null, bytes };
  });
  const primary = parts.find((part) => part.role === "primary");
  if (!primary?.source) throw new Error(`the capture holds no document (unavailable: ${trace.unavailable})`);
  return { trace, bytes: uploaded, snapshot: { url: primary.source, primary, resources: parts.filter((part) => part !== primary), unavailable: trace.unavailable } };
}
