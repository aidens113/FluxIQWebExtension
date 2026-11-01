/** A matching loading marker is never a completed item, with or without continuation provenance. */
export const listGrowth = {
  unmarked(row: Element): boolean {
    return row.getAttribute("aria-hidden") !== "true" && row.getAttribute("data-skeleton") === null
      && row.getAttribute("aria-busy") !== "true" && row.getAttribute("role") !== "progressbar";
  },
  added(item: string, shown: readonly Element[]): boolean {
    const before = new Set(shown);
    return [...document.querySelectorAll(item)].some((row) => !before.has(row) && listGrowth.unmarked(row));
  }
};
