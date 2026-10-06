// The activity overlay's nodes, and every change to them.
//
// It is built once, when a status first has to be shown, and then updated in
// place: one host, one shadow root, one pill and the same few nodes inside
// it, whose text and attributes change and nothing else. Each shape has a
// fixed size, so a new sentence never moves or resizes the pill; a long one
// is cut where a word ends and ends in an ellipsis (`fit-line.ts`: the
// browser's own ellipsis cut "Search Bri…", U-4 of the run-muw60j7c-bb7c9a62
// UI review), measured again whenever the pill changes width. A detail that
// changes fades in softly, which is the only motion besides the pulsing mark. The pill itself has no entry
// animation: a page that loads while FluxIQ works (a navigation, U7 of the
// t174 live lane's UI review) gets the overlay back at full strength the
// moment the background re-sends the status, so it reads as never having left.
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
// - **It covers as little as it can, and always says what FluxIQ is doing.**
//   It sits in a corner where no fixed part of the page is -- no cookie
//   banner, chat widget, sticky bar or dialog -- and when every corner has one
//   it takes the least-busy place on the viewport's edge or docked just past
//   a fixed bar, clear of text and images where it can be, narrower if that
//   covers less, its lines kept and ending in an ellipsis when they do not
//   fit (`placement/`). It is never a text-less dot: the person reads the
//   status on the page whenever FluxIQ works, side panel open or not (U3 of
//   lane D's run-murdouox-c5294247 UI review). Sitting over a control changes
//   nothing an action or the page view sees (the first and third points
//   above; `tests/cover-detection.test.ts`). It moves as the page changes, at
//   most once per check interval, and stays put while its place is the best.
//
// **Legibility** (the supervisor's review #8): a 14-pixel headline and a
// 13-pixel detail, near-white on a near-black card of its own, so it reads the
// same on a white page and a black one -- a light hairline inside separates it
// from a dark page, a dark ring outside from a light one. No text is dimmer
// than 12:1 against the card.
//
// The host goes on `document.documentElement` rather than `<body>`: a page that
// swaps its body -- a client-side navigation, `document.body = ...` -- would
// otherwise take the overlay with it. No `innerHTML` anywhere: a page
// requiring Trusted Types makes it throw.

import { ACTIVITY_DONE_VISIBLE_MS } from "../../shared/activity";
import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE } from "../picker-host";
import { fitLine } from "./fit-line";
import { inertElement } from "./inert-element";
import type { ActivityOverlayView } from "./overlay-view";
import { PhaseMark } from "./phase-mark";
import { anchorStyle, PlacementKeeper, type OverlayPlacement } from "./placement";
import { browserTextMeasure, type OverlayTextMeasure } from "./text-measure";

type Mode = ActivityOverlayView["mode"];
type Width = OverlayPlacement["shape"];

/** A custom element name: no page rule is written against it, and it may host a shadow root. */
const HOST_TAG = "fluxiq-activity-overlay";

/** Above every page overlay: the maximum a 32-bit `z-index` holds. */
const OVERLAY_Z_INDEX = "2147483647";

const FADE_DURATION_MS = 400;
const DETAIL_FADE_MS = 220;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
/** The headline's and the detail's fonts as a canvas measures them: the lines' own, less their line height. */
const HEADLINE_FONT = `600 14px ${FONT_STACK}`;
const DETAIL_FONT = `400 13px ${FONT_STACK}`;
/** The headline's letter spacing (0.005em of 14 pixels), added to each character its canvas measure leaves out. */
const HEADLINE_SPACING_PX = 0.07;
const SURFACE_BACKGROUND = "rgba(17, 19, 26, 0.96)";
const SURFACE_BORDER = "1px solid rgba(255, 255, 255, 0.16)";
const SURFACE_SHADOW = "0 0 0 1px rgba(0, 0, 0, 0.32), 0 10px 28px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.18)";
const TEXT = "#ffffff";
const SECONDARY = "#d8dde6";

const MARK_SIZE = 14;
const MARK_GAP = 10;
const EDGE_MARGIN = 16;

/**
 * Each mode's fixed box, full and narrow, so nothing the text does can move or
 * resize the pill. The narrow box is for a page with no clear corner: the
 * expanded card's still holds "Building your Flow" beside "Step 2 of 5" and
 * about thirty characters of the detail line; the collapsed pill's, the
 * headline.
 */
const SHAPE_SIZE: Readonly<Record<Mode, Readonly<Record<Width, { readonly width: number; readonly height: number }>>>> = Object.freeze({
  expanded: { pill: { width: 384, height: 66 }, narrow: { width: 288, height: 66 } },
  collapsed: { pill: { width: 300, height: 36 }, narrow: { width: 224, height: 36 } }
});

/** Each mode's padding and corners. */
const SHAPE_BOX: Readonly<Record<Mode, Readonly<Record<string, string>>>> = Object.freeze({
  expanded: { padding: "11px 16px 11px 14px", "border-radius": "14px" },
  collapsed: { padding: "0 16px 0 13px", "border-radius": "999px" }
});

type Nodes = {
  readonly host: HTMLElement;
  readonly surface: HTMLElement;
  readonly top: HTMLElement;
  readonly mark: PhaseMark;
  readonly headline: HTMLElement;
  readonly step: HTMLElement;
  readonly detail: HTMLElement;
};

export class StatusPill {
  private nodes: Nodes | undefined;
  private shown: ActivityOverlayView | undefined;
  private drawnShape: string | undefined;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;
  private fading: Animation | undefined;
  private readonly keeper = new PlacementKeeper({
    sizes: () => ({ box: SHAPE_SIZE[this.mode()].pill, narrow: SHAPE_SIZE[this.mode()].narrow, margin: EDGE_MARGIN }),
    place: (placement) => this.place(placement)
  });

  /** `measure` is the page's own unless a test passes another. */
  constructor(private readonly measure: OverlayTextMeasure = browserTextMeasure) {}

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
    const before = this.shown;
    this.shown = view;
    const nodes = this.ensureNodes();
    if (before && before.mode !== view.mode) {
      this.keeper.recheck();
      // A side midpoint is centred by the box's height, which the mode sets,
      // and the keeper only moves the host when the place itself changed.
      this.place(this.keeper.placement());
    }
    this.drawShape(nodes);
    nodes.mark.show(view.mark, view.accent);
    setText(nodes.step, view.step);
    this.showTexts(nodes);
    const lines = this.fittedLines(nodes, view);
    setText(nodes.headline, lines.headline);
    if (setText(nodes.detail, lines.detail) && before?.detail && view.mode === "expanded" && typeof nodes.detail.animate === "function") {
      nodes.detail.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: DETAIL_FADE_MS, easing: "ease-out" });
    }
    if (view.fades) this.fadeTimer = setTimeout(() => this.fadeOut(), ACTIVITY_DONE_VISIBLE_MS);
  }

  private ensureNodes(): Nodes {
    if (this.nodes?.host.isConnected) return this.nodes;
    // A host this instance did not make is a superseded content script's, left
    // behind when the extension reloaded. Two overlays would disagree.
    for (const stale of document.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`)) stale.remove();
    this.keeper.stop();
    this.drawnShape = undefined;
    this.nodes = buildNodes();
    document.documentElement.append(this.nodes.host);
    // Placed before the first paint: the check runs in this same task.
    this.keeper.start();
    return this.nodes;
  }

  /** The keeper moved the overlay: pin the host there and redraw its box. */
  private place(placement: OverlayPlacement): void {
    const nodes = this.nodes;
    if (!nodes) return;
    const size = SHAPE_SIZE[this.mode()][placement.shape];
    for (const [property, value] of Object.entries(anchorStyle(placement.anchor, EDGE_MARGIN, size.height, placement.offset))) nodes.host.style.setProperty(property, value, "important");
    if (!this.shown) return;
    this.drawShape(nodes);
    // A narrower or wider card fits its lines again.
    const lines = this.fittedLines(nodes, this.shown);
    setText(nodes.headline, lines.headline);
    setText(nodes.detail, lines.detail);
  }

  /**
   * The headline and the detail as the card can show them: each cut where a
   * word ends when it is wider than its line (`fitLine`). The headline's line
   * is the top row less the mark and the step beside it; the detail's, its own
   * box less the indent under the mark. Neither box depends on the text in it.
   */
  private fittedLines(nodes: Nodes, view: ActivityOverlayView): { headline: string; detail: string } {
    const measure = this.measure;
    const stepRoom = view.mode === "expanded" && view.step ? measure.widthOf(nodes.step) + MARK_GAP : 0;
    const headlineRoom = measure.widthOf(nodes.top) - MARK_SIZE - MARK_GAP - stepRoom;
    const headline = fitLine(view.headline, headlineRoom, (text) => withSpacing(measure.measure(text, HEADLINE_FONT), text));
    if (view.mode !== "expanded" || !view.detail) return { headline, detail: view.detail };
    const detail = fitLine(view.detail, measure.widthOf(nodes.detail) - MARK_SIZE - MARK_GAP, (text) => measure.measure(text, DETAIL_FONT));
    return { headline, detail };
  }

  private mode(): Mode {
    return this.shown?.mode ?? "expanded";
  }

  /** Sizes the pill for its mode and the width its place leaves; the lines inside are the same at either width. */
  private drawShape(nodes: Nodes): void {
    const mode = this.mode();
    const width = this.keeper.placement().shape;
    const shape = `${mode}:${width}`;
    if (shape === this.drawnShape) return;
    this.drawnShape = shape;
    const size = SHAPE_SIZE[mode][width];
    for (const [property, value] of Object.entries({ ...SHAPE_BOX[mode], width: `${size.width}px`, height: `${size.height}px` })) {
      nodes.surface.style.setProperty(property, value, "important");
    }
  }

  /** Which lines the mode shows: the headline always; the step and the detail in the expanded card, when there are any. */
  private showTexts(nodes: Nodes): void {
    const view = this.shown;
    setDisplay(nodes.headline, true);
    setDisplay(nodes.step, view?.mode === "expanded" && Boolean(view.step));
    setDisplay(nodes.detail, view?.mode === "expanded" && Boolean(view.detail));
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
    this.keeper.stop();
    this.nodes?.host.remove();
    this.nodes = undefined;
    this.shown = undefined;
    this.drawnShape = undefined;
  }
}

function buildNodes(): Nodes {
  const host = inertElement(HOST_TAG, {
    all: "initial",
    display: "block",
    position: "fixed",
    left: `${EDGE_MARGIN}px`,
    bottom: `${EDGE_MARGIN}px`,
    right: "auto",
    top: "auto",
    "z-index": OVERLAY_Z_INDEX,
    "max-width": `calc(100vw - ${2 * EDGE_MARGIN}px)`,
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
    gap: "3px",
    "align-items": "stretch",
    "box-sizing": "border-box",
    "max-width": "100%",
    overflow: "hidden",
    background: SURFACE_BACKGROUND,
    border: SURFACE_BORDER,
    "box-shadow": SURFACE_SHADOW,
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
    font: `600 14px/20px ${FONT_STACK}`,
    "letter-spacing": "0.005em",
    color: TEXT,
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis"
  });
  const step = inertElement("div", {
    flex: "0 0 auto",
    font: `500 12.5px/20px ${FONT_STACK}`,
    color: SECONDARY,
    "font-variant-numeric": "tabular-nums",
    "white-space": "nowrap"
  });
  top.append(mark.element, headline, step);
  const detail = inertElement("div", {
    "padding-left": `${MARK_SIZE + MARK_GAP}px`,
    font: `400 13px/18px ${FONT_STACK}`,
    color: SECONDARY,
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis"
  });
  surface.append(top, detail);
  root.append(surface);
  return { host, surface, top, mark, headline, step, detail };
}

function withSpacing(width: number | undefined, text: string): number | undefined {
  return width === undefined ? undefined : width + text.length * HEADLINE_SPACING_PX;
}

function setDisplay(node: HTMLElement, shown: boolean): void {
  node.style.setProperty("display", shown ? "block" : "none", "important");
}

/** Sets the text when it differs; answers whether it changed. */
function setText(node: HTMLElement, text: string): boolean {
  if (node.textContent === text) return false;
  node.textContent = text;
  return true;
}
