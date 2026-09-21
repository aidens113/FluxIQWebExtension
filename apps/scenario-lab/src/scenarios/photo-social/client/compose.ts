import { GLYPHS } from "../look/index.js";
import { CORE_SCRIPT } from "./core-script.js";
import { DIRECT_SCRIPT } from "./direct-script.js";
import { FEED_SCRIPT } from "./feed-script.js";
import { GRID_SCRIPT } from "./grid-script.js";
import { OVERLAY_SCRIPT } from "./overlay-script.js";
import { POST_SCRIPT } from "./post-script.js";
import { SAVED_SCRIPT } from "./saved-script.js";

/** The behaviours a page can load beyond the shared core and overlays. */
export type ClientModule = "feed" | "grid" | "post" | "direct" | "saved";

const MODULES: Readonly<Record<ClientModule, string>> = {
  feed: FEED_SCRIPT,
  grid: GRID_SCRIPT,
  post: POST_SCRIPT,
  direct: DIRECT_SCRIPT,
  saved: SAVED_SCRIPT,
};

/**
 * One page's script, after the fixture client that defines `mutate` and the
 * `FL` configuration the page renders: the icons, the core, the overlays, and
 * the page's own behaviours in a fixed order.
 */
export function photoClientScript(modules: readonly ClientModule[]): string {
  const chosen = (Object.keys(MODULES) as ClientModule[]).filter((name) => modules.includes(name)).map((name) => MODULES[name]);
  return [`const GLYPHS = ${JSON.stringify(GLYPHS)};`, CORE_SCRIPT, OVERLAY_SCRIPT, ...chosen].join("\n");
}
