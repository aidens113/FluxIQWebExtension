// Where an element actually appears. `getBoundingClientRect` is wrong for two
// common cases -- an inline wrapper that collapses to nothing and a block whose
// own box is empty while its text is not -- so each lookup falls back to the
// bounds of the element's text ranges. Viewport bounds are clipped to the
// visible area; document bounds are not, so an off-screen element still has
// them.

import { isInteractableUiElement, meaningfulText } from "./element-traits";
import type { RectDescriptor } from "./types";

/** Clipped to the viewport; `undefined` when the element is not on screen. */
export function visualViewportBounds(element: Element): RectDescriptor | undefined {
  return visibleViewportBounds(element) ??
    (isInteractableUiElement(element) ? renderedTextViewportBounds(element) : directTextViewportBounds(element));
}

/** Page coordinates, whether or not the element is scrolled into view. */
export function visualDocumentBounds(element: Element): RectDescriptor | undefined {
  return documentBounds(element) ??
    (isInteractableUiElement(element) ? renderedTextBounds(element) : directTextBounds(element));
}

function visibleViewportBounds(element: Element): RectDescriptor | undefined {
  const rect = element.getBoundingClientRect();
  const fallbackBounds = !hasUsableRect(rect) ? directTextViewportBounds(element) : undefined;
  if (fallbackBounds) return fallbackBounds;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  const width = right - left;
  const height = bottom - top;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return undefined;
  return {
    x: Math.round(left * 100) / 100,
    y: Math.round(top * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function documentBounds(element: Element): RectDescriptor | undefined {
  const rect = element.getBoundingClientRect();
  if (!hasUsableRect(rect)) return undefined;
  const width = rect.width;
  const height = rect.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return undefined;
  return {
    x: Math.round((rect.left + window.scrollX) * 100) / 100,
    y: Math.round((rect.top + window.scrollY) * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function directTextBounds(element: Element): RectDescriptor | undefined {
  return textRangeBounds(element, "document", "direct");
}

function renderedTextBounds(element: Element): RectDescriptor | undefined {
  return textRangeBounds(element, "document", "descendant");
}

function directTextViewportBounds(element: Element): RectDescriptor | undefined {
  return textRangeBounds(element, "viewport", "direct");
}

function renderedTextViewportBounds(element: Element): RectDescriptor | undefined {
  return textRangeBounds(element, "viewport", "descendant");
}

function textRangeBounds(element: Element, coordinateSpace: "document" | "viewport", scope: "direct" | "descendant"): RectDescriptor | undefined {
  const textNodes = scope === "direct" ? directTextNodes(element) : descendantTextNodes(element);
  if (!textNodes.length) return undefined;
  const rects: DOMRect[] = [];
  for (const node of textNodes) {
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (hasUsableRect(rect)) rects.push(rect);
    }
    range.detach();
  }
  return mergedBounds(rects, coordinateSpace);
}

function directTextNodes(element: Element): Text[] {
  return [...element.childNodes].filter((node): node is Text =>
    node.nodeType === Node.TEXT_NODE &&
    meaningfulText(node.textContent)
  );
}

function descendantTextNodes(element: Element): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => meaningfulText(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function mergedBounds(rects: DOMRect[], coordinateSpace: "document" | "viewport"): RectDescriptor | undefined {
  if (!rects.length) return undefined;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    const rectLeft = coordinateSpace === "viewport" ? Math.max(0, rect.left) : rect.left + window.scrollX;
    const rectTop = coordinateSpace === "viewport" ? Math.max(0, rect.top) : rect.top + window.scrollY;
    const rectRight = coordinateSpace === "viewport" ? Math.min(viewportWidth, rect.right) : rect.right + window.scrollX;
    const rectBottom = coordinateSpace === "viewport" ? Math.min(viewportHeight, rect.bottom) : rect.bottom + window.scrollY;
    if (rectRight - rectLeft < 2 || rectBottom - rectTop < 2) continue;
    left = Math.min(left, rectLeft);
    top = Math.min(top, rectTop);
    right = Math.max(right, rectRight);
    bottom = Math.max(bottom, rectBottom);
  }
  const width = right - left;
  const height = bottom - top;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return undefined;
  return {
    x: Math.round(left * 100) / 100,
    y: Math.round(top * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function hasUsableRect(rect: DOMRect | DOMRectReadOnly): boolean {
  return Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width >= 2 && rect.height >= 2;
}
