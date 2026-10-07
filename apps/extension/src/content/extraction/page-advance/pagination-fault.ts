// A move to the next page that could not be made, and the word that says which
// way it failed. Every throw out of a step is one of these or is read as
// `page_fault`, so a move that stopped always says why in one closed word.

import type { PaginationStop } from "./types";

/** A move to the next page that could not be made, and the word that says which way it failed. */
export class PaginationFault extends Error {
  readonly stop: PaginationStop;

  constructor(stop: PaginationStop, message: string) {
    super(message);
    this.name = "PaginationFault";
    this.stop = stop;
  }
}

/** The stop word for a move that threw: the fault's own, or `page_fault` for anything else. */
export function paginationStopOf(error: unknown): PaginationStop {
  return error instanceof PaginationFault ? error.stop : "page_fault";
}
