// Where this frame sits inside the top-level viewport. A child frame cannot
// read its own offset, so it asks its parent over `postMessage` and caches the
// answer; the parent answers for whichever child sent the request. The offset
// is what turns a child frame's element bounds into coordinates the panel and
// the action runtime can use.

import { FRAME_GEOMETRY_REQUEST, FRAME_GEOMETRY_RESPONSE } from "./messages";
import type { RectDescriptor } from "./types";

let frameViewportOffset: RectDescriptor | undefined = isTopFrame()
  ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
  : undefined;
let frameGeometryRequestId = 0;

export function isTopFrame(): boolean {
  return window.top === window;
}

export function currentFrameViewportOffset(): RectDescriptor | undefined {
  if (isTopFrame()) return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  return frameViewportOffset;
}

/** Answers geometry requests from child frames and refreshes our own on resize and scroll. */
export function installFrameGeometryBridge(): void {
  window.addEventListener("message", (event) => {
    const data = event.data as { type?: string; requestId?: unknown; geometry?: unknown } | undefined;
    if (!data || typeof data !== "object") return;
    if (data.type === FRAME_GEOMETRY_REQUEST) {
      const requestId = typeof data.requestId === "number" ? data.requestId : undefined;
      const geometry = childFrameViewportOffset(event.source);
      if (!geometry || !event.source || typeof event.source.postMessage !== "function") return;
      (event.source.postMessage as (message: unknown, targetOrigin: string) => void)({
        type: FRAME_GEOMETRY_RESPONSE,
        requestId,
        geometry
      }, "*");
      return;
    }
    if (data.type === FRAME_GEOMETRY_RESPONSE) {
      const geometry = rectFromUnknown(data.geometry);
      if (geometry) frameViewportOffset = geometry;
    }
  });
  window.addEventListener("resize", () => {
    if (isTopFrame()) frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    else void requestFrameGeometry();
  }, true);
  window.addEventListener("scroll", () => {
    if (!isTopFrame()) void requestFrameGeometry();
  }, true);
}

export function requestFrameGeometry(): Promise<RectDescriptor | undefined> {
  if (isTopFrame()) {
    frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return Promise.resolve(frameViewportOffset);
  }
  const requestId = ++frameGeometryRequestId;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(frameViewportOffset), 75);
    const listener = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: unknown; geometry?: unknown } | undefined;
      if (!data || data.type !== FRAME_GEOMETRY_RESPONSE || data.requestId !== requestId) return;
      const geometry = rectFromUnknown(data.geometry);
      if (geometry) frameViewportOffset = geometry;
      clearTimeout(timeout);
      window.removeEventListener("message", listener);
      resolve(frameViewportOffset);
    };
    window.addEventListener("message", listener);
    window.parent.postMessage({ type: FRAME_GEOMETRY_REQUEST, requestId }, "*");
  });
}

function childFrameViewportOffset(source: MessageEventSource | null): RectDescriptor | undefined {
  if (!source) return undefined;
  const frameElement = [...document.querySelectorAll("iframe,frame")]
    .find((element): element is HTMLIFrameElement | HTMLFrameElement =>
      (element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement) &&
      element.contentWindow === source
    );
  if (!frameElement) return undefined;
  const rect = frameElement.getBoundingClientRect();
  const parentOffset = currentFrameViewportOffset() ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  return {
    x: Math.round((parentOffset.x + rect.left) * 100) / 100,
    y: Math.round((parentOffset.y + rect.top) * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100
  };
}

function rectFromUnknown(value: unknown): RectDescriptor | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rect = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  return typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    typeof rect.width === "number" &&
    typeof rect.height === "number"
    ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    : undefined;
}
