import { normaliseHumanness } from "./normalise-humanness";
import type { FluxIQSettings } from "../../../shared/protocol";

/** The saved humanness; absent reads as 0. */
export function readHumanness(settings: FluxIQSettings | undefined): number {
  return normaliseHumanness(settings?.humanness);
}
