import { storeClasses, storeIds, type StoreClasses, type StoreIds } from "../style/index.js";
import type { RenderContext } from "../../../types.js";
import type { StoreState } from "../state/index.js";

/**
 * What every page renderer needs: the state it renders, the class names and
 * element ids of the lab seed's build, and the run token the page's script
 * reports its changes with.
 */
export type PageKit = { state: StoreState; css: StoreClasses; ids: StoreIds; runToken: string; seed: number };

export function pageKit(state: StoreState, context: RenderContext): PageKit {
  return { state, css: storeClasses(context.seed), ids: storeIds(context.seed), runToken: context.runToken, seed: context.seed };
}
