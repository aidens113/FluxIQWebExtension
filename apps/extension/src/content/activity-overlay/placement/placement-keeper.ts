// Keeps the overlay where `choosePlacement` says, as the page changes under
// it: a cookie banner arriving after load, a chat widget opening, the window
// resizing, a sticky bar sticking on scroll.
//
// It re-checks when the viewport resizes, the page scrolls, or the page's DOM
// changes, and never more than once per `CHECK_INTERVAL_MS`: the first
// request after a quiet interval checks at once and any made during the
// interval fold into one check at its end. A check only reads the page (a few
// dozen hit tests and the styles of what they hit) and the overlay moves --
// one write -- only when the answer changes, so nothing here reads layout
// after writing it inside one check, and a busy page costs at most one check
// per interval.
//
// The overlay's own changes are not page changes: mutations inside the
// extension's UI are skipped (`isExtensionUiNode`), or moving the overlay
// would schedule the next check itself.
//
// In a document without layout (the unit tests' fake DOM) it keeps the first
// corner and checks nothing.

import { isExtensionUiNode } from "../../picker-host";
import { choosePlacement, type OverlayPlacement, type PlacementInput } from "./choose-placement";
import { pageProbe } from "./page-probe";

/** The shortest time between two placement checks. */
const CHECK_INTERVAL_MS = 800;

/** Where the overlay starts, and stays in a document it cannot measure. */
const FIRST_PLACEMENT: OverlayPlacement = Object.freeze({ shape: "pill", anchor: "bottom-left" });

const WATCHED_ATTRIBUTES = ["style", "class", "hidden", "open", "role", "aria-modal"];

export type PlacementKeeperOptions = {
  /** The sizes to place: the pill's box in its current mode, the dot, and the margin. */
  readonly sizes: () => Omit<PlacementInput, "probe" | "current" | "viewport">;
  /** Moves the overlay. Called only when the placement changes. */
  readonly place: (placement: OverlayPlacement) => void;
};

export class PlacementKeeper {
  private current: OverlayPlacement | undefined;
  private observer: MutationObserver | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastCheckAt = Number.NEGATIVE_INFINITY;
  private readonly onViewportChange = (): void => this.request();

  constructor(private readonly options: PlacementKeeperOptions) {}

  /** Where the overlay is now; the first corner before any check. */
  placement(): OverlayPlacement {
    return this.current ?? FIRST_PLACEMENT;
  }

  /** Checks now and starts watching the page. Watching twice is watching once. */
  start(): OverlayPlacement {
    this.check();
    if (this.observer || typeof MutationObserver !== "function" || typeof addEventListener !== "function") return this.placement();
    this.observer = new MutationObserver((records) => {
      if (records.some(isPageChange)) this.request();
    });
    this.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
    addEventListener("resize", this.onViewportChange, { passive: true });
    addEventListener("scroll", this.onViewportChange, { passive: true, capture: true });
    return this.placement();
  }

  /** Stops watching; the next `start` checks afresh. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (typeof removeEventListener === "function") {
      removeEventListener("resize", this.onViewportChange);
      removeEventListener("scroll", this.onViewportChange, { capture: true });
    }
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.current = undefined;
  }

  /** A re-check the pill needs at once: its mode, and so its size, changed. */
  recheck(): void {
    this.check();
  }

  private request(): void {
    if (this.timer !== undefined) return;
    const wait = this.lastCheckAt + CHECK_INTERVAL_MS - Date.now();
    if (wait <= 0) {
      this.check();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.check();
    }, wait);
  }

  private check(): void {
    this.lastCheckAt = Date.now();
    const next = measurable() ? choosePlacement({ ...this.options.sizes(), viewport: viewport(), probe: pageProbe(), current: this.current }) : this.placement();
    if (this.current && next.shape === this.current.shape && next.anchor === this.current.anchor) return;
    this.current = next;
    this.options.place(next);
  }
}

/** A change the page made, not the extension's UI arriving, leaving or changing inside itself. */
function isPageChange(record: MutationRecord): boolean {
  if (isExtensionUiNode(record.target)) return false;
  if (record.type !== "childList") return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) => !isExtensionUiNode(node));
}

function measurable(): boolean {
  return typeof document.elementFromPoint === "function" && typeof getComputedStyle === "function" && viewport().width > 0 && viewport().height > 0;
}

function viewport(): PlacementInput["viewport"] {
  const root = document.documentElement;
  return { width: root.clientWidth || 0, height: root.clientHeight || 0 };
}
