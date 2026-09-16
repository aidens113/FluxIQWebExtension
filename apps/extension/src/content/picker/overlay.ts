// The picker's overlay: the box drawn over whatever the pointer is on, and the
// count of what picking it would read.
//
// Three properties make it safe to put extension UI inside someone's page:
//
// - **It never takes a pointer event.** The host is `pointer-events: none`, so
//   every press, move and click reaches the page element underneath and the
//   picker reads the real target rather than its own highlight. Swallowing the
//   press is `session.ts`'s job, on `window`, not this file's.
// - **It is not part of the page.** Everything visible lives in a shadow root,
//   so no page stylesheet reaches it and it adds no selector, class or id the
//   page could collide with. Only the host is in the page's own tree.
// - **It is not a page change.** The host carries `data-fluxiq-picker`, which
//   `picker-host.ts` tests for and the recorder skips, so putting the overlay
//   up mid-recording adds no `dom.mutation`.
//
// Styles are set through the CSSOM rather than an inline `style` attribute or a
// `<style>` element: a page with a `style-src` policy blocks both of those, and
// the overlay has to work on pages that have one. Nothing here uses `innerHTML`
// for the same reason in reverse -- a page requiring Trusted Types makes it
// throw.

import { PICKER_HOST_ATTRIBUTE } from "../picker-host";

/** Above every page overlay: the maximum a 32-bit `z-index` holds. */
const OVERLAY_Z_INDEX = "2147483647";

const HIGHLIGHT_COLOR = "#2f6df6";

type OverlayParts = {
  host: HTMLElement;
  box: HTMLElement;
  label: HTMLElement;
};

let parts: OverlayParts | undefined;

/** Puts the overlay in the page, or leaves the one already there. */
export function openPickerOverlay(): void {
  if (parts) return;
  const host = document.createElement("div");
  host.setAttribute(PICKER_HOST_ATTRIBUTE, "");
  style(host, {
    position: "fixed",
    inset: "0",
    // The page keeps every pointer event; see the header.
    pointerEvents: "none",
    zIndex: OVERLAY_Z_INDEX
  });
  const root = host.attachShadow({ mode: "open" });
  const box = document.createElement("div");
  style(box, {
    position: "fixed",
    display: "none",
    boxSizing: "border-box",
    border: `2px solid ${HIGHLIGHT_COLOR}`,
    borderRadius: "2px",
    background: "rgba(47, 109, 246, 0.12)",
    pointerEvents: "none"
  });
  const label = document.createElement("div");
  style(label, {
    position: "fixed",
    display: "none",
    padding: "2px 6px",
    borderRadius: "3px",
    background: HIGHLIGHT_COLOR,
    color: "#ffffff",
    font: "600 11px/1.4 system-ui, sans-serif",
    whiteSpace: "nowrap",
    pointerEvents: "none"
  });
  root.append(box, label);
  (document.body ?? document.documentElement).append(host);
  parts = { host, box, label };
}

/**
 * Draws the overlay over `target`, captioned `caption`, or hides it when there
 * is nothing under the pointer.
 *
 * The caption is the picker's own words -- "8 items", "1 value" -- and never
 * text read off the page, so what the overlay renders can be no leak of page
 * content (decision D3) even on a page that screenshots itself.
 */
export function pointPickerOverlay(target: Element | null, caption: string): void {
  if (!parts) return;
  if (!target) {
    parts.box.style.display = "none";
    parts.label.style.display = "none";
    return;
  }
  const rect = target.getBoundingClientRect();
  style(parts.box, {
    display: "block",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
  parts.label.textContent = caption;
  style(parts.label, {
    display: "block",
    left: `${rect.left}px`,
    // Above the box where there is room, and inside its top edge where there is not.
    top: rect.top >= 20 ? `${rect.top - 18}px` : `${rect.top + 2}px`
  });
}

/** Takes the overlay out of the page. Closing a closed overlay does nothing. */
export function closePickerOverlay(): void {
  parts?.host.remove();
  parts = undefined;
}

function style(element: HTMLElement, properties: Partial<Record<keyof CSSStyleDeclaration & string, string>>): void {
  for (const [property, value] of Object.entries(properties)) {
    element.style.setProperty(kebab(property), value);
  }
}

/** `pointerEvents` as CSS spells it; `setProperty` takes the CSS name, not the CSSOM one. */
function kebab(property: string): string {
  return property.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}
