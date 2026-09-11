// The visual half of a state snapshot: a PNG of the tab's visible viewport,
// hashed, uploaded to Core, and referenced by the state it belongs to.

import type { ActivityEntry } from "../../shared/protocol";
import type { CoreApiCredentials } from "./core-api";
import { uploadStateAsset } from "./core-api";
import type { DomSnapshotPayload } from "./dom-snapshot";

export type ScreenImageSize = { width: number; height: number };

export type VisualStateSample = {
  snapshot?: DomSnapshotPayload;
  screenContentRef?: string;
  screenImageSize?: ScreenImageSize;
  capturedAt?: number;
};

export type StateAssetStoreDeps = {
  readonly credentials: () => CoreApiCredentials;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
};

export class StateAssetStore {
  constructor(private readonly deps: StateAssetStoreDeps) {}

  // Captures the viewport as it is now rather than reusing an earlier capture:
  // the delta between the event and the capture is logged so a stale pairing is
  // visible rather than silent.
  async captureFreshVisualSample(tabId: number, projectId: string, timestamp: number, eventKey?: string): Promise<VisualStateSample | undefined> {
    try {
      const capture = await captureVisibleViewportPngBytes(tabId);
      const sha256 = await sha256Hex(capture.bytes);
      const screenContentRef = await uploadStateAsset(this.deps.credentials(), projectId, sha256, capture.bytes, "image/png");
      const capturedAt = Date.now();
      console.info("FluxIQ fresh state screenshot stored", {
        tabId,
        projectId,
        sha256,
        coordinateSpace: capture.coordinateSpace,
        imageSize: capture.imageSize,
        eventKey,
        eventTimestampMs: timestamp,
        capturedAt,
        deltaMs: capturedAt - timestamp
      });
      this.deps.onActivity("snapshot", "Fresh viewport screenshot stored", `${sha256.slice(0, 12)} @ ${Math.max(0, capturedAt - timestamp)}ms after event`, "success");
      return { screenContentRef, screenImageSize: capture.imageSize, capturedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fresh screenshot capture failed.";
      console.warn("FluxIQ fresh state screenshot failed", {
        tabId,
        projectId,
        eventTimestampMs: timestamp,
        message
      });
      return undefined;
    }
  }
}

async function captureVisibleViewportPngBytes(tabId: number): Promise<{ bytes: ArrayBuffer; imageSize: ScreenImageSize; coordinateSpace: "viewport" }> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId === undefined) throw new Error("Tab window is unavailable for screenshot capture.");
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const bytes = await bytesFromDataUrl(dataUrl);
  return { bytes, imageSize: pngImageSize(bytes), coordinateSpace: "viewport" };
}

async function bytesFromDataUrl(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl);
  return await response.arrayBuffer();
}

function pngImageSize(bytes: ArrayBuffer): ScreenImageSize {
  const view = new DataView(bytes);
  const hasPngSignature = view.byteLength >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452;
  if (!hasPngSignature) throw new Error("Captured screenshot is not a PNG image.");
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) throw new Error("Captured screenshot has invalid PNG dimensions.");
  return { width, height };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
