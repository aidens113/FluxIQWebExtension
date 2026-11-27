// The signed effects a matrix case may save on its Flow's steps (`../matrix-row.ts`, `routeEffects`), by name.
import type { JsonObject } from "fluxiq/core";
import { HOOD_SEARCH_EFFECT } from "./hood-search-effect.js";

export { HOOD_SEARCH_EFFECT } from "./hood-search-effect.js";

/** Every effect a case can name, by the name the case gives it. */
export const MATRIX_SIGNED_EFFECTS: Readonly<Record<string, JsonObject>> = Object.freeze({ HOOD_SEARCH_EFFECT });
