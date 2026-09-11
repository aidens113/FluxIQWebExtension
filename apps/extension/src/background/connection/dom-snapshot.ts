// The DOM snapshot payload the content script produces, and how the background
// worker collects one per frame and merges them into a single tab snapshot.

import { createWebAutomationStateFromSnapshot } from "@fluxiq-web-extension/domain/client";
import type { RecordingEventPayload } from "../../shared/protocol";
import { objectValue } from "./value-readers";
import { translateFrameElements } from "./frame-geometry";

export type DomSnapshotPayload = Parameters<typeof createWebAutomationStateFromSnapshot>[0];

// A frame that never answers must not hold up an event: every per-frame call
// falls back instead of waiting.
const FRAME_SNAPSHOT_TIMEOUT_MS = 150;

// The tab-messaging calls this module needs, supplied by the caller so the
// module stays free of the background worker's chrome wiring.
export type TabSnapshotTransport = {
  readonly sendToTab: <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;
  readonly allTabFrames: (tabId: number) => Promise<chrome.webNavigation.GetAllFrameResultDetails[]>;
};

export function isDomSnapshotPayload(value: unknown): value is {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  frame?: { isTop: boolean; viewportOffset?: { x: number; y: number; width: number; height: number } };
  focusedElement?: RecordingEventPayload["element"];
  selectedText?: string;
  interactiveElements: NonNullable<RecordingEventPayload["element"]>[];
} {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as {
    url?: unknown;
    title?: unknown;
    viewport?: { width?: unknown; height?: unknown; scrollX?: unknown; scrollY?: unknown };
    interactiveElements?: unknown;
  };
  return typeof snapshot.url === "string" &&
    typeof snapshot.title === "string" &&
    Boolean(snapshot.viewport) &&
    typeof snapshot.viewport?.width === "number" &&
    typeof snapshot.viewport.height === "number" &&
    typeof snapshot.viewport.scrollX === "number" &&
    typeof snapshot.viewport.scrollY === "number" &&
    Array.isArray(snapshot.interactiveElements);
}

export function hasSnapshotFrameViewportOffset(snapshot: DomSnapshotPayload): boolean {
  const frame = objectValue((snapshot as { frame?: unknown }).frame);
  const viewportOffset = objectValue(frame?.viewportOffset);
  return typeof viewportOffset?.x === "number" &&
    typeof viewportOffset.y === "number" &&
    typeof viewportOffset.width === "number" &&
    typeof viewportOffset.height === "number";
}

export async function captureSingleFrameSnapshot(
  transport: TabSnapshotTransport,
  tabId: number,
  frameId: number
): Promise<DomSnapshotPayload | undefined> {
  const snapshot = await withTimeout(transport.sendToTab(tabId, { type: "captureSnapshot" }, frameId), FRAME_SNAPSHOT_TIMEOUT_MS, undefined);
  return isDomSnapshotPayload(snapshot) ? snapshot : undefined;
}

export async function captureMergedTabSnapshot(
  transport: TabSnapshotTransport,
  tabId: number,
  seedSnapshot?: DomSnapshotPayload,
  seedFrameId?: number
): Promise<DomSnapshotPayload | undefined> {
  const topFallback = await captureSingleFrameSnapshot(transport, tabId, 0);
  const fallback = topFallback ?? seedSnapshot;
  const frames = await withTimeout(transport.allTabFrames(tabId), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  const frameSnapshots: Array<{ frameId: number; snapshot: DomSnapshotPayload }> = [];
  if (seedSnapshot && seedFrameId !== undefined) frameSnapshots.push({ frameId: seedFrameId, snapshot: seedSnapshot });
  await withTimeout(Promise.allSettled(frames.map(async (frame) => {
    if (seedFrameId !== undefined && frame.frameId === seedFrameId && seedSnapshot) return;
    const snapshot = await captureSingleFrameSnapshot(transport, tabId, frame.frameId);
    if (snapshot) frameSnapshots.push({ frameId: frame.frameId, snapshot });
  })), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  if (!frameSnapshots.length) return fallback;
  const topSnapshot = frameSnapshots.find((entry) => entry.frameId === 0 || entry.snapshot.frame?.isTop)?.snapshot ?? topFallback;
  if (!topSnapshot) return undefined;
  const mergedElements: NonNullable<RecordingEventPayload["element"]>[] = [];
  for (const entry of frameSnapshots) {
    const elements = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop
      ? entry.snapshot.interactiveElements
      : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
    mergedElements.push(...elements);
  }
  return {
    ...topSnapshot,
    interactiveElements: mergedElements
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
