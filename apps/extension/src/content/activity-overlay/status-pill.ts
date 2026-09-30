// The activity overlay's nodes, and every change to them.
//
// It is built once, when a status first has to be shown, and then updated in
// place: one host, one shadow root, one pill and the same few nodes inside
// it, whose text and attributes change and nothing else. Each mode has a
// fixed size, so a new sentence never moves or resizes the pill; a long one
// ends in an ellipsis. A detail that changes fades in softly, which is the
// only motion besides the pulsing mark.
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
// **Where it sits: bottom left.** The t185 overlay sat bottom-right, and in
// the Lab nobody ever saw it. The Lab emulates a 1280-pixel viewport, and the
// side panel, opened in the same window, covers the right 400 pixels of it
// without narrowing the page: the overlay was drawn, in the right tab, exactly
// under the panel (t191 probe screenshots, `docs/working/live-activity-chat-
// plan/reports/t191-shots/`). A person's own browser narrows the page instead,
// but the bottom-right corner is still where pages put what a person reaches
// for -- chat launchers (company-website has one), "back to top", cart bars,
// cookie-banner buttons -- and it sits beside the side panel. The bottom-left
// corner is the one pages leave emptiest and no panel covers; a pill of at most
// 300 by 54 pixels there hides the least. It takes no input wherever it is.

// The host goes on `document.documentElement` rather than `<body>`: a page that
// swaps its body -- a client-side navigation, `document.body = ...` -- would
// otherwise take the overlay with it. It is drawn on a dark surface of its
// own, so it reads the same on a white page and a black one; a hairline border
// and a soft shadow separate it from a dark page. No `innerHTML` anywhere: a
// page requiring Trusted Types makes it throw.

import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE } from "../picker-host";
import { inertElement } from "./inert-element";
import type { ActivityOverlayView } from "./overlay-view";
import { PhaseMark } from "./phase-mark";

/** A custom element name: no page rule is written against it, and it may host a shadow root. */
const HOST_TAG = "fluxiq-activity-overlay";

/** Above every page overlay: the maximum a 32-bit `z-index` holds. */
const OVERLAY_Z_INDEX = "2147483647";

/** How long a settled status stays up before it fades. A display timer only: the status itself only ever comes from the background. */
const SETTLED_FADE_DELAY_MS = 6_000;
const FADE_DURATION_MS = 400;
const DETAIL_FADE_MS = 220;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SURFACE_BACKGROUND = "rgba(22, 24, 31, 0.94)";
const SURFACE_BORDER = "1px solid rgba(255, 255, 255, 0.10)";
const TEXT = "#f3f4f6";
const MUTED = "#a3a9b6";

const MARK_SIZE = 12;
const MARK_GAP = 8;

/** Each mode's fixed box, so nothing the text does can move the pill. */
const MODE_BOX: Readonly<Record<ActivityOverlayView["mode"], Readonly<Record<string, string>>>> = Object.freeze({
  expanded: { width: "300px", height: "54px", padding: "9px 14px 9px 12px", "border-radius": "14px" },
  collapsed: { width: "196px", height: "32px", padding: "0 14px 0 11px", "border-radius": "999px" }
});

type Nodes = {
  readonly host: HTMLElement;
  readonly surface: HTMLElement;
  readonly mark: PhaseMark;
  readonly headline: HTMLElement;
  readonly step: HTMLElement;
  readonly detail: HTMLElement;
};

export class StatusPill {
  private nodes: Nodes | undefined;
  private shown: ActivityOverlayView | undefined;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;
  private fading: Animation | undefined;

  /** The host while the overlay is in the page, for tests and for nothing else. */
  host(): HTMLElement | undefined {
    return this.nodes?.host.isConnected ? this.nodes.host : undefined;
  }

  /** Shows `view`, or takes the overlay out of the page when it is null. */
  update(view: ActivityOverlayView | null): void {
    this.cancelFade();
    if (!view) {
      this.remove();
      return;
    }
    const nodes = this.ensureNodes();
    const before = this.shown;
    this.shown = view;
    if (before?.mode !== view.mode) applyMode(nodes, view.mode);
    nodes.mark.show(view.mark, view.accent);
    setText(nodes.headline, view.headline);
    setText(nodes.step, view.step);
    nodes.step.style.setProperty("display", view.step && view.mode === "expanded" ? "block" : "none", "important");
    if (setText(nodes.detail, view.detail) && before?.detail && view.mode === "expanded" && typeof nodes.detail.animate === "function") {
      nodes.detail.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: DETAIL_FADE_MS, easing: "ease-out" });
    }
    if (view.settled) this.fadeTimer = setTimeout(() => this.fadeOut(), SETTLED_FADE_DELAY_MS);
  }

  private ensureNodes(): Nodes {
    if (this.nodes?.host.isConnected) return this.nodes;
    // A host this instance did not make is a superseded content script's, left
    // behind when the extension reloaded. Two overlays would disagree.
    for (const stale of document.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`)) stale.remove();
    this.shown = undefined;
    this.nodes = buildNodes();
    document.documentElement.append(this.nodes.host);
    return this.nodes;
  }

  private fadeOut(): void {
    this.fadeTimer = undefined;
    const host = this.nodes?.host;
    if (!host || typeof host.animate !== "function") {
      this.remove();
      return;
    }
    this.fading = host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_DURATION_MS, easing: "ease-in", fill: "forwards" });
    this.fading.onfinish = () => {
      this.fading = undefined;
      this.remove();
    };
  }

  private cancelFade(): void {
    if (this.fadeTimer !== undefined) clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    if (this.fading) {
      this.fading.onfinish = null;
      this.fading.cancel();
      this.fading = undefined;
    }
  }

  private remove(): void {
    this.nodes?.host.remove();
    this.nodes = undefined;
    this.shown = undefined;
  }
}

function buildNodes(): Nodes {
  const host = inertElement(HOST_TAG, {
    all: "initial",
    display: "block",
    position: "fixed",
    left: "16px",
    bottom: "16px",
    right: "auto",
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
  const surface = inertElement("div", {
    display: "flex",
    "flex-direction": "column",
    "justify-content": "center",
    gap: "2px",
    "box-sizing": "border-box",
    "max-width": "100%",
    overflow: "hidden",
    background: SURFACE_BACKGROUND,
    border: SURFACE_BORDER,
    "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.26), 0 1px 4px rgba(0, 0, 0, 0.18)",
    color: TEXT,
    "text-align": "left",
    direction: "ltr",
    "-webkit-font-smoothing": "antialiased"
  });
  const top = inertElement("div", { display: "flex", "align-items": "center", gap: `${MARK_GAP}px`, "min-width": "0" });
  const mark = new PhaseMark(MARK_SIZE);
  const headline = inertElement("div", {
    flex: "1 1 auto",
    "min-width": "0",
    font: `600 13px/18px ${FONT_STACK}`,
    color: TEXT,
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis"
  });
  const step = inertElement("div", {
    flex: "0 0 auto",
    font: `500 11.5px/18px ${FONT_STACK}`,
    color: MUTED,
    "font-variant-numeric": "tabular-nums",
    "white-space": "nowrap"
  });
  top.append(mark.element, headline, step);
  const detail = inertElement("div", {
    "padding-left": `${MARK_SIZE + MARK_GAP}px`,
    font: `400 12px/16px ${FONT_STACK}`,
    color: MUTED,
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis"
  });
  surface.append(top, detail);
  root.append(surface);
  return { host, surface, mark, headline, step, detail };
}

function applyMode(nodes: Nodes, mode: ActivityOverlayView["mode"]): void {
  for (const [property, value] of Object.entries(MODE_BOX[mode])) nodes.surface.style.setProperty(property, value, "important");
  nodes.detail.style.setProperty("display", mode === "expanded" ? "block" : "none", "important");
}

/** Sets the text when it differs; answers whether it changed. */
function setText(node: HTMLElement, text: string): boolean {
  if (node.textContent === text) return false;
  node.textContent = text;
  return true;
}
