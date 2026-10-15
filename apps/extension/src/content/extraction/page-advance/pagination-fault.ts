// A move to the next page that could not be made, and the word that says which
// way it failed. Every throw out of a step is one of these or is read as
// `page_fault`, so a move that stopped always says why in one closed word.
// A Next that would drop the filters the page shows applied also carries how
// many (`filtersDropped`, t626), a count the step's answer passes on so the
// model is told that it was the list's filters, and never which.

import type { PaginationStop } from "./types";

/** A move to the next page that could not be made, and the word that says which way it failed. */
export class PaginationFault extends Error {
  readonly stop: PaginationStop;
  /** How many applied filters the Next would have dropped, on a fault that is that; absent on every other. */
  readonly filtersDropped: number | undefined;

  constructor(stop: PaginationStop, message: string, filtersDropped?: number) {
    super(message);
    this.name = "PaginationFault";
    this.stop = stop;
    this.filtersDropped = filtersDropped;
  }
}

/** The stop word for a move that threw: the fault's own, or `page_fault` for anything else. */
export function paginationStopOf(error: unknown): PaginationStop {
  return error instanceof PaginationFault ? error.stop : "page_fault";
}
