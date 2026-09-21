import { fixtureClient } from "../../../html.js";
import { composerScript } from "./composer-script.js";
import { feedScript } from "./feed-script.js";
import { REQUESTS_SCRIPT } from "./requests-script.js";
import { shellScript, type ClientConfig } from "./shell-script.js";
import { UNIT_SCRIPT } from "./unit-script.js";

export { FIRST_PRESS_BUSY_MS } from "./composer-script.js";
export { FEED_DELAYS, LOAD_AHEAD_PX } from "./feed-script.js";
export { OVERLAY_DELAYS } from "./shell-script.js";
export type { ClientConfig, ClientPage } from "./shell-script.js";

/**
 * The whole script for one page: the lab's fixture client, the shell every
 * page runs, what a feed unit does, and whatever the page itself has -- the
 * feed loader and composer at home, the composer on a group, the request
 * buttons among friends.
 */
export function clientScript(runToken: string, config: ClientConfig): string {
  const own = config.page === "home" ? `${feedScript()}\n${composerScript()}`
    : config.page === "group" ? composerScript()
    : config.page === "friends" ? REQUESTS_SCRIPT
    : "";
  return `${fixtureClient(runToken, "social-network-feed")}\n${shellScript(config)}\n${UNIT_SCRIPT}\n${own}`;
}
