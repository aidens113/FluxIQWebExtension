// Keeps the overlay where `choosePlacement` says, as the page changes under
// it -- a cookie banner arriving after load, a chat widget opening, the window
// resizing -- without ever making it jump about.
//
// Once placed, the overlay **stays put**. It moves only when the chooser has
// named a clearly better place (`choose-placement.ts`, rule 3) at every check
// for `SETTLE_MS` on end. A change that comes and goes inside that time -- a
// tooltip, a menu opened and closed, a toast -- never moves it, and
// **scrolling never moves it**: a scroll starts the count again, and checks
// count only once the page has been still for `SCROLL_QUIET_MS`. Round 5 of the
// breadth reruns saw the pill jump between the top, the middle and the bottom
// of the left edge, sometimes within three seconds, re-placed on every style
// change and every scroll.
//
// Two placements skip the wait: the first one, and the first one measured
// after a document with no layout yet (the content script starts before the
// page is parsed). A **new page starts from the place the last page held**
// (`start(remembered)`), kept when it is still clear, so a navigation does not
// move the overlay; the place taken is handed to `remember` for the next one.
//
// It re-checks when the viewport resizes or the page's DOM changes, never more
// than once per `CHECK_INTERVAL_MS`: the first request after a quiet interval
// checks at once and any made during the interval fold into one check at its
// end. A check only reads the page (hit tests and the styles of what they hit)
// and the overlay moves -- one write -- only when the answer changes, so
// nothing here reads layout after writing it inside one check.
//
// The overlay's own changes are not page changes: mutations inside the
// extension's UI are skipped (`isExtensionUiNode`), or moving the overlay
// would schedule the next check itself.

import { isExtensionUiNode } from "../../picker-host";
import { choosePlacement, type OverlayPlacement, type PlacementInput, type PointCover } from "./choose-placement";
import { pageProbe } from "./page-probe";

/** The shortest time between two placement checks. */
const CHECK_INTERVAL_MS = 800;
/** How long a better place must stay better, check after check, before the overlay moves to it. */
const SETTLE_MS = 2_000;
/** How long the page must be still after a scroll before a check counts towards a move. */
const SCROLL_QUIET_MS = 600;

/** Where the overlay starts, and stays in a document it cannot measure. */
const FIRST_PLACEMENT: OverlayPlacement = Object.freeze({ shape: "pill", anchor: "bottom-left" });

const WATCHED_ATTRIBUTES = ["style", "class", "hidden", "open", "role", "aria-modal"];

/** The page as a placement check reads it. */
export type PlacementPage = {
  /** The viewport's client area, or undefined while the document has no layout to measure. */
  viewport(): PlacementInput["viewport"] | undefined;
  /** What lies under each point of the page as it is now, for one check. */
  probe(): (x: number, y: number) => PointCover;
};

export type PlacementKeeperOptions = {
  /** The sizes to place: the pill's box in its current mode, the narrower pill's, and the margin. */
  readonly sizes: () => Omit<PlacementInput, "probe" | "current" | "viewport">;
  /** Moves the overlay. Called only when the placement changes. */
  readonly place: (placement: OverlayPlacement) => void;
  /** Told each place the overlay takes on a measured page, for the next page to start from. */
  readonly remember?: (placement: OverlayPlacement) => void;
  /** The page to read; the live document unless a test passes another. */
  readonly page?: PlacementPage;
};

export class PlacementKeeper {
  private current: OverlayPlacement | undefined;
  /** The current placement was chosen on a measured page, not placed blind. */
  private measured = false;
  /** The place a new page starts from, until its first measured check. */
  private remembered: OverlayPlacement | undefined;
  /** Since when every check has named a better place than the current one. */
  private betterSince: number | undefined;
  private lastScrollAt = Number.NEGATIVE_INFINITY;
  private observer: MutationObserver | undefined;
  private checkTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private lastCheckAt = Number.NEGATIVE_INFINITY;
  private readonly page: PlacementPage;
  private readonly onResize = (): void => this.pageChanged();
  private readonly onScroll = (): void => this.scrolled();

  constructor(private readonly options: PlacementKeeperOptions) {
    this.page = options.page ?? DOCUMENT_PAGE;
  }

  /** Where the overlay is now; the first corner before any check. */
  placement(): OverlayPlacement {
    return this.current ?? FIRST_PLACEMENT;
  }

  /** Places the overlay now, starting from `remembered` when it is still clear, and starts watching the page. Watching twice is watching once. */
  start(remembered?: OverlayPlacement): OverlayPlacement {
    if (this.current === undefined && remembered !== undefined) this.remembered = remembered;
    this.check();
    if (this.observer || typeof MutationObserver !== "function" || typeof addEventListener !== "function") return this.placement();
    this.observer = new MutationObserver((records) => {
      if (records.some(isPageChange)) this.pageChanged();
    });
    this.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
    addEventListener("resize", this.onResize, { passive: true });
    addEventListener("scroll", this.onScroll, { passive: true, capture: true });
    return this.placement();
  }

  /** Stops watching; the next `start` places afresh. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (typeof removeEventListener === "function") {
      removeEventListener("resize", this.onResize);
      removeEventListener("scroll", this.onScroll, { capture: true });
    }
    this.clearTimers();
    this.current = undefined;
    this.measured = false;
    this.remembered = undefined;
    this.betterSince = undefined;
    this.lastScrollAt = Number.NEGATIVE_INFINITY;
  }

  /** The pill's mode, and so its size, changed: checked at once, and moved only as any other change would move it. */
  recheck(): void {
    this.check();
  }

  /** The page changed (its DOM, the viewport's size): a check, within the interval. */
  pageChanged(): void {
    if (this.checkTimer !== undefined) return;
    const wait = this.lastCheckAt + CHECK_INTERVAL_MS - Date.now();
    if (wait <= 0) {
      this.check();
      return;
    }
    this.checkTimer = setTimeout(() => {
      this.checkTimer = undefined;
      this.check();
    }, wait);
  }

  /** The page scrolled: nothing seen while it moves counts towards a move, and it is looked at again once it is still. */
  scrolled(): void {
    this.lastScrollAt = Date.now();
    this.betterSince = undefined;
    this.settleAt(this.lastScrollAt + SCROLL_QUIET_MS);
  }

  private check(): void {
    const now = Date.now();
    this.lastCheckAt = now;
    const viewport = this.page.viewport();
    if (viewport === undefined) {
      // No layout yet: the remembered place, or the first corner, unmeasured.
      if (this.current === undefined) this.adopt(this.remembered ?? FIRST_PLACEMENT, false);
      return;
    }
    const held = this.current !== undefined && this.measured ? this.current : this.remembered ?? this.current;
    const next = choosePlacement({ ...this.options.sizes(), viewport, probe: this.page.probe(), current: held });
    if (this.current === undefined || !this.measured) {
      this.remembered = undefined;
      this.adopt(next, true);
      return;
    }
    if (samePlacement(next, this.current)) {
      this.betterSince = undefined;
      return;
    }
    if (now - this.lastScrollAt < SCROLL_QUIET_MS) {
      this.betterSince = undefined;
      this.settleAt(this.lastScrollAt + SCROLL_QUIET_MS);
      return;
    }
    if (this.betterSince === undefined) this.betterSince = now;
    if (now - this.betterSince < SETTLE_MS) {
      this.settleAt(this.betterSince + SETTLE_MS);
      return;
    }
    this.adopt(next, true);
  }

  private adopt(next: OverlayPlacement, measured: boolean): void {
    this.betterSince = undefined;
    this.measured = measured;
    if (measured) this.options.remember?.(next);
    if (this.current !== undefined && samePlacement(next, this.current)) return;
    this.current = next;
    this.options.place(next);
  }

  /** A check at `at`, replacing any settle check already waiting. */
  private settleAt(at: number): void {
    if (this.settleTimer !== undefined) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined;
      this.check();
    }, Math.max(0, at - Date.now()));
  }

  private clearTimers(): void {
    if (this.checkTimer !== undefined) clearTimeout(this.checkTimer);
    if (this.settleTimer !== undefined) clearTimeout(this.settleTimer);
    this.checkTimer = undefined;
    this.settleTimer = undefined;
  }
}

function samePlacement(left: OverlayPlacement, right: OverlayPlacement): boolean {
  return left.shape === right.shape && left.anchor === right.anchor && (left.offset ?? 0) === (right.offset ?? 0);
}

/** A change the page made, not the extension's UI arriving, leaving or changing inside itself. */
function isPageChange(record: MutationRecord): boolean {
  if (isExtensionUiNode(record.target)) return false;
  if (record.type !== "childList") return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) => !isExtensionUiNode(node));
}

/** The live document: measurable once it has a laid-out viewport and the hit test to read it. */
const DOCUMENT_PAGE: PlacementPage = Object.freeze({
  viewport(): PlacementInput["viewport"] | undefined {
    if (typeof document === "undefined" || typeof document.elementFromPoint !== "function" || typeof getComputedStyle !== "function") return undefined;
    const root = document.documentElement;
    const size = { width: root.clientWidth || 0, height: root.clientHeight || 0 };
    return size.width > 0 && size.height > 0 ? size : undefined;
  },
  probe: pageProbe
});
