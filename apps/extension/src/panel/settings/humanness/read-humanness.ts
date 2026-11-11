import { normaliseHumanness } from "./normalise-humanness";
import type { HumannessSettings } from "./settings";

/** The saved humanness; absent reads as 0. */
export function readHumanness(settings: HumannessSettings | undefined): number {
  return normaliseHumanness(settings?.humanness);
}
