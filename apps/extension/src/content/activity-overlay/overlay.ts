// The activity overlay: a small status card in the bottom-right corner of the
// page FluxIQ is automating, saying what FluxIQ is doing now.
//
// It is a display for the person watching and nothing else (decision D5):
//
// - **It never takes input.** The host and every node inside it are
//   `pointer-events: none` (`inert-element.ts`), so `elementFromPoint` passes
//   through it, a real click at its position lands on the page, and the
//   automation's own clicks are untouched. It holds nothing focusable, carries
//   `inert`, and is `aria-hidden` -- the panel carries the accessible version.
//   It is collapsed, expanded or hidden from the panel, never from the page.
// - **It is not part of the page.** Everything visible lives in a closed shadow
//   root, so no page stylesheet or script reaches it. The host is a custom
//   element no page rule names, and its own declarations are `!important`, so
//   even `* { all: unset !important }` leaves it standing.
// - **It is not a page change.** The host carries `data-fluxiq-activity`
//   (`../picker-host.ts`), which the recorder, the snapshot, the evidence
//   pass and the interference checks all skip.
//
// The host goes on `document.documentElement` rather than `<body>`: a page that
// swaps its body -- a client-side navigation, `document.body = ...` -- would
// otherwise take the overlay with it.
//
// It is drawn on a dark card of its own rather than on the page, so it reads
// the same on a white page and a black one; a hairline border and a soft shadow
// separate it from a dark page. No `innerHTML` anywhere: a page requiring
// Trusted Types makes it throw.

import type { ActivityContentMessage } from "../../shared/activity";
import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE } from "../picker-host";
import { inertElement } from "./inert-element";
import { activityOverlayView, type ActivityOverlayView } from "./overlay-view";
import { phaseMark } from "./phase-mark";

/** A custom element name: no page rule is written against it, and it may host a shadow root. */
const HOST_TAG = "fluxiq-activity-overlay";

/** Above every page overlay: the maximum a 32-bit `z-index` holds. */
const OVERLAY_Z_INDEX = "2147483647";

/** How long a final status stays up before it fades. A display timer only: the status itself only ever comes from an event. */
const FINAL_FADE_DELAY_MS = 6_000;
const FADE_DURATION_MS = 400;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CARD_BACKGROUND = "rgba(22, 24, 31, 0.94)";
const CARD_BORDER = "1px solid rgba(255, 255, 255, 0.10)";
const TEXT = "#f3f4f6";
const MUTED = "#a3a9b6";
const FAINT = "#7d8494";

type OverlayParts = { host: HTMLElement; root: ShadowRoot };

let parts: OverlayParts | undefined;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let fading: Animation | undefined;

/** Shows what `message` says, or takes the overlay out of the page when it says nothing is to be shown. */
export function showActivityOverlay(message: ActivityContentMessage): void {
  render(activityOverlayView(message.activity, message.overlay));
}

function render(view: ActivityOverlayView | null): void {
  cancelFade();
  if (!view) {
    removeOverlay();
    return;
  }
  const { root } = ensureHost();
  root.replaceChildren(view.mode === "collapsed" ? pill(view) : card(view));
  if (view.final) fadeTimer = setTimeout(fadeOut, FINAL_FADE_DELAY_MS);
}

function ensureHost(): OverlayParts {
  if (parts?.host.isConnected) return parts;
  // A host this instance did not make is a superseded content script's, left
  // behind when the extension reloaded. Two overlays would disagree.
  for (const stale of document.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`)) stale.remove();
  const host = inertElement(HOST_TAG, {
    all: "initial",
    display: "block",
    position: "fixed",
    right: "16px",
    bottom: "16px",
    left: "auto",
    top: "auto",
    "z-index": OVERLAY_Z_INDEX,
    "max-width": "calc(100vw - 32px)",
    margin: "0",
    padding: "0",
    border: "0",
    background: "transparent",
    visibility: "visible",
    opacity: "1",
    transform: "none"
  });
  host.setAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE, "");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("inert", "");
  const root = host.attachShadow({ mode: "closed" });
  document.documentElement.append(host);
  parts = { host, root };
  return parts;
}

function card(view: ActivityOverlayView): HTMLElement {
  const card = inertElement("div", {
    display: "block",
    position: "relative",
    "box-sizing": "border-box",
    width: "300px",
    "max-width": "100%",
    padding: "11px 14px 12px 17px",
    "border-radius": "12px",
    background: CARD_BACKGROUND,
    border: CARD_BORDER,
    "box-shadow": "0 10px 28px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.18)",
    color: TEXT,
    font: `400 13px/1.45 ${FONT_STACK}`,
    "text-align": "left",
    direction: "ltr",
    overflow: "hidden",
    "-webkit-font-smoothing": "antialiased"
  });
  const stripe = inertElement("div", {
    position: "absolute",
    left: "0",
    top: "0",
    bottom: "0",
    width: "3px",
    background: view.accent
  });
  const header = inertElement("div", { display: "flex", "align-items": "center", gap: "7px", "min-width": "0" });
  header.append(phaseMark(view.mark, view.accent, 14), inertElement("span", {
    font: `600 11px/1.2 ${FONT_STACK}`,
    "letter-spacing": "0.06em",
    "text-transform": "uppercase",
    color: view.accent,
    "white-space": "nowrap"
  }, view.phaseName));
  if (view.step) {
    header.append(inertElement("span", {
      font: `500 11px/1.2 ${FONT_STACK}`,
      color: MUTED,
      "font-variant-numeric": "tabular-nums",
      "white-space": "nowrap"
    }, `· ${view.step}`));
  }
  header.append(
    inertElement("span", { flex: "1 1 auto" }),
    inertElement("span", { font: `600 10.5px/1.2 ${FONT_STACK}`, color: FAINT, "letter-spacing": "0.02em", "white-space": "nowrap" }, "FluxIQ")
  );
  const label = inertElement("div", {
    "margin-top": "6px",
    font: `500 13px/1.45 ${FONT_STACK}`,
    color: TEXT,
    display: "-webkit-box",
    "-webkit-box-orient": "vertical",
    "-webkit-line-clamp": "2",
    overflow: "hidden",
    "overflow-wrap": "anywhere"
  }, view.label);
  card.append(stripe, header, label);
  if (view.detail) {
    card.append(inertElement("div", {
      "margin-top": "3px",
      font: `400 12px/1.4 ${FONT_STACK}`,
      color: MUTED,
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis"
    }, view.detail));
  }
  return card;
}

function pill(view: ActivityOverlayView): HTMLElement {
  const pill = inertElement("div", {
    display: "inline-flex",
    "align-items": "center",
    gap: "6px",
    "box-sizing": "border-box",
    padding: "5px 11px 5px 8px",
    "border-radius": "999px",
    background: CARD_BACKGROUND,
    border: CARD_BORDER,
    "box-shadow": "0 6px 18px rgba(0, 0, 0, 0.24), 0 1px 3px rgba(0, 0, 0, 0.18)",
    color: TEXT,
    font: `600 12px/1.2 ${FONT_STACK}`,
    "white-space": "nowrap",
    "-webkit-font-smoothing": "antialiased"
  });
  pill.append(phaseMark(view.mark, view.accent, 12), inertElement("span", { color: TEXT }, view.phaseName));
  if (view.stepShort) {
    pill.append(inertElement("span", { color: MUTED, "font-weight": "500", "font-variant-numeric": "tabular-nums" }, view.stepShort));
  }
  return pill;
}

function fadeOut(): void {
  fadeTimer = undefined;
  const host = parts?.host;
  if (!host || typeof host.animate !== "function") {
    removeOverlay();
    return;
  }
  fading = host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_DURATION_MS, easing: "ease-in", fill: "forwards" });
  fading.onfinish = () => {
    fading = undefined;
    removeOverlay();
  };
}

function cancelFade(): void {
  if (fadeTimer !== undefined) clearTimeout(fadeTimer);
  fadeTimer = undefined;
  if (fading) {
    fading.onfinish = null;
    fading.cancel();
    fading = undefined;
  }
}

function removeOverlay(): void {
  parts?.host.remove();
  parts = undefined;
}
