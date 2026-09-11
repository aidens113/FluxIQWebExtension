// Iframe element geometry translated into the top frame's coordinate spaces, so
// a merged tab snapshot can place every frame's elements on one page.

import type { RecordingEventPayload } from "../../shared/protocol";
import type { DomSnapshotPayload } from "./dom-snapshot";
import { compactObject, rectValue } from "./value-readers";

export function translateFrameElements(
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  frameId: number
): NonNullable<RecordingEventPayload["element"]>[] {
  const offset = rectValue(frameSnapshot.frame?.viewportOffset);
  if (!offset) return frameSnapshot.interactiveElements;
  return frameSnapshot.interactiveElements.map((element) => {
    const viewportBounds = translateFrameRectToTopViewport(element.bounds, element.documentBounds, frameSnapshot, offset);
    const documentBounds = viewportBounds
      ? {
          x: viewportBounds.x + topSnapshot.viewport.scrollX,
          y: viewportBounds.y + topSnapshot.viewport.scrollY,
          width: viewportBounds.width,
          height: viewportBounds.height
        }
      : translateFrameDocumentRectToTopDocument(element.documentBounds, frameSnapshot, topSnapshot, offset);
    return compactObject({
      ...element,
      selector: `frame[${frameId}] >> ${element.selector}`,
      bounds: viewportBounds,
      documentBounds,
      isVisibleOnViewport: viewportBounds !== undefined,
      attributes: compactObject({
        ...(element.attributes ?? {}),
        "data-fluxiq-frame-id": String(frameId),
        "data-fluxiq-frame-url": frameSnapshot.url
      })
    }) as NonNullable<RecordingEventPayload["element"]>;
  });
}

function translateFrameRectToTopViewport(
  bounds: NonNullable<RecordingEventPayload["element"]>["bounds"],
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload,
  offset: { x: number; y: number; width: number; height: number }
): NonNullable<RecordingEventPayload["element"]>["bounds"] {
  const rect = rectValue(bounds) ??
    translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!rect) return undefined;
  return {
    x: round2(offset.x + rect.x),
    y: round2(offset.y + rect.y),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}

function translateFrameDocumentRectToFrameViewport(
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload
): NonNullable<RecordingEventPayload["element"]>["bounds"] {
  const rect = rectValue(documentBounds);
  if (!rect) return undefined;
  return {
    x: round2(rect.x - frameSnapshot.viewport.scrollX),
    y: round2(rect.y - frameSnapshot.viewport.scrollY),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}

function translateFrameDocumentRectToTopDocument(
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  offset: { x: number; y: number; width: number; height: number }
): NonNullable<RecordingEventPayload["element"]>["documentBounds"] {
  const frameViewportRect = translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!frameViewportRect) return undefined;
  return {
    x: round2(topSnapshot.viewport.scrollX + offset.x + frameViewportRect.x),
    y: round2(topSnapshot.viewport.scrollY + offset.y + frameViewportRect.y),
    width: round2(frameViewportRect.width),
    height: round2(frameViewportRect.height)
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
