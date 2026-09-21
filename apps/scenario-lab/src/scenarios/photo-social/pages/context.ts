import type { PhotoLook } from "../look/index.js";
import type { PhotoState } from "../types.js";

/** Everything a page is rendered from: what the run changed, the seed's styling, and the run's token for the page's own requests. */
export type PageContext = {
  state: PhotoState;
  look: PhotoLook;
  seed: number;
  runToken: string;
};
