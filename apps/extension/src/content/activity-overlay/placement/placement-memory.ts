// Where the overlay sat on the last page, for the next page to start from
// (`placement-keeper.ts`: a navigation keeps the overlay's place while that
// place is still clear on the new page).
//
// A page load replaces the content script, so the place is kept outside it,
// in the extension's own `chrome.storage.local`, which no page can read. It is
// the one value: a corner, a shape and an offset, never anything of the page.
// A stored value that is not a placement is ignored. Reading it is
// asynchronous, so the pill waits for it before it shows (`../status-pill.ts`);
// where there is no extension storage (the unit tests' Node) there is nothing
// to recall and nothing waits.

import type { OverlayAnchor, OverlayPlacement } from "./choose-placement";

const STORAGE_KEY = "fluxiq.activity.overlayPlacement";
const ANCHORS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "bottom-right", "top-right"];

/** Where the overlay's last place is kept between pages; a test passes its own. */
export type PlacementMemory = {
  /** The last place kept, or undefined when none is; a promise when it has to be read. */
  recall(): Promise<OverlayPlacement | undefined> | OverlayPlacement | undefined;
  /** Keeps `placement` as the last place. Best-effort. */
  keep(placement: OverlayPlacement): void;
};

type LocalStorageArea = { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> };

/** The extension's own storage, or the null memory where there is none. */
export const browserPlacementMemory: PlacementMemory = Object.freeze({
  recall(): Promise<OverlayPlacement | undefined> | undefined {
    const area = localArea();
    if (!area) return undefined;
    // A read that fails rejects: the pill shows where it fits (`../status-pill.ts`).
    return area.get(STORAGE_KEY).then((stored) => asPlacement(stored[STORAGE_KEY]));
  },
  keep(placement: OverlayPlacement): void {
    const area = localArea();
    if (!area) return;
    const value = placement.offset ? { shape: placement.shape, anchor: placement.anchor, offset: placement.offset } : { shape: placement.shape, anchor: placement.anchor };
    area.set({ [STORAGE_KEY]: value }).catch(() => {
      /* best-effort: the next page starts from the first corner instead */
    });
  }
});

function localArea(): LocalStorageArea | undefined {
  return (globalThis as { chrome?: { storage?: { local?: LocalStorageArea } } }).chrome?.storage?.local;
}

function asPlacement(value: unknown): OverlayPlacement | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as { shape?: unknown; anchor?: unknown; offset?: unknown };
  if (candidate.shape !== "pill" && candidate.shape !== "narrow") return undefined;
  if (!ANCHORS.includes(candidate.anchor as OverlayAnchor)) return undefined;
  const anchor = candidate.anchor as OverlayAnchor;
  if (candidate.offset === undefined) return { shape: candidate.shape, anchor };
  if (typeof candidate.offset !== "number" || !Number.isFinite(candidate.offset) || candidate.offset <= 0) return undefined;
  return { shape: candidate.shape, anchor, offset: candidate.offset };
}
