import { PANTRY } from "./pantry.js";
import { PAPER_TOWELS } from "./paper-towels.js";
import type { Product } from "../types.js";

/** The whole catalog, in the order a search ranks it by best match. */
export const PRODUCTS: readonly Product[] = Object.freeze([...PAPER_TOWELS, ...PANTRY]);
