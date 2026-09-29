// Previous / "Page n of m" / Next under a paged list, shared by the Activity and
// Recordings tabs (the single-file popup had two copies of this). Both buttons
// are disabled while a page is loading, so a double press cannot race.

import { createElement } from "../dom";
import type { PageCount } from "./page-count";

/** The pager's element, and ways to show where the list is and that it is loading. */
export type Pager = { readonly element: HTMLElement; set(count: PageCount): void; setBusy(busy: boolean): void };

/** Builds a pager; `onMove` is called with -1 for Previous and +1 for Next. */
export function createPager(onMove: (step: -1 | 1) => void): Pager {
  const previous = createElement("button", { className: "small-button", text: "Previous", attrs: { type: "button" } });
  const next = createElement("button", { className: "small-button", text: "Next", attrs: { type: "button" } });
  const label = createElement("span", { className: "pager-label", text: "Page 1" });
  let count: PageCount = { label: "Page 1", hasPrevious: false, hasNext: false };
  let busy = false;

  function render(): void {
    label.textContent = count.label;
    previous.disabled = busy || !count.hasPrevious;
    next.disabled = busy || !count.hasNext;
  }

  previous.addEventListener("click", () => onMove(-1));
  next.addEventListener("click", () => onMove(1));
  render();

  return {
    element: createElement("nav", { className: "pager", attrs: { "aria-label": "Pages" } }, [previous, label, next]),
    set(nextCount) {
      count = nextCount;
      render();
    },
    setBusy(nextBusy) {
      busy = nextBusy;
      render();
    }
  };
}
