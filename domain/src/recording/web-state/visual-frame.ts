import type { StateSnapshot, StateVisualFrame } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "../state";
import { compactJsonObject } from "./compact-json-object";
import type { WebAutomationStateElement } from "./element";
import { positiveFinite, scaledScreenBounds, screenFrameBounds, stateBounds } from "./geometry";
import type { WebAutomationDomSnapshotInput, WebAutomationScreenImageSize } from "./types";

// The two pictures a web state snapshot carries, and why there are two.
//
// The `screen` frame is the viewport as captured: element rects in screenshot
// pixels, laid over the screenshot itself, so a highlight lands where the user
// would have seen the control. The `document` frame is the whole page in CSS
// pixels with the viewport drawn as a marker, so an element below the fold has
// somewhere to be. An element off-screen has no screen layer at all and only a
// document one; conflating the two spaces is how highlights end up scrolled by
// the scroll offset or scaled by the device pixel ratio.

export const MAX_VISUAL_FRAME_ELEMENTS = 1_000;
export const WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
export const WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
export const WEB_AUTOMATION_DOCUMENT_FRAME_ID = "document";

// Attach both frames to a state snapshot, with the screen frame as the default.
export function withScreenVisualFrame(
  state: StateSnapshot,
  snapshot: WebAutomationDomSnapshotInput,
  elements: readonly WebAutomationStateElement[],
  input: { screenContentRef?: string; projectId?: string; screenImageSize?: WebAutomationScreenImageSize } = {}
): StateSnapshot {
  const rendered = elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS);
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...(state.presentation ?? {}),
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenVisualFrame(snapshot, rendered, input), documentVisualFrame(snapshot, rendered)]
    }
  };
}

// A layer id safe to use as a DOM id and stable for the element it names.
export function safeLayerId(value: string, fallbackIndex: number): string {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}

function screenVisualFrame(
  snapshot: WebAutomationDomSnapshotInput,
  elements: readonly WebAutomationStateElement[],
  input: { screenContentRef?: string; projectId?: string; screenImageSize?: WebAutomationScreenImageSize }
): StateVisualFrame {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot.frame?.viewportOffset);
  const layers: StateVisualFrame["layers"] = [];

  if (input.screenContentRef) {
    layers.push({
      id: "screenshot",
      kind: "image",
      contentRef: input.screenContentRef,
      bounds: { x: 0, y: 0, width: screenWidth, height: screenHeight },
      metadata: compactJsonObject({
        projectId: input.projectId,
        url: snapshot.url,
        frameKind: "viewport-screenshot",
        boundsKind: "screenshot",
        viewportWidth: width,
        viewportHeight: height,
        imageWidth: screenWidth,
        imageHeight: screenHeight
      })
    });
  }

  for (const [index, { element, stateId }] of elements.entries()) {
    const bounds = scaledScreenBounds(screenFrameBounds(element.bounds, frameViewportOffset), screenScaleX, screenScaleY);
    if (!bounds) continue;
    layers.push({
      id: `element.${safeLayerId(stateId, index + 1)}`,
      kind: "region",
      label: elementLayerLabel(element),
      bounds,
      statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
      anchor: { type: "bounds", bounds },
      metadata: compactJsonObject({
        selector: element.selector,
        tagName: element.tagName,
        boundsKind: "screenshot",
        renderKind: "screenshot-bbox",
        isVisibleOnViewport: true
      })
    });
  }

  return {
    id: WEB_AUTOMATION_SCREEN_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Viewport Screenshot",
    coordinateSpace: { width: screenWidth, height: screenHeight, unit: "px", origin: "top-left" },
    layers,
    presentation: { label: snapshot.title || "Browser viewport", visualKind: "bounds", icon: "globe" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      devicePixelRatio: snapshot.viewport.devicePixelRatio,
      frameKind: "viewport-screenshot",
      screenCoordinateSpace: "viewport",
      documentWidth: snapshot.viewport.documentWidth,
      documentHeight: snapshot.viewport.documentHeight,
      viewportWidth: width,
      viewportHeight: height,
      imageWidth: screenWidth,
      imageHeight: screenHeight,
      imageScaleX: screenScaleX,
      imageScaleY: screenScaleY,
      frameViewportOffset: frameViewportOffset as JsonObject | undefined,
      isTopFrame: snapshot.frame?.isTop
    })
  };
}

function documentVisualFrame(
  snapshot: WebAutomationDomSnapshotInput,
  elements: readonly WebAutomationStateElement[]
): StateVisualFrame {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const rawDocumentWidth = positiveFinite(snapshot.viewport.documentWidth) ?? width;
  // The map is drawn at viewport width: a page wider than its viewport scrolls
  // horizontally, and stretching the map to the document width would shrink
  // every element in it. The measured width still rides in the metadata.
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot.viewport.documentHeight) ?? height;

  return {
    id: WEB_AUTOMATION_DOCUMENT_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Document Map",
    coordinateSpace: { width: documentMapWidth, height: documentHeight, unit: "px", origin: "top-left" },
    layers: [
      {
        id: "viewport",
        kind: "region",
        label: "Viewport",
        bounds: { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY, width, height },
        metadata: compactJsonObject({
          boundsKind: "document",
          renderKind: "viewport-marker"
        })
      },
      ...elements.flatMap(({ element, stateId }, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds
          ? stateBounds({
              x: bounds.x - snapshot.viewport.scrollX,
              y: bounds.y - snapshot.viewport.scrollY,
              width: bounds.width,
              height: bounds.height
            })
          : undefined;
        return [{
          id: `document.element.${safeLayerId(stateId, index + 1)}`,
          kind: "region" as const,
          label: elementLayerLabel(element),
          bounds,
          statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
          anchor: { type: "bounds" as const, bounds },
          metadata: compactJsonObject({
            selector: element.selector,
            tagName: element.tagName,
            boundsKind: "document",
            renderKind: "direct-rendered",
            isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
            projectedViewportBounds: projectedViewportBounds as JsonObject | undefined
          })
        }];
      })
    ],
    presentation: { label: "Document map", visualKind: "bounds", icon: "map" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      viewportWidth: width,
      viewportHeight: height,
      frameKind: "document-map",
      screenCoordinateSpace: "document-map",
      documentWidth: rawDocumentWidth,
      documentMapWidth,
      documentHeight
    })
  };
}

function elementLayerLabel(element: WebAutomationStateElement["element"]): string {
  return element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName;
}
