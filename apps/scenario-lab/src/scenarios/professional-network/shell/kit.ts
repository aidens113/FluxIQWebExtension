import type { RenderContext } from "../../../types.js";
import type { ProfessionalNetworkState } from "../types.js";
import { networkClasses, type NetworkClasses } from "./classes.js";
import { emberIds, type EmberIds } from "./ember-ids.js";

/** What every piece of markup on one rendering shares: its class names, its id counter, and the session it renders. */
export type ShellKit = { css: NetworkClasses; ids: EmberIds; state: ProfessionalNetworkState; context: RenderContext };

/** `salt` separates one page's id range from another's, so the same control has a different id on every page it appears on. */
export function shellKit(state: ProfessionalNetworkState, context: RenderContext, salt: number): ShellKit {
  return { css: networkClasses(context.seed), ids: emberIds(context.seed, salt), state, context };
}
